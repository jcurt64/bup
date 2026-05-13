/**
 * Données pour la page admin `/buupp-admin/non-atteint`.
 *
 * Aggregate les "prospects signalés non atteint" (relations.evaluation =
 * 'non_atteint') avec :
 *   - liste des alertes reçues (events admin de type prospect.non_atteint_threshold)
 *   - stats sur les prospects flaggés (ville, age, genre, dépt)
 *   - stats sur les pros qui ont signalé (secteur, ville, plan, dépt)
 *
 * Tout en lecture pure depuis Supabase admin (service_role). Aucune
 * RPC dédiée : agrégation JS sur des SELECT simples, vu le volume
 * attendu (qq dizaines max).
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AlertItem = {
  id: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
  prospectId: string | null;
  prospectName: string;
  prospectVille: string | null;
  pros: Array<{ raisonSociale: string; flaggedAt: string | null }>;
  count: number;
};

export type DistributionEntry = { key: string; n: number };

export type NonAtteintOverview = {
  alerts: AlertItem[];
  prospectStats: {
    total: number;
    villesUnique: number;
    topVilles: DistributionEntry[];
    genre: DistributionEntry[];
    ageRanges: DistributionEntry[];
    departements: DistributionEntry[];
  };
  proStats: {
    total: number;
    secteurs: DistributionEntry[];
    plans: DistributionEntry[];
    villesUnique: number;
    topVilles: DistributionEntry[];
    departements: DistributionEntry[];
  };
};

const AGE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "< 25", min: 0, max: 25 },
  { label: "25-34", min: 25, max: 35 },
  { label: "35-44", min: 35, max: 45 },
  { label: "45-54", min: 45, max: 55 },
  { label: "55-64", min: 55, max: 65 },
  { label: "65+", min: 65, max: 200 },
  { label: "Inconnu", min: -1, max: -1 },
];

function ageFromNaissance(s: string | null): number | null {
  if (!s) return null;
  // Le champ `naissance` est stocké en `text` au format français
  // DD/MM/YYYY (cf. contrainte SQL `prospect_identity_naissance_format_chk`).
  // On accepte aussi YYYY-MM-DD pour la robustesse future.
  let day: number, month: number, year: number;
  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fr) {
    day = Number(fr[1]);
    month = Number(fr[2]);
    year = Number(fr[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    return null;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

function bucketAge(age: number | null): string {
  if (age === null) return "Inconnu";
  for (const b of AGE_BUCKETS) {
    if (b.min === -1) continue;
    if (age >= b.min && age < b.max) return b.label;
  }
  return "Inconnu";
}

function departementFromCp(cp: string | null): string | null {
  if (!cp) return null;
  const m = cp.trim().match(/^(\d{2,3})/);
  if (!m) return null;
  return m[1].slice(0, 2);
}

function topNFromCount(counts: Record<string, number>, n: number): DistributionEntry[] {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, n: count }))
    .sort((a, b) => b.n - a.n)
    .slice(0, n);
}

function distributionFromCount(counts: Record<string, number>): DistributionEntry[] {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, n: count }))
    .sort((a, b) => b.n - a.n);
}

export async function fetchNonAtteintOverview(): Promise<NonAtteintOverview> {
  const admin = createSupabaseAdminClient();

  // 1. Toutes les relations 'non_atteint' + joins prospects + pros.
  const { data: flagRows, error: flagsErr } = await admin
    .from("relations")
    .select(
      `id, prospect_id, evaluated_at, evaluated_by_pro_id,
       pro_accounts:evaluated_by_pro_id ( raison_sociale, secteur, plan, ville, code_postal ),
       prospects:prospect_id (
         prospect_identity ( prenom, nom, genre, naissance ),
         prospect_localisation ( ville, code_postal )
       )`,
    )
    .eq("evaluation", "non_atteint")
    .order("evaluated_at", { ascending: false });
  if (flagsErr) throw flagsErr;

  type RawFlag = {
    id: string;
    prospect_id: string;
    evaluated_at: string | null;
    evaluated_by_pro_id: string | null;
    pro_accounts:
      | { raison_sociale: string | null; secteur: string | null; plan: string | null; ville: string | null; code_postal: string | null }
      | { raison_sociale: string | null; secteur: string | null; plan: string | null; ville: string | null; code_postal: string | null }[]
      | null;
    prospects: {
      prospect_identity:
        | { prenom: string | null; nom: string | null; genre: string | null; naissance: string | null }
        | { prenom: string | null; nom: string | null; genre: string | null; naissance: string | null }[]
        | null;
      prospect_localisation:
        | { ville: string | null; code_postal: string | null }
        | { ville: string | null; code_postal: string | null }[]
        | null;
    } | null;
  };

  const flags = ((flagRows ?? []) as unknown as RawFlag[]).map((r) => {
    const pa = Array.isArray(r.pro_accounts) ? r.pro_accounts[0] : r.pro_accounts;
    const idRaw = r.prospects?.prospect_identity ?? null;
    const id = Array.isArray(idRaw) ? idRaw[0] ?? null : idRaw;
    const locRaw = r.prospects?.prospect_localisation ?? null;
    const loc = Array.isArray(locRaw) ? locRaw[0] ?? null : locRaw;
    return {
      relationId: r.id,
      prospectId: r.prospect_id,
      proId: r.evaluated_by_pro_id,
      flaggedAt: r.evaluated_at,
      proRaisonSociale: pa?.raison_sociale ?? null,
      proSecteur: pa?.secteur ?? null,
      proPlan: pa?.plan ?? null,
      proVille: pa?.ville ?? null,
      proCp: pa?.code_postal ?? null,
      prospectPrenom: id?.prenom ?? null,
      prospectNom: id?.nom ?? null,
      prospectGenre: id?.genre ?? null,
      prospectNaissance: id?.naissance ?? null,
      prospectVille: loc?.ville ?? null,
      prospectCp: loc?.code_postal ?? null,
    };
  });

  // 2. Agrégation par prospect.
  const byProspect = new Map<
    string,
    {
      prospectId: string;
      name: string;
      ville: string | null;
      cp: string | null;
      genre: string | null;
      age: number | null;
      count: number;
      pros: Array<{ id: string; raisonSociale: string; flaggedAt: string | null }>;
    }
  >();
  for (const f of flags) {
    const fullName =
      `${f.prospectPrenom ?? ""} ${f.prospectNom ?? ""}`.trim() || "Prospect anonyme";
    const cur = byProspect.get(f.prospectId);
    if (cur) {
      cur.count += 1;
      if (f.proId && !cur.pros.find((p) => p.id === f.proId)) {
        cur.pros.push({
          id: f.proId,
          raisonSociale: f.proRaisonSociale ?? "Pro anonyme",
          flaggedAt: f.flaggedAt,
        });
      }
    } else {
      byProspect.set(f.prospectId, {
        prospectId: f.prospectId,
        name: fullName,
        ville: f.prospectVille,
        cp: f.prospectCp,
        genre: f.prospectGenre,
        age: ageFromNaissance(f.prospectNaissance),
        count: 1,
        pros: f.proId
          ? [{ id: f.proId, raisonSociale: f.proRaisonSociale ?? "Pro anonyme", flaggedAt: f.flaggedAt }]
          : [],
      });
    }
  }
  const prospects = Array.from(byProspect.values());

  // 3. Stats prospects (uniquement les flagés au moins 1× — tout ce qui
  // est dans `prospects` ici).
  const villesCount: Record<string, number> = {};
  const genreCount: Record<string, number> = {};
  const ageCount: Record<string, number> = {};
  const depCount: Record<string, number> = {};
  for (const p of prospects) {
    const v = (p.ville ?? "").trim();
    if (v) villesCount[v] = (villesCount[v] ?? 0) + 1;
    const g = (p.genre ?? "").trim() || "Inconnu";
    genreCount[g] = (genreCount[g] ?? 0) + 1;
    const a = bucketAge(p.age);
    ageCount[a] = (ageCount[a] ?? 0) + 1;
    const d = departementFromCp(p.cp);
    if (d) depCount[d] = (depCount[d] ?? 0) + 1;
  }
  const prospectStats = {
    total: prospects.length,
    villesUnique: Object.keys(villesCount).length,
    topVilles: topNFromCount(villesCount, 5),
    genre: distributionFromCount(genreCount),
    ageRanges: distributionFromCount(ageCount),
    departements: topNFromCount(depCount, 6),
  };

  // 4. Agrégation par pro (unique : un pro peut avoir signalé plusieurs
  // prospects, on le compte 1× pour le total mais ses signalements
  // peuvent agréger).
  const byPro = new Map<
    string,
    { id: string; raisonSociale: string; secteur: string | null; plan: string | null; ville: string | null; cp: string | null; signalements: number }
  >();
  for (const f of flags) {
    if (!f.proId) continue;
    const cur = byPro.get(f.proId);
    if (cur) {
      cur.signalements += 1;
    } else {
      byPro.set(f.proId, {
        id: f.proId,
        raisonSociale: f.proRaisonSociale ?? "Pro anonyme",
        secteur: f.proSecteur,
        plan: f.proPlan,
        ville: f.proVille,
        cp: f.proCp,
        signalements: 1,
      });
    }
  }
  const pros = Array.from(byPro.values());

  const proSecteurCount: Record<string, number> = {};
  const proPlanCount: Record<string, number> = {};
  const proVilleCount: Record<string, number> = {};
  const proDepCount: Record<string, number> = {};
  for (const p of pros) {
    const s = (p.secteur ?? "").trim() || "Non renseigné";
    proSecteurCount[s] = (proSecteurCount[s] ?? 0) + 1;
    const pl = (p.plan ?? "").trim() || "Inconnu";
    proPlanCount[pl] = (proPlanCount[pl] ?? 0) + 1;
    const v = (p.ville ?? "").trim();
    if (v) proVilleCount[v] = (proVilleCount[v] ?? 0) + 1;
    const d = departementFromCp(p.cp);
    if (d) proDepCount[d] = (proDepCount[d] ?? 0) + 1;
  }
  const proStats = {
    total: pros.length,
    secteurs: distributionFromCount(proSecteurCount),
    plans: distributionFromCount(proPlanCount),
    villesUnique: Object.keys(proVilleCount).length,
    topVilles: topNFromCount(proVilleCount, 5),
    departements: topNFromCount(proDepCount, 6),
  };

  // 5. Liste des alertes (admin_events de type prospect.non_atteint_threshold).
  const { data: eventRows } = await admin
    .from("admin_events")
    .select("id, created_at, severity, prospect_id, payload")
    .eq("type", "prospect.non_atteint_threshold")
    .order("created_at", { ascending: false })
    .limit(50);

  type EventRow = {
    id: string;
    created_at: string;
    severity: "info" | "warning" | "critical";
    prospect_id: string | null;
    payload: { count?: number; pros?: Array<{ raisonSociale?: string; flaggedAt?: string }> } | null;
  };

  // Index prospects par id pour pouvoir afficher nom + ville dans la liste.
  const prospectIndex = new Map(prospects.map((p) => [p.prospectId, p]));

  const alerts: AlertItem[] = ((eventRows ?? []) as unknown as EventRow[]).map((e) => {
    const indexed = e.prospect_id ? prospectIndex.get(e.prospect_id) : null;
    return {
      id: e.id,
      createdAt: e.created_at,
      severity: e.severity,
      prospectId: e.prospect_id,
      prospectName: indexed?.name ?? "Prospect anonyme",
      prospectVille: indexed?.ville ?? null,
      pros: Array.isArray(e.payload?.pros)
        ? e.payload!.pros!.map((p) => ({
            raisonSociale: p?.raisonSociale ?? "Pro anonyme",
            flaggedAt: p?.flaggedAt ?? null,
          }))
        : [],
      count: Number(e.payload?.count ?? 0),
    };
  });

  return { alerts, prospectStats, proStats };
}
