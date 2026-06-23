/**
 * GET /api/pro/contacts — prospects ayant accepté une mise en relation
 * du pro courant. Email + téléphone watermarqués (politique d'usage BUUPP).
 *
 * Source : table `relations` filtrée sur status='accepted'|'settled' joint
 * sur prospect_identity / prospects / campaigns.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";
import { loadCampaignAudience } from "@/lib/pro/segmentation/load";
import { matchesFilters, sanitizeFilters } from "@/lib/pro/segmentation/filter";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";

export const runtime = "nodejs";

function maskEmail(e: string | null | undefined): string {
  if (!e) return "—";
  const at = e.indexOf("@");
  if (at < 0) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at);
  return local.slice(0, Math.max(1, local.length - 4)) + "•••" + domain;
}
function maskPhone(p: string | null | undefined): string {
  if (!p) return "—";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return p;
  const head = digits.slice(0, 2);
  const tail = digits.slice(-2);
  return `${head} •• •• •• ${tail}`;
}
function maskName(prenom: string | null | undefined, nom: string | null | undefined): string {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  const nomMasked = n ? `${n.charAt(0).toUpperCase()}.` : "";
  const out = `${p} ${nomMasked}`.trim();
  return out || "Prospect anonyme";
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  try {
    await settleRipeRelationsAndNotify(admin);
  } catch (err) {
    console.error("[/api/pro/contacts] lifecycle trigger failed", err);
  }
  // Raison sociale du pro courant — partagée par toutes les lignes,
  // utilisée par les templates email côté UI ({{pro}}).
  const { data: proRow } = await admin
    .from("pro_accounts")
    .select("raison_sociale")
    .eq("id", proId)
    .maybeSingle();
  const proName = (proRow?.raison_sociale ?? "").trim() || "Notre équipe";

  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId");
  let matchingIds: Set<string> | null = null;
  if (campaignId) {
    let filters = {};
    const raw = url.searchParams.get("filters");
    if (raw) {
      try { filters = JSON.parse(raw); } catch { filters = {}; }
    }
    const f = sanitizeFilters(filters);
    const audience = await loadCampaignAudience(admin, campaignId);
    // Ownership/clôture vérifiés implicitement par la requête principale ci-dessous
    // (pro_account_id + campaigns.status='completed') : si la campagne n'est pas au
    // pro ou pas clôturée, aucune ligne ne remontera de toute façon.
    matchingIds = new Set(
      (audience?.contacts ?? []).filter((c) => matchesFilters(c, f)).map((c) => c.relationId),
    );
  }

  let query = admin
    .from("relations")
    .select(
      `id, decided_at, status, campaign_id, evaluation, evaluated_at, pro_priority,
       campaigns!inner ( id, name, status, targeting, ends_at ),
       prospects:prospect_id ( id, bupp_score,
         prospect_identity ( prenom, nom, email, telephone )
       )`,
    )
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .order("decided_at", { ascending: false });
  if (campaignId) {
    // Atelier de segmentation (Statistiques) : réservé aux campagnes
    // clôturées (audience + révélation gated). On conserve donc le filtre.
    query = query.eq("campaign_id", campaignId).eq("campaigns.status", "completed");
  } else {
    // Vue groupée « Mes prospects » : on inclut aussi les campagnes EN COURS
    // (active/paused) afin qu'elles apparaissent dès le lancement. Leurs
    // lignes sont VERROUILLÉES (cf. `locked` plus bas) : coordonnées et
    // détails restent masqués jusqu'à la clôture (séquestre, proCanSeeContacts).
    query = query
      .in("campaigns.status", ["active", "paused", "completed"])
      .limit(200);
  }
  const { data, error } = await query;

  if (error) {
    console.error("[/api/pro/contacts] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    id: string;
    decided_at: string | null;
    status: string;
    campaign_id: string;
    evaluation: "atteint" | "non_atteint" | null;
    evaluated_at: string | null;
    pro_priority: number | null;
    campaigns: { id: string; name: string; status: string; targeting: { requiredTiers?: number[]; channels?: string[]; objectiveId?: string } | null; ends_at: string | null } | null;
    prospects: {
      id: string;
      bupp_score: number;
      prospect_identity: { prenom: string | null; nom: string | null; email: string | null; telephone: string | null } | null;
    } | null;
  };

  const ALL_CHANNELS = ["email", "phone", "sms", "whatsapp", "linkedin"];

  // Pré-calcul des compteurs d'emails déjà envoyés via BUUPP par couple
  // (prospect_id × campaign_id) pour ce pro. Un email_sent par couple
  // suffit à plafonner le quota côté UI (bouton "Écrire" désactivé).
  const relationFK = (data ?? []).map((r) => ({
    relationId: r.id,
    prospectId: r.prospects && !Array.isArray(r.prospects)
      ? (r.prospects as { id?: string }).id ?? null
      : Array.isArray(r.prospects) ? (r.prospects[0] as { id?: string })?.id ?? null : null,
    campaignId: r.campaign_id,
  }));
  const emailsSentByRel = new Map<string, number>();
  const prospectIds = Array.from(
    new Set(relationFK.map((x) => x.prospectId).filter((v): v is string => !!v)),
  );
  if (prospectIds.length > 0) {
    const { data: actions } = await admin
      .from("pro_contact_actions")
      .select("prospect_id, campaign_id, kind")
      .eq("pro_account_id", proId)
      .eq("kind", "email_sent")
      .in("prospect_id", prospectIds);
    const cnt = new Map<string, number>();
    for (const a of actions ?? []) {
      const key = `${a.prospect_id}|${a.campaign_id ?? ""}`;
      cnt.set(key, (cnt.get(key) ?? 0) + 1);
    }
    for (const f of relationFK) {
      if (!f.prospectId) continue;
      const key = `${f.prospectId}|${f.campaignId ?? ""}`;
      emailsSentByRel.set(f.relationId, cnt.get(key) ?? 0);
    }
  }

  // Agrégat de fiabilité CROSS-PRO par prospect — STRICTEMENT identique à la
  // fiche détail (fiabiliteAgg) : note la plus récente par pro DISTINCT, puis
  // COMPTE de pros par niveau ({ "1": n, "2": n, "3": n }). Le badge de la
  // liste « déplier » affiche ce compte (et non le n° de niveau), pour rester
  // cohérent avec la fiche (ex. 1 Haute + 1 Moyenne, pas « 2 Moyenne »).
  // NB : `priority` (plus bas) reste la note de CETTE relation (édition fiche).
  const fiabiliteAggByProspect = new Map<string, Record<string, number>>();
  if (prospectIds.length > 0) {
    const { data: ratingRows } = await admin
      .from("relations")
      .select("prospect_id, pro_account_id, pro_priority, decided_at")
      .in("prospect_id", prospectIds)
      .not("pro_priority", "is", null)
      .order("decided_at", { ascending: false });
    // prospect → (pro → note la plus récente). L'ordre desc garantit que la
    // 1re note vue pour un (prospect, pro) est la plus récente.
    const latestByProspectPro = new Map<string, Map<string, number>>();
    for (const rr of (ratingRows ?? []) as {
      prospect_id: string | null;
      pro_account_id: string | null;
      pro_priority: number | null;
    }[]) {
      if (!rr.prospect_id || !rr.pro_account_id || rr.pro_priority == null) continue;
      if (!latestByProspectPro.has(rr.prospect_id)) {
        latestByProspectPro.set(rr.prospect_id, new Map());
      }
      const m = latestByProspectPro.get(rr.prospect_id)!;
      if (!m.has(rr.pro_account_id)) m.set(rr.pro_account_id, rr.pro_priority);
    }
    for (const [pid, proMap] of latestByProspectPro) {
      const agg: Record<string, number> = { "1": 0, "2": 0, "3": 0 };
      for (const lvl of proMap.values()) {
        if (lvl === 1 || lvl === 2 || lvl === 3) agg[String(lvl)] += 1;
      }
      fiabiliteAggByProspect.set(pid, agg);
    }
  }

  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const id = (Array.isArray(r.prospects) ? r.prospects[0] : r.prospects) ?? null;
    const ident = id?.prospect_identity
      ? Array.isArray(id.prospect_identity)
        ? id.prospect_identity[0]
        : id.prospect_identity
      : null;
    const camp = (Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns) ?? null;
    const tiers = (camp?.targeting?.requiredTiers ?? [1]) as number[];
    const tier = Math.max(1, ...tiers.map((n) => Number(n) || 0));
    const fullName = maskName(ident?.prenom, ident?.nom);
    const declared = camp?.targeting?.channels;
    const campaignChannels = Array.isArray(declared) && declared.length > 0
      ? declared.filter((x): x is string => typeof x === "string")
      : ALL_CHANNELS;
    // Campagne non clôturée → ligne verrouillée : on n'expose AUCUNE
    // coordonnée (même watermarquée) ni accès détails/révélation (qui
    // renverraient 403 de toute façon). Seuls nom masqué + score + palier
    // + date + statut campagne sont visibles. Cf. proCanSeeContacts.
    const locked = !proCanSeeContacts(camp?.status);
    return {
      relationId: r.id,
      name: fullName,
      score: id?.bupp_score ?? 0,
      campaignId: camp?.id ?? r.campaign_id,
      campaign: camp?.name ?? "—",
      campaignObjective: camp?.targeting?.objectiveId ?? null,
      campaignClosesAt: camp?.ends_at ?? null,
      campaignStatus: camp?.status ?? null,
      // `locked` pilote l'UI : campagne en cours = pas de bouton détails,
      // pas d'actions de contact, coordonnées masquées (« 🔒 »).
      locked,
      campaignChannels,
      proName,
      tier,
      email: locked ? "—" : maskEmail(ident?.email),
      telephone: locked ? "—" : maskPhone(ident?.telephone),
      emailAvailable: locked ? false : !!ident?.email,
      telephoneAvailable: locked ? false : !!ident?.telephone,
      receivedAt: r.decided_at,
      evaluation: r.evaluation,
      evaluatedAt: r.evaluated_at,
      // Note de CETTE relation (éditée dans la fiche ProspectDetailsModal).
      priority: r.pro_priority ?? null,
      // Agrégat cross-pro { "1": n, "2": n, "3": n } (= compte de pros par
      // niveau, identique à la fiche détail). Les badges de la liste l'affichent.
      fiabiliteAgg: (id?.id && fiabiliteAggByProspect.get(id.id)) || null,
      // Niveaux présents (count > 0) — sert au filtre fiabilité.
      priorities: (() => {
        const agg = id?.id ? fiabiliteAggByProspect.get(id.id) : null;
        return agg ? [1, 2, 3].filter((l) => (agg[String(l)] ?? 0) > 0) : [];
      })(),
      // Compteur quota email — front masque/désactive le bouton "Écrire"
      // quand emailsSent atteint 1 (cf. /api/pro/contacts/[id]/email).
      emailsSent: emailsSentByRel.get(r.id) ?? 0,
    };
  });

  const filteredRows = matchingIds ? rows.filter((r) => matchingIds!.has(r.relationId)) : rows;
  return NextResponse.json({ rows: filteredRows, count: filteredRows.length });
}
