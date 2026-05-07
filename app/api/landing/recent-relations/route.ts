/**
 * GET /api/landing/recent-relations — public, no auth required.
 * Renvoie les dernières mises en relation acceptées (status accepted ou
 * settled), anonymisées pour le live ticker de la home page (hero
 * section, bandeau qui défile de droite à gauche).
 *
 * Anonymisation :
 *   - côté pro : on n'expose ni la raison sociale, ni l'adresse — uniquement
 *     `secteur` (libre, ex. "Kiné", "Coach pro") + `ville`.
 *   - côté prospect : prénom + initiale du nom (ex. "Marie L.").
 *
 * Format :
 *   { relations: [{ id, sector, city, prenomMasked, rewardEur, decidedAt }] }
 *
 * Pas de RLS à contourner pour le client (admin ici), mais on filtre
 * en amont pour ne renvoyer que des champs non-sensibles.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ProJoin = { secteur: string | null; ville: string | null } | null;
type IdentityJoin = { prenom: string | null; nom: string | null } | null;
type ProspectJoin = { prospect_identity: IdentityJoin } | null;

type Row = {
  id: string;
  decided_at: string | null;
  reward_cents: number | string;
  pro_accounts: ProJoin;
  prospects: ProspectJoin;
};

function maskPrenom(prenom: string | null | undefined, nom: string | null | undefined): string {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  const prenomInitial = p ? `${p.charAt(0).toUpperCase()}.` : "";
  const nomInitial = n ? `${n.charAt(0).toUpperCase()}.` : "";
  const out = `${prenomInitial} ${nomInitial}`.trim();
  return out || "Anonyme";
}

export async function GET() {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("relations")
    .select(
      `id, decided_at, reward_cents,
       pro_accounts ( secteur, ville ),
       prospects:prospect_id ( prospect_identity ( prenom, nom ) )`,
    )
    .in("status", ["accepted", "settled"])
    .not("decided_at", "is", null)
    .order("decided_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[/api/landing/recent-relations] read failed", error);
    return NextResponse.json({ relations: [] });
  }

  const rows = (data ?? []) as unknown as Row[];

  // Mélange Fisher-Yates : chaque appel API renvoie les 30 dernières
  // acceptations dans un ordre aléatoire — le bandeau a ainsi l'air
  // "vivant" sans avoir à laisser tourner une animation côté client.
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }

  const relations = rows
    .map((r) => {
      const pro = Array.isArray(r.pro_accounts) ? r.pro_accounts[0] : r.pro_accounts;
      const pid = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
      const ident = pid?.prospect_identity
        ? Array.isArray(pid.prospect_identity)
          ? pid.prospect_identity[0]
          : pid.prospect_identity
        : null;
      const sector = (pro?.secteur ?? "").trim();
      const city = (pro?.ville ?? "").trim();
      const prenomMasked = maskPrenom(ident?.prenom, ident?.nom);
      const rewardEur = Number(r.reward_cents ?? 0) / 100;
      // Une ligne sans secteur ni ville n'apporte aucune info au ticker —
      // on la jette plutôt que d'afficher "—".
      if (!sector && !city) return null;
      return {
        id: r.id,
        sector,
        city,
        prenomMasked,
        rewardEur,
        decidedAt: r.decided_at,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ relations });
}
