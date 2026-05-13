/**
 * /buupp-admin/prospects/non-joignables — liste des prospects qui ont
 * été signalés "non atteint" 2 fois ou plus (cumul tous pros confondus).
 *
 * Cible exclusivement les "freeloaders" potentiels : prospects qui ont
 * accepté une ou plusieurs sollicitations (et touché leur rémunération)
 * mais qui n'ont pas répondu aux pros. Permet à l'équipe admin de :
 *   - voir le détail des signalements (date, pro émetteur)
 *   - vérifier si le message gentil a déjà été envoyé au prospect
 *   - décider d'une action manuelle si le comportement persiste
 *
 * Server Component : la requête tape directement la BD via service_role,
 * pas d'API route intermédiaire.
 */
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_THRESHOLD = 2;

type FlagRow = {
  relation_id: string;
  prospect_id: string;
  evaluated_at: string | null;
  pro_account_id: string | null;
  pro_raison_sociale: string | null;
  prospect_prenom: string | null;
  prospect_nom: string | null;
  prospect_email: string | null;
  prospect_ville: string | null;
};

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const at = email.indexOf("@");
  if (at < 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  return local.slice(0, Math.max(1, local.length - 4)) + "•••" + domain;
}

function maskName(prenom: string | null, nom: string | null): string {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  const nomMasked = n ? `${n.charAt(0).toUpperCase()}.` : "";
  const out = `${p} ${nomMasked}`.trim();
  return out || "Prospect anonyme";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default async function NonJoignablesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ threshold?: string }>;
}) {
  const sp = await searchParams;
  // Le seuil prod est 2 (cf. /api/pro/contacts/[relationId]/evaluation).
  // Le query param `?threshold=1` permet à l'équipe admin de visualiser
  // tous les signalements même quand le seuil n'est pas encore franchi —
  // utile pour le suivi en avance de phase et la démo.
  const threshold = Math.max(1, Number(sp.threshold ?? DEFAULT_THRESHOLD) || DEFAULT_THRESHOLD);
  const admin = createSupabaseAdminClient();

  // 1. Toutes les évaluations 'non_atteint' avec les joints utiles. Filtre
  //    serveur uniquement sur l'enum — l'agrégation par prospect se fait
  //    en JS pour pouvoir collecter la liste des pros qui ont signalé.
  const { data: rawFlags, error: flagsErr } = await admin
    .from("relations")
    .select(
      `id, prospect_id, evaluated_at, evaluated_by_pro_id,
       pro_accounts:evaluated_by_pro_id ( raison_sociale ),
       prospects:prospect_id (
         prospect_identity ( prenom, nom, email ),
         prospect_localisation ( ville )
       )`,
    )
    .eq("evaluation", "non_atteint")
    .order("evaluated_at", { ascending: false });

  if (flagsErr) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-medium mb-2">Prospects non joignables</h1>
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          Erreur de lecture : {flagsErr.message}
        </p>
      </div>
    );
  }

  type RawRow = {
    id: string;
    prospect_id: string;
    evaluated_at: string | null;
    evaluated_by_pro_id: string | null;
    pro_accounts: { raison_sociale: string | null }
      | { raison_sociale: string | null }[]
      | null;
    prospects: {
      prospect_identity:
        | { prenom: string | null; nom: string | null; email: string | null }
        | { prenom: string | null; nom: string | null; email: string | null }[]
        | null;
      prospect_localisation:
        | { ville: string | null }
        | { ville: string | null }[]
        | null;
    } | null;
  };
  const flat: FlagRow[] = ((rawFlags ?? []) as unknown as RawRow[]).map((r) => {
    const pro = Array.isArray(r.pro_accounts) ? r.pro_accounts[0] : r.pro_accounts;
    const idRaw = r.prospects?.prospect_identity ?? null;
    const ident = Array.isArray(idRaw) ? (idRaw[0] ?? null) : idRaw;
    const locRaw = r.prospects?.prospect_localisation ?? null;
    const loc = Array.isArray(locRaw) ? (locRaw[0] ?? null) : locRaw;
    return {
      relation_id: r.id,
      prospect_id: r.prospect_id,
      evaluated_at: r.evaluated_at,
      pro_account_id: r.evaluated_by_pro_id,
      pro_raison_sociale: pro?.raison_sociale ?? null,
      prospect_prenom: ident?.prenom ?? null,
      prospect_nom: ident?.nom ?? null,
      prospect_email: ident?.email ?? null,
      prospect_ville: loc?.ville ?? null,
    };
  });

  // 2. Groupage par prospect, filtrage seuil >= 2.
  type Group = {
    prospect_id: string;
    name: string;
    email: string;
    ville: string;
    count: number;
    lastFlaggedAt: string | null;
    pros: string[];
  };
  const grouped = new Map<string, Group>();
  for (const row of flat) {
    const key = row.prospect_id;
    const cur = grouped.get(key);
    if (cur) {
      cur.count += 1;
      if (row.pro_raison_sociale && !cur.pros.includes(row.pro_raison_sociale)) {
        cur.pros.push(row.pro_raison_sociale);
      }
      // evaluated_at desc déjà trié → on garde le 1er rencontré.
    } else {
      grouped.set(key, {
        prospect_id: key,
        name: maskName(row.prospect_prenom, row.prospect_nom),
        email: maskEmail(row.prospect_email),
        ville: row.prospect_ville ?? "—",
        count: 1,
        lastFlaggedAt: row.evaluated_at,
        pros: row.pro_raison_sociale ? [row.pro_raison_sociale] : [],
      });
    }
  }
  const flagged = Array.from(grouped.values())
    .filter((g) => g.count >= threshold)
    .sort(
      (a, b) =>
        (new Date(b.lastFlaggedAt ?? 0).getTime() || 0) -
        (new Date(a.lastFlaggedAt ?? 0).getTime() || 0),
    );

  // 3. Message envoyé ? Lookup en parallèle des admin_broadcasts ciblés
  //    par clerk_user_id de chaque prospect.
  const prospectIds = flagged.map((g) => g.prospect_id);
  const messageSentSet = new Set<string>();
  if (prospectIds.length > 0) {
    const { data: prospects } = await admin
      .from("prospects")
      .select("id, clerk_user_id")
      .in("id", prospectIds);
    const clerkIds = (prospects ?? [])
      .map((p) => p.clerk_user_id)
      .filter((x): x is string => !!x);
    if (clerkIds.length > 0) {
      const { data: broadcasts } = await admin
        .from("admin_broadcasts")
        .select("target_clerk_user_id, created_by_admin_id")
        .in("target_clerk_user_id", clerkIds)
        .eq("created_by_admin_id", "system:non-atteint-auto");
      const clerkWithMsg = new Set(
        (broadcasts ?? []).map((b) => b.target_clerk_user_id).filter((x): x is string => !!x),
      );
      for (const p of prospects ?? []) {
        if (p.clerk_user_id && clerkWithMsg.has(p.clerk_user_id)) {
          messageSentSet.add(p.id);
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div
          className="text-[11px] uppercase"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
        >
          Prospects · Anti-fraude
        </div>
        <h1 className="text-xl font-medium" style={{ letterSpacing: "-0.01em" }}>
          Prospects non joignables
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)", maxWidth: 720 }}>
          Liste des prospects signalés <strong>non atteint</strong> au moins {threshold} fois par les
          professionnels (tous pros confondus). Ces utilisateurs ont accepté la sollicitation
          (et touché la rémunération) mais n'ont pas répondu aux tentatives de contact. Un message
          automatique gentil leur a été envoyé pour les rappeler à l'ordre.
        </p>
      </header>

      <div
        className="rounded-lg p-4"
        style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
      >
        {flagged.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            Aucun prospect non joignable pour le moment. 🎉
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "var(--ink-4)" }}>
                  <th className="text-left py-2 pr-3">Prospect</th>
                  <th className="text-left py-2 pr-3">Email</th>
                  <th className="text-left py-2 pr-3">Ville</th>
                  <th className="text-right py-2 pr-3"># signalements</th>
                  <th className="text-left py-2 pr-3">Pros à l'origine</th>
                  <th className="text-left py-2 pr-3">Dernier signalement</th>
                  <th className="text-left py-2">Message envoyé</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((g) => (
                  <tr
                    key={g.prospect_id}
                    style={{ borderTop: "1px solid var(--line-2)" }}
                  >
                    <td className="py-2 pr-3" style={{ color: "var(--ink)" }}>
                      <div>{g.name}</div>
                      <div
                        title={g.prospect_id}
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          color: "var(--ink-5)",
                        }}
                      >
                        {g.prospect_id.slice(0, 8)}…
                      </div>
                    </td>
                    <td
                      className="py-2 pr-3"
                      style={{ fontFamily: "var(--mono)", color: "var(--ink-3)" }}
                    >
                      {g.email}
                    </td>
                    <td className="py-2 pr-3" style={{ color: "var(--ink-3)" }}>
                      {g.ville}
                    </td>
                    <td
                      className="py-2 pr-3 text-right"
                      style={{
                        fontFamily: "var(--mono)",
                        color: g.count >= 3 ? "var(--danger)" : "var(--warn)",
                        fontWeight: 600,
                      }}
                    >
                      {g.count}
                    </td>
                    <td className="py-2 pr-3" style={{ color: "var(--ink-3)" }}>
                      {g.pros.length > 0 ? g.pros.join(", ") : "—"}
                    </td>
                    <td className="py-2 pr-3" style={{ color: "var(--ink-3)" }}>
                      {formatDate(g.lastFlaggedAt)}
                    </td>
                    <td className="py-2">
                      {messageSentSet.has(g.prospect_id) ? (
                        <span
                          style={{
                            color: "var(--good)",
                            background: "rgba(34, 197, 94, 0.08)",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          ✓ Envoyé
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-5)", fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs" style={{ color: "var(--ink-4)" }}>
        <Link href="/buupp-admin" className="underline" style={{ color: "var(--accent)" }}>
          ← Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
