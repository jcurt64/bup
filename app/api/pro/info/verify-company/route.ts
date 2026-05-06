/**
 * GET /api/pro/info/verify-company?siren=… | siret=…
 *
 * Proxy vers l'API officielle "Recherche d'entreprises"
 * (https://recherche-entreprises.api.gouv.fr) — alimentée par la base
 * SIRENE de l'INSEE et publiée par data.gouv.fr. Gratuite, sans
 * authentification, retours stables.
 *
 * On renvoie les champs normalisés utiles à la facture pour permettre
 * au front de :
 *   - confirmer que le SIREN/SIRET existe bien (`found: true`)
 *   - comparer les valeurs saisies par l'utilisateur avec celles du
 *     registre officiel (mêmes raison sociale, adresse, ville…)
 *
 * Endpoint passe par notre back-end pour : (1) ne pas exposer les
 * appels CORS depuis le browser, (2) pouvoir mutualiser la mise en
 * cache si nécessaire plus tard, (3) homogénéiser les codes erreur.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/clerk/server";

export const runtime = "nodejs";

const API_BASE = "https://recherche-entreprises.api.gouv.fr";

// Mapping (INSEE) catégorie juridique → libellé court — sous-ensemble
// des formes les plus courantes côté pros BUUPP. Tout code non reconnu
// est laissé tel quel dans `formeJuridiqueCode`, sans casser le retour.
const CATEG_JURIDIQUE_LABELS: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "1100": "Auto-entrepreneur",
  "5202": "Société en nom collectif",
  "5306": "Société en commandite simple",
  "5499": "SARL",
  "5410": "SARL unipersonnelle (EURL)",
  "5710": "SAS",
  "5720": "SASU",
  "5505": "SA",
  "5515": "SA à conseil d'administration",
  "5530": "SA à directoire",
  "6532": "Société civile immobilière (SCI)",
  "9220": "Association déclarée",
  "9300": "Syndicat de copropriété",
  "5485": "Société d'exercice libéral (SEL)",
};

type ApiResult = {
  results?: Array<{
    siren?: string;
    nom_complet?: string;
    nom_raison_sociale?: string;
    siege?: {
      siret?: string;
      adresse?: string;
      code_postal?: string;
      libelle_commune?: string;
    };
    categorie_juridique?: string;
    etat_administratif?: string; // "A" = active, "C" = cessée
    date_creation?: string;
  }>;
  total_results?: number;
};

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sirenRaw = (url.searchParams.get("siren") ?? "").replace(/\s+/g, "");
  const siretRaw = (url.searchParams.get("siret") ?? "").replace(/\s+/g, "");

  if (!sirenRaw && !siretRaw) {
    return NextResponse.json(
      { error: "missing_identifier", message: "Renseignez un SIREN ou un SIRET." },
      { status: 400 },
    );
  }
  if (siretRaw && !/^\d{14}$/.test(siretRaw)) {
    return NextResponse.json(
      { error: "invalid_siret", message: "Le SIRET doit comporter 14 chiffres." },
      { status: 400 },
    );
  }
  if (sirenRaw && !/^\d{9}$/.test(sirenRaw)) {
    return NextResponse.json(
      { error: "invalid_siren", message: "Le SIREN doit comporter 9 chiffres." },
      { status: 400 },
    );
  }

  // Le SIRET commence par le SIREN ; on requête sur le SIRET quand
  // disponible pour atterrir directement sur l'établissement siège
  // ou secondaire concerné, sinon sur le SIREN.
  const query = siretRaw || sirenRaw;
  const apiUrl = `${API_BASE}/search?q=${encodeURIComponent(query)}&per_page=1`;

  let payload: ApiResult;
  try {
    const r = await fetch(apiUrl, {
      headers: { accept: "application/json" },
      // 8 s : l'API publique est rapide en pratique, mais on ne veut pas
      // bloquer indéfiniment l'UI si jamais elle ralentit.
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!r.ok) {
      console.error("[/api/pro/info/verify-company] upstream error", r.status);
      return NextResponse.json(
        { error: "upstream_failed", status: r.status },
        { status: 502 },
      );
    }
    payload = (await r.json()) as ApiResult;
  } catch (e) {
    console.error("[/api/pro/info/verify-company] fetch error", e);
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  const first = payload.results?.[0];
  if (!first || !first.siren) {
    return NextResponse.json({ found: false });
  }

  const formeJuridiqueCode = first.categorie_juridique ?? null;
  const formeJuridique = formeJuridiqueCode
    ? CATEG_JURIDIQUE_LABELS[formeJuridiqueCode] ?? null
    : null;

  return NextResponse.json({
    found: true,
    siren: first.siren,
    siret: first.siege?.siret ?? null,
    raisonSociale: first.nom_complet ?? first.nom_raison_sociale ?? null,
    adresse: first.siege?.adresse ?? null,
    ville: first.siege?.libelle_commune ?? null,
    codePostal: first.siege?.code_postal ?? null,
    formeJuridiqueCode,
    formeJuridique,
    actif: first.etat_administratif !== "C",
    dateCreation: first.date_creation ?? null,
    source: "recherche-entreprises.api.gouv.fr",
  });
}
