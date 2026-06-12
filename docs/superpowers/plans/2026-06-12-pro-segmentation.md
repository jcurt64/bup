# Atelier de segmentation pro — Implementation Plan (sous-projet 1/3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer « Mes contacts » en atelier de segmentation : vue d'audience agrégée (facettes) + filtres structurés + recherche texte + segments enregistrés, le tout par campagne, sans révéler aucune donnée brute supplémentaire.

**Architecture:** Logique pure isolée en libs testées (`lib/pro/segmentation/*` : décodage des contacts, construction des facettes, filtrage). Un loader IO charge les contacts acceptés d'une campagne (paliers achetés, hors paliers masqués). Une route `audience` renvoie les facettes ; la route `contacts` existante est étendue pour filtrer ; une table `pro_segments` persiste les segments (= critères JSON).

**Tech Stack:** Next.js (route handlers Node), Supabase (admin/service_role), Vitest, prototype React (`Pro.jsx`).

**Spec de référence :** `docs/superpowers/specs/2026-06-12-pro-segmentation-design.md`

---

## File Structure

- **Create** `lib/pro/segmentation/types.ts` — types partagés (`SegmentContact`, `TierKey`, `CategoricalKey`, `SegmentFilters`, `AudienceFacets`…).
- **Create** `lib/pro/segmentation/decode.ts` (+ test) — `decodeContacts()` pur : lignes DB → `SegmentContact[]` (paliers autorisés & non masqués uniquement).
- **Create** `lib/pro/segmentation/facets.ts` (+ test) — `buildFacets()` pur : distributions agrégées.
- **Create** `lib/pro/segmentation/filter.ts` (+ test) — `matchesFilters()` + `sanitizeFilters()` purs.
- **Create** `lib/pro/segmentation/load.ts` — `loadCampaignAudience()` IO (charge + décode). Pas de test unitaire (IO ; couvert par decode + API).
- **Create** `app/api/pro/campaigns/[id]/audience/route.ts` — renvoie facettes + total + paliers + segments.
- **Modify** `app/api/pro/contacts/route.ts` — params `campaignId` + `filters` (rétro-compatible).
- **Create** `app/api/pro/segments/route.ts` (GET liste / POST créer) + `app/api/pro/segments/[id]/route.ts` (DELETE).
- **Create** `supabase/migrations/<ts>_pro_segments.sql` — table + RLS.
- **Modify** `public/prototype/components/Pro.jsx` — section Contacts : panneau audience, facettes, recherche, segments.

---

## Task 1: Types partagés + décodage des contacts (pur, TDD)

**Files:**
- Create: `lib/pro/segmentation/types.ts`
- Create: `lib/pro/segmentation/decode.ts`
- Test: `lib/pro/segmentation/decode.test.ts`

- [ ] **Step 1: Créer les types** (`lib/pro/segmentation/types.ts`)

```ts
/** Types partagés de l'atelier de segmentation pro. */

export type TierKey = "identity" | "localisation" | "vie" | "pro" | "patrimoine";

/** Contact normalisé pour la segmentation. Chaque bloc palier n'est présent
 *  que si le palier est acheté pour la campagne ET non masqué par le prospect.
 *  Aucune donnée de contact sensible (email/téléphone) n'y figure : on ne
 *  segmente que sur des attributs, jamais sur des identifiants. */
export type SegmentContact = {
  relationId: string;
  score: number;
  reached: "atteint" | "non_atteint" | null;
  identity?: { prenom: string | null; nom: string | null };
  localisation?: { region: string | null; ville: string | null; codePostal: string | null; adresse: string | null };
  vie?: { foyer: string | null; sports: string | null; animaux: string | null; vehicule: string | null; logement: string | null; mobilite: string | null };
  pro?: { poste: string | null; statut: string | null; secteur: string | null; revenus: string | null };
  patrimoine?: { residence: string | null; epargne: string | null; projets: string | null };
};

/** Champs catégoriels facettables + leur palier source. */
export type CategoricalKey = "region" | "revenus" | "epargne" | "logement" | "statutPro" | "foyer" | "vehicule" | "animaux";

export type SegmentFilters = {
  scoreMin?: number;
  scoreMax?: number;
  reached?: "atteint" | "non_atteint";
  q?: string;
  region?: string[];
  revenus?: string[];
  epargne?: string[];
  logement?: string[];
  statutPro?: string[];
  foyer?: string[];
  vehicule?: string[];
  animaux?: string[];
};

export type FacetCount = { value: string; count: number };
export type ScoreBucket = { label: string; count: number };

export type AudienceFacets = {
  total: number;
  score: ScoreBucket[];
  reached: FacetCount[];
} & Partial<Record<CategoricalKey, FacetCount[]>>;
```

- [ ] **Step 2: Écrire le test qui échoue** (`lib/pro/segmentation/decode.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { decodeContacts, type DecodeInput } from "./decode";
import type { TierKey } from "./types";

function input(over: Partial<DecodeInput> = {}): DecodeInput {
  return {
    relations: [{ relationId: "r1", prospectId: "p1", score: 730, evaluation: "atteint" }],
    blockedByProspect: new Map(),
    tierData: {
      identity: new Map([["p1", { prenom: "Léa", nom: "Martin" }]]),
      localisation: new Map([["p1", { region: "Rhône", ville: "Lyon", code_postal: "69003", adresse: "1 rue X" }]]),
      pro: new Map([["p1", { poste: "Dev", statut: "Salarié", secteur: "Tech", revenus: "30-40k" }]]),
    },
    campaignTiers: ["identity", "localisation", "pro"] as TierKey[],
    ...over,
  };
}

describe("decodeContacts", () => {
  it("decodes allowed tiers into structured blocks", () => {
    const [c] = decodeContacts(input());
    expect(c.relationId).toBe("r1");
    expect(c.score).toBe(730);
    expect(c.reached).toBe("atteint");
    expect(c.identity).toEqual({ prenom: "Léa", nom: "Martin" });
    expect(c.localisation?.region).toBe("Rhône");
    expect(c.localisation?.codePostal).toBe("69003");
    expect(c.pro?.revenus).toBe("30-40k");
  });

  it("omits tiers not purchased by the campaign", () => {
    const [c] = decodeContacts(input({ campaignTiers: ["identity"] as TierKey[] }));
    expect(c.identity).toBeDefined();
    expect(c.localisation).toBeUndefined();
    expect(c.pro).toBeUndefined();
  });

  it("omits tiers the prospect blocked (removed/hidden)", () => {
    const blocked = new Map([["p1", new Set<TierKey>(["pro"])]]);
    const [c] = decodeContacts(input({ blockedByProspect: blocked }));
    expect(c.localisation).toBeDefined();
    expect(c.pro).toBeUndefined();
  });

  it("trims empty strings to null and tolerates missing tier rows", () => {
    const [c] = decodeContacts(
      input({ tierData: { identity: new Map([["p1", { prenom: "  ", nom: "Martin" }]]) }, campaignTiers: ["identity"] as TierKey[] }),
    );
    expect(c.identity).toEqual({ prenom: null, nom: "Martin" });
  });
});
```

- [ ] **Step 3: Lancer le test (échec attendu)**

Run: `npx vitest run lib/pro/segmentation/decode.test.ts`
Expected: FAIL — `Cannot find module './decode'`.

- [ ] **Step 4: Implémenter** (`lib/pro/segmentation/decode.ts`)

```ts
import type { SegmentContact, TierKey } from "./types";

export type RelationInput = {
  relationId: string;
  prospectId: string;
  score: number;
  evaluation: "atteint" | "non_atteint" | null;
};

export type DecodeInput = {
  relations: RelationInput[];
  /** prospectId → paliers masqués/supprimés (removed ∪ hidden). */
  blockedByProspect: Map<string, Set<TierKey>>;
  /** palier → (prospectId → ligne brute de la table palier). */
  tierData: Partial<Record<TierKey, Map<string, Record<string, unknown>>>>;
  /** paliers payés par la campagne (requiredTiers → clés). */
  campaignTiers: TierKey[];
};

function s(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

export function decodeContacts(input: DecodeInput): SegmentContact[] {
  const { relations, blockedByProspect, tierData, campaignTiers } = input;
  const camp = new Set(campaignTiers);
  return relations.map((r) => {
    const blocked = blockedByProspect.get(r.prospectId) ?? new Set<TierKey>();
    const has = (k: TierKey) => camp.has(k) && !blocked.has(k);
    const row = (k: TierKey) => tierData[k]?.get(r.prospectId) ?? {};
    const c: SegmentContact = { relationId: r.relationId, score: r.score, reached: r.evaluation };
    if (has("identity")) {
      const t = row("identity");
      c.identity = { prenom: s(t.prenom), nom: s(t.nom) };
    }
    if (has("localisation")) {
      const t = row("localisation");
      c.localisation = { region: s(t.region), ville: s(t.ville), codePostal: s(t.code_postal), adresse: s(t.adresse) };
    }
    if (has("vie")) {
      const t = row("vie");
      c.vie = { foyer: s(t.foyer), sports: s(t.sports), animaux: s(t.animaux), vehicule: s(t.vehicule), logement: s(t.logement), mobilite: s(t.mobilite) };
    }
    if (has("pro")) {
      const t = row("pro");
      c.pro = { poste: s(t.poste), statut: s(t.statut), secteur: s(t.secteur), revenus: s(t.revenus) };
    }
    if (has("patrimoine")) {
      const t = row("patrimoine");
      c.patrimoine = { residence: s(t.residence), epargne: s(t.epargne), projets: s(t.projets) };
    }
    return c;
  });
}
```

- [ ] **Step 5: Lancer le test (succès attendu)**

Run: `npx vitest run lib/pro/segmentation/decode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/pro/segmentation/types.ts lib/pro/segmentation/decode.ts lib/pro/segmentation/decode.test.ts
git commit -m "feat(pro/segmentation): types + decodeContacts (paliers autorisés/non masqués)"
```

---

## Task 2: Construction des facettes (pur, TDD)

**Files:**
- Create: `lib/pro/segmentation/facets.ts`
- Test: `lib/pro/segmentation/facets.test.ts`

- [ ] **Step 1: Écrire le test qui échoue** (`lib/pro/segmentation/facets.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { buildFacets } from "./facets";
import type { SegmentContact, TierKey } from "./types";

function c(over: Partial<SegmentContact>): SegmentContact {
  return { relationId: Math.random().toString(), score: 700, reached: null, ...over };
}

describe("buildFacets", () => {
  it("buckets scores into <600 / 600-719 / ≥720", () => {
    const f = buildFacets(
      [c({ score: 500 }), c({ score: 650 }), c({ score: 720 }), c({ score: 800 })],
      [],
    );
    expect(f.total).toBe(4);
    expect(f.score).toEqual([
      { label: "< 600", count: 1 },
      { label: "600 – 719", count: 1 },
      { label: "≥ 720", count: 2 },
    ]);
  });

  it("counts reached status including 'Non évalué'", () => {
    const f = buildFacets([c({ reached: "atteint" }), c({ reached: "non_atteint" }), c({ reached: null })], []);
    expect(f.reached).toEqual(
      expect.arrayContaining([
        { value: "Atteint", count: 1 },
        { value: "Non atteint", count: 1 },
        { value: "Non évalué", count: 1 },
      ]),
    );
  });

  it("includes a categorical facet only when its tier is allowed", () => {
    const contacts = [c({ pro: { poste: null, statut: "Salarié", secteur: null, revenus: null } })];
    expect(buildFacets(contacts, [])["statutPro"]).toBeUndefined();
    expect(buildFacets(contacts, ["pro"] as TierKey[])["statutPro"]).toEqual([{ value: "Salarié", count: 1 }]);
  });

  it("sorts categories by count desc and ignores null/empty values", () => {
    const mk = (region: string | null) => c({ localisation: { region, ville: null, codePostal: null, adresse: null } });
    const f = buildFacets([mk("Rhône"), mk("Rhône"), mk("Paris"), mk(null), mk("  ")], ["localisation"] as TierKey[]);
    expect(f["region"]).toEqual([
      { value: "Rhône", count: 2 },
      { value: "Paris", count: 1 },
    ]);
  });

  it("collapses categories beyond the top 12 into 'Autres'", () => {
    const contacts: SegmentContact[] = [];
    for (let i = 0; i < 15; i++) contacts.push(c({ localisation: { region: `R${i}`, ville: null, codePostal: null, adresse: null } }));
    const region = buildFacets(contacts, ["localisation"] as TierKey[])["region"]!;
    expect(region).toHaveLength(13); // 12 + "Autres"
    expect(region[12]).toEqual({ value: "Autres", count: 3 });
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run lib/pro/segmentation/facets.test.ts`
Expected: FAIL — `Cannot find module './facets'`.

- [ ] **Step 3: Implémenter** (`lib/pro/segmentation/facets.ts`)

```ts
import type { SegmentContact, TierKey, CategoricalKey, AudienceFacets, FacetCount } from "./types";

const TOP_N = 12;

const CATEGORICAL: { key: CategoricalKey; tier: TierKey; get: (c: SegmentContact) => string | null | undefined }[] = [
  { key: "region", tier: "localisation", get: (c) => c.localisation?.region },
  { key: "revenus", tier: "pro", get: (c) => c.pro?.revenus },
  { key: "epargne", tier: "patrimoine", get: (c) => c.patrimoine?.epargne },
  { key: "logement", tier: "vie", get: (c) => c.vie?.logement },
  { key: "statutPro", tier: "pro", get: (c) => c.pro?.statut },
  { key: "foyer", tier: "vie", get: (c) => c.vie?.foyer },
  { key: "vehicule", tier: "vie", get: (c) => c.vie?.vehicule },
  { key: "animaux", tier: "vie", get: (c) => c.vie?.animaux },
];

function countCategory(contacts: SegmentContact[], get: (c: SegmentContact) => string | null | undefined): FacetCount[] {
  const counts = new Map<string, number>();
  for (const c of contacts) {
    const v = (get(c) ?? "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
  if (sorted.length <= TOP_N) return sorted;
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N).reduce((acc, x) => acc + x.count, 0);
  top.push({ value: "Autres", count: rest });
  return top;
}

export function buildFacets(contacts: SegmentContact[], allowedTiers: TierKey[]): AudienceFacets {
  const allowed = new Set(allowedTiers);

  let lo = 0, mid = 0, hi = 0;
  for (const c of contacts) {
    if (c.score >= 720) hi++;
    else if (c.score >= 600) mid++;
    else lo++;
  }
  const score = [
    { label: "< 600", count: lo },
    { label: "600 – 719", count: mid },
    { label: "≥ 720", count: hi },
  ];

  const reachedCounts = new Map<string, number>();
  for (const c of contacts) {
    const k = c.reached === "atteint" ? "Atteint" : c.reached === "non_atteint" ? "Non atteint" : "Non évalué";
    reachedCounts.set(k, (reachedCounts.get(k) ?? 0) + 1);
  }
  const reached: FacetCount[] = [...reachedCounts.entries()].map(([value, count]) => ({ value, count }));

  const out: AudienceFacets = { total: contacts.length, score, reached };
  for (const f of CATEGORICAL) {
    if (!allowed.has(f.tier)) continue;
    out[f.key] = countCategory(contacts, f.get);
  }
  return out;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run lib/pro/segmentation/facets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pro/segmentation/facets.ts lib/pro/segmentation/facets.test.ts
git commit -m "feat(pro/segmentation): buildFacets — buckets score + comptages catégoriels (top 12 + Autres)"
```

---

## Task 3: Filtres + sanitation (pur, TDD)

**Files:**
- Create: `lib/pro/segmentation/filter.ts`
- Test: `lib/pro/segmentation/filter.test.ts`

- [ ] **Step 1: Écrire le test qui échoue** (`lib/pro/segmentation/filter.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { matchesFilters, sanitizeFilters } from "./filter";
import type { SegmentContact } from "./types";

function c(over: Partial<SegmentContact>): SegmentContact {
  return { relationId: "r", score: 700, reached: null, ...over };
}

describe("matchesFilters", () => {
  it("filters by score range (inclusive)", () => {
    expect(matchesFilters(c({ score: 720 }), { scoreMin: 720 })).toBe(true);
    expect(matchesFilters(c({ score: 719 }), { scoreMin: 720 })).toBe(false);
    expect(matchesFilters(c({ score: 800 }), { scoreMax: 750 })).toBe(false);
  });

  it("filters by reached", () => {
    expect(matchesFilters(c({ reached: "atteint" }), { reached: "atteint" })).toBe(true);
    expect(matchesFilters(c({ reached: null }), { reached: "atteint" })).toBe(false);
  });

  it("filters by categorical multiselect; null value never matches", () => {
    const withRegion = c({ localisation: { region: "Rhône", ville: null, codePostal: null, adresse: null } });
    expect(matchesFilters(withRegion, { region: ["Rhône", "Paris"] })).toBe(true);
    expect(matchesFilters(withRegion, { region: ["Paris"] })).toBe(false);
    expect(matchesFilters(c({}), { region: ["Rhône"] })).toBe(false);
  });

  it("ANDs all criteria", () => {
    const ct = c({ score: 730, localisation: { region: "Rhône", ville: null, codePostal: null, adresse: null } });
    expect(matchesFilters(ct, { scoreMin: 720, region: ["Rhône"] })).toBe(true);
    expect(matchesFilters(ct, { scoreMin: 740, region: ["Rhône"] })).toBe(false);
  });

  it("free-text q is case/accent-insensitive over allowed soft fields only", () => {
    const ct = c({ pro: { poste: "Médecin", statut: null, secteur: null, revenus: null } });
    expect(matchesFilters(ct, { q: "medecin" })).toBe(true);
    expect(matchesFilters(ct, { q: "avocat" })).toBe(false);
    // pas de bloc pro → pas matchable par un terme pro
    expect(matchesFilters(c({}), { q: "medecin" })).toBe(false);
  });
});

describe("sanitizeFilters", () => {
  it("keeps known fields, drops unknown, bounds arrays and q", () => {
    const f = sanitizeFilters({
      scoreMin: 600, scoreMax: "x", reached: "atteint", q: "  Lyon  ",
      region: ["Rhône", 42, "Paris"], evil: ["x"],
    });
    expect(f.scoreMin).toBe(600);
    expect(f.scoreMax).toBeUndefined();
    expect(f.reached).toBe("atteint");
    expect(f.q).toBe("Lyon");
    expect(f.region).toEqual(["Rhône", "Paris"]);
    expect((f as Record<string, unknown>).evil).toBeUndefined();
  });

  it("returns {} on non-object input", () => {
    expect(sanitizeFilters(null)).toEqual({});
    expect(sanitizeFilters("nope")).toEqual({});
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run lib/pro/segmentation/filter.test.ts`
Expected: FAIL — `Cannot find module './filter'`.

- [ ] **Step 3: Implémenter** (`lib/pro/segmentation/filter.ts`)

```ts
import type { SegmentContact, SegmentFilters, CategoricalKey } from "./types";

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const CATEGORICAL_GET: Record<CategoricalKey, (c: SegmentContact) => string | null | undefined> = {
  region: (c) => c.localisation?.region,
  revenus: (c) => c.pro?.revenus,
  epargne: (c) => c.patrimoine?.epargne,
  logement: (c) => c.vie?.logement,
  statutPro: (c) => c.pro?.statut,
  foyer: (c) => c.vie?.foyer,
  vehicule: (c) => c.vie?.vehicule,
  animaux: (c) => c.vie?.animaux,
};

const CATEGORICAL_KEYS = Object.keys(CATEGORICAL_GET) as CategoricalKey[];

function searchableText(c: SegmentContact): string {
  const parts = [
    c.identity?.prenom, c.identity?.nom,
    c.localisation?.region, c.localisation?.ville, c.localisation?.adresse,
    c.vie?.sports, c.vie?.foyer, c.vie?.vehicule, c.vie?.logement, c.vie?.mobilite, c.vie?.animaux,
    c.pro?.poste, c.pro?.statut, c.pro?.secteur, c.pro?.revenus,
    c.patrimoine?.residence, c.patrimoine?.epargne, c.patrimoine?.projets,
  ];
  return norm(parts.filter(Boolean).join(" "));
}

export function matchesFilters(c: SegmentContact, f: SegmentFilters): boolean {
  if (f.scoreMin != null && c.score < f.scoreMin) return false;
  if (f.scoreMax != null && c.score > f.scoreMax) return false;
  if (f.reached && c.reached !== f.reached) return false;
  for (const key of CATEGORICAL_KEYS) {
    const wanted = f[key];
    if (wanted && wanted.length > 0) {
      const v = (CATEGORICAL_GET[key](c) ?? "").trim();
      if (!v || !wanted.includes(v)) return false;
    }
  }
  if (f.q && f.q.trim()) {
    if (!searchableText(c).includes(norm(f.q))) return false;
  }
  return true;
}

export function sanitizeFilters(raw: unknown): SegmentFilters {
  const out: SegmentFilters = {};
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const sMin = num(o.scoreMin);
  if (sMin != null) out.scoreMin = sMin;
  const sMax = num(o.scoreMax);
  if (sMax != null) out.scoreMax = sMax;
  if (o.reached === "atteint" || o.reached === "non_atteint") out.reached = o.reached;
  if (typeof o.q === "string" && o.q.trim()) out.q = o.q.trim().slice(0, 100);
  for (const key of CATEGORICAL_KEYS) {
    const v = o[key];
    if (Array.isArray(v)) {
      const arr = v.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, 80)).slice(0, 50);
      if (arr.length > 0) out[key] = arr;
    }
  }
  return out;
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run lib/pro/segmentation/filter.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/pro/segmentation/filter.ts lib/pro/segmentation/filter.test.ts
git commit -m "feat(pro/segmentation): matchesFilters + sanitizeFilters (ET critères, recherche texte, whitelist)"
```

---

## Task 4: Loader IO `loadCampaignAudience`

**Files:**
- Create: `lib/pro/segmentation/load.ts`

> IO pur (Supabase) → pas de test unitaire ; validé par tsc + les routes/Tâche 9. Réutilise `tierNumsToKeys` (`lib/campaigns/mapping.ts`) et `decodeContacts`.

- [ ] **Step 1: Implémenter** (`lib/pro/segmentation/load.ts`)

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { tierNumsToKeys } from "@/lib/campaigns/mapping";
import { decodeContacts, type RelationInput } from "./decode";
import type { SegmentContact, TierKey } from "./types";

const TIER_TABLE: Record<TierKey, string> = {
  identity: "prospect_identity",
  localisation: "prospect_localisation",
  vie: "prospect_vie",
  pro: "prospect_pro",
  patrimoine: "prospect_patrimoine",
};

const TIER_COLS: Record<TierKey, string> = {
  identity: "prospect_id, prenom, nom",
  localisation: "prospect_id, region, ville, code_postal, adresse",
  vie: "prospect_id, foyer, sports, animaux, vehicule, logement, mobilite",
  pro: "prospect_id, poste, statut, secteur, revenus",
  patrimoine: "prospect_id, residence, epargne, projets",
};

export type CampaignAudience = {
  status: string | null;
  proAccountId: string | null;
  allowedTiers: TierKey[];
  contacts: SegmentContact[];
};

/** Charge les contacts acceptés/settled d'une campagne, décodés sur les
 *  paliers achetés (requiredTiers) et hors paliers masqués/supprimés par
 *  chaque prospect. NE vérifie PAS l'ownership ni la clôture : c'est à la
 *  route appelante de gater (proAccountId / status renvoyés pour ça). */
export async function loadCampaignAudience(
  admin: SupabaseClient,
  campaignId: string,
): Promise<CampaignAudience | null> {
  const { data: camp } = await admin
    .from("campaigns")
    .select("id, status, pro_account_id, targeting")
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) return null;

  const requiredNums = ((camp.targeting as { requiredTiers?: number[] } | null)?.requiredTiers ?? [1]) as number[];
  const allowedTiers = tierNumsToKeys(requiredNums) as TierKey[];

  const { data: rels } = await admin
    .from("relations")
    .select("id, evaluation, prospects:prospect_id ( id, bupp_score, removed_tiers, hidden_tiers )")
    .eq("campaign_id", campaignId)
    .in("status", ["accepted", "settled"]);

  const relations: RelationInput[] = [];
  const blockedByProspect = new Map<string, Set<TierKey>>();
  for (const r of (rels ?? []) as Array<{
    id: string;
    evaluation: "atteint" | "non_atteint" | null;
    prospects: { id: string; bupp_score: number | null; removed_tiers: string[] | null; hidden_tiers: string[] | null }
      | { id: string; bupp_score: number | null; removed_tiers: string[] | null; hidden_tiers: string[] | null }[]
      | null;
  }>) {
    const p = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
    if (!p) continue;
    relations.push({ relationId: r.id, prospectId: p.id, score: p.bupp_score ?? 0, evaluation: r.evaluation ?? null });
    blockedByProspect.set(
      p.id,
      new Set<TierKey>([...((p.removed_tiers ?? []) as TierKey[]), ...((p.hidden_tiers ?? []) as TierKey[])]),
    );
  }

  const prospectIds = relations.map((r) => r.prospectId);
  const tierData: Partial<Record<TierKey, Map<string, Record<string, unknown>>>> = {};
  if (prospectIds.length > 0) {
    for (const key of allowedTiers) {
      const { data: rows } = await admin.from(TIER_TABLE[key]).select(TIER_COLS[key]).in("prospect_id", prospectIds);
      const m = new Map<string, Record<string, unknown>>();
      for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
        m.set(String(row.prospect_id), row);
      }
      tierData[key] = m;
    }
  }

  const contacts = decodeContacts({ relations, blockedByProspect, tierData, campaignTiers: allowedTiers });
  return {
    status: (camp.status as string | null) ?? null,
    proAccountId: (camp.pro_account_id as string | null) ?? null,
    allowedTiers,
    contacts,
  };
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/pro/segmentation/load.ts
git commit -m "feat(pro/segmentation): loadCampaignAudience (charge + décode les contacts d'une campagne)"
```

---

## Task 5: Route `GET /api/pro/campaigns/[id]/audience`

**Files:**
- Create: `app/api/pro/campaigns/[id]/audience/route.ts`

- [ ] **Step 1: Implémenter la route**

```ts
/**
 * GET /api/pro/campaigns/[id]/audience — distributions agrégées (facettes)
 * des contacts ayant accepté la campagne, pour l'atelier de segmentation.
 * Gating identique aux contacts : pro propriétaire + campagne `completed`.
 * Ne renvoie AUCUNE donnée brute (que des comptages) → neutre côté exfil.
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import { loadCampaignAudience } from "@/lib/pro/segmentation/load";
import { buildFacets } from "@/lib/pro/segmentation/facets";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_campaign_id" }, { status: 400 });

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const audience = await loadCampaignAudience(admin, id);
  if (!audience || audience.proAccountId !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!proCanSeeContacts(audience.status)) {
    return NextResponse.json({ error: "campaign_not_closed" }, { status: 403 });
  }

  const facets = buildFacets(audience.contacts, audience.allowedTiers);

  const { data: segs } = await admin
    .from("pro_segments")
    .select("id, name, filters, created_at")
    .eq("pro_account_id", proId)
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    total: audience.contacts.length,
    availableTiers: audience.allowedTiers,
    facets,
    savedSegments: segs ?? [],
  });
}
```

- [ ] **Step 2: Vérifier compilation + lint**

Run: `npx tsc --noEmit && npx eslint app/api/pro/campaigns/[id]/audience/route.ts`
Expected: aucune erreur. (La table `pro_segments` n'existe pas encore en local — c'est OK, le `select` n'est pas typé strictement ; si tsc se plaint d'un type de table inconnue, garde le code tel quel : la table sera créée Tâche 7 et le client Supabase admin n'est pas typé sur le schéma généré ici.)

- [ ] **Step 3: Commit**

```bash
git add "app/api/pro/campaigns/[id]/audience/route.ts"
git commit -m "feat(pro/segmentation): route audience (facettes + segments) gatée completed+owner"
```

---

## Task 6: Étendre `GET /api/pro/contacts` (filtrage par segment)

**Files:**
- Modify: `app/api/pro/contacts/route.ts`

> La route renvoie aujourd'hui ≤200 lignes masquées pour TOUTES les campagnes du pro. On ajoute un **mode filtré** : si `campaignId` est présent, on restreint à cette campagne et on filtre via `matchesFilters` sur les `relationId` retenus. **Rétro-compatible** : sans `campaignId`, comportement inchangé. Le masking/gating restent identiques.

- [ ] **Step 1: Ajouter les imports**

En tête de `app/api/pro/contacts/route.ts`, après les imports existants :

```ts
import { loadCampaignAudience } from "@/lib/pro/segmentation/load";
import { matchesFilters, sanitizeFilters } from "@/lib/pro/segmentation/filter";
```

- [ ] **Step 2: Passer `req` au handler et parser les params**

Changer la signature `export async function GET()` → `export async function GET(req: Request)`. Juste après l'obtention de `proId` et la création de `admin` (après le bloc `settleRipeRelationsAndNotify`), ajouter :

```ts
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
```

- [ ] **Step 3: Restreindre la requête principale à la campagne (si filtrée)**

Dans le `.select(...)` principal de la requête `relations`, après `.eq("campaigns.status", "completed")`, ajouter une restriction conditionnelle. Remplacer :

```ts
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .eq("campaigns.status", "completed")
    .order("decided_at", { ascending: false })
    .limit(200);
```

par :

```ts
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .eq("campaigns.status", "completed")
    .order("decided_at", { ascending: false });
```

…et insérer, juste avant ce chaînage, l'application conditionnelle du filtre campagne. Concrètement, remplacer la construction directe `const { data, error } = await admin.from("relations").select(...)...` par une requête construite en deux temps :

```ts
  let query = admin
    .from("relations")
    .select(
      `id, decided_at, status, campaign_id, evaluation, evaluated_at,
       campaigns!inner ( id, name, status, targeting ),
       prospects:prospect_id ( id, bupp_score,
         prospect_identity ( prenom, nom, email, telephone )
       )`,
    )
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .eq("campaigns.status", "completed")
    .order("decided_at", { ascending: false });
  if (campaignId) query = query.eq("campaign_id", campaignId);
  else query = query.limit(200);
  const { data, error } = await query;
```

(On retire le `.limit(200)` du mode filtré : une campagne ≤ ~quelques centaines, on veut tout le sous-ensemble filtré.)

- [ ] **Step 4: Appliquer le filtre `matchingIds` après construction des lignes**

À la fin, remplacer :

```ts
  return NextResponse.json({ rows });
```

par :

```ts
  const filteredRows = matchingIds ? rows.filter((r) => matchingIds!.has(r.relationId)) : rows;
  return NextResponse.json({ rows: filteredRows, count: filteredRows.length });
```

- [ ] **Step 5: Vérifier compilation + lint**

Run: `npx tsc --noEmit && npx eslint app/api/pro/contacts/route.ts`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add app/api/pro/contacts/route.ts
git commit -m "feat(pro/segmentation): /api/pro/contacts — mode filtré par campagne+segment (rétro-compatible)"
```

---

## Task 7: Migration `pro_segments` + routes segments

**Files:**
- Create: `supabase/migrations/20260612120000_pro_segments.sql`
- Create: `app/api/pro/segments/route.ts`
- Create: `app/api/pro/segments/[id]/route.ts`

- [ ] **Step 1: Écrire la migration** (`supabase/migrations/20260612120000_pro_segments.sql`)

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Segments enregistrés (atelier de segmentation pro)
-- ════════════════════════════════════════════════════════════════════
-- Un segment = un jeu de critères de filtre (JSON) nommé, attaché à une
-- campagne. Réévalué à l'ouverture (pas une liste figée d'IDs).
-- RLS activée sans policy : accès via service_role uniquement (comme
-- pro_contact_clicks / pro_contact_reveals).
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.pro_segments (
  id uuid primary key default gen_random_uuid(),
  pro_account_id uuid not null references public.pro_accounts(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pro_segments_pro_campaign_idx
  on public.pro_segments (pro_account_id, campaign_id, created_at desc);

alter table public.pro_segments enable row level security;
-- Aucune policy : seul service_role lit / écrit (ownership vérifié côté route).
```

- [ ] **Step 2: Appliquer la migration au remote**

Cette migration s'applique **manuellement via le SQL Editor Supabase + `migration repair`** (jamais `db push`), conformément au process du projet. Copier le SQL ci-dessus dans le SQL Editor du projet `buupp` (yalgztstdmytviiyvixz), exécuter, puis marquer la migration appliquée :

Run: `npx supabase migration repair --status applied 20260612120000`
Expected: la migration `20260612120000` est marquée appliquée.

- [ ] **Step 3: Implémenter la route liste/création** (`app/api/pro/segments/route.ts`)

```ts
/**
 * /api/pro/segments — segments enregistrés du pro (atelier de segmentation).
 *   GET ?campaignId= → liste les segments du pro pour la campagne.
 *   POST { campaignId, name, filters } → crée un segment (filters sanités).
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { sanitizeFilters } from "@/lib/pro/segmentation/filter";

export const runtime = "nodejs";

async function getProId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  return ensureProAccount({ clerkUserId: userId, email });
}

export async function GET(req: Request) {
  const proId = await getProId();
  if (!proId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const campaignId = new URL(req.url).searchParams.get("campaignId");
  if (!campaignId) return NextResponse.json({ error: "missing_campaign_id" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("pro_segments")
    .select("id, name, filters, created_at")
    .eq("pro_account_id", proId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[/api/pro/segments GET] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  return NextResponse.json({ segments: data ?? [] });
}

export async function POST(req: Request) {
  const proId = await getProId();
  if (!proId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const o = (body ?? {}) as Record<string, unknown>;
  const campaignId = typeof o.campaignId === "string" ? o.campaignId : null;
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 80) : "";
  if (!campaignId || !name) return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  const filters = sanitizeFilters(o.filters);

  const admin = createSupabaseAdminClient();
  // Ownership de la campagne : on n'enregistre un segment que sur une campagne du pro.
  const { data: camp } = await admin
    .from("campaigns").select("pro_account_id").eq("id", campaignId).maybeSingle();
  if (!camp || (camp as { pro_account_id?: string }).pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("pro_segments")
    .insert({ pro_account_id: proId, campaign_id: campaignId, name, filters })
    .select("id, name, filters, created_at")
    .maybeSingle();
  if (error) {
    console.error("[/api/pro/segments POST] insert failed", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ segment: data });
}
```

- [ ] **Step 4: Implémenter la suppression** (`app/api/pro/segments/[id]/route.ts`)

```ts
/** DELETE /api/pro/segments/[id] — supprime un segment du pro (ownership). */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("pro_segments")
    .delete()
    .eq("id", id)
    .eq("pro_account_id", proId);
  if (error) {
    console.error("[/api/pro/segments DELETE] failed", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Vérifier compilation + lint**

Run: `npx tsc --noEmit && npx eslint app/api/pro/segments/route.ts "app/api/pro/segments/[id]/route.ts"`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260612120000_pro_segments.sql app/api/pro/segments/route.ts "app/api/pro/segments/[id]/route.ts"
git commit -m "feat(pro/segmentation): table pro_segments (RLS) + routes GET/POST/DELETE segments"
```

---

## Task 8: UI — atelier dans `Pro.jsx` (section Contacts)

**Files:**
- Modify: `public/prototype/components/Pro.jsx`

> Repérage : la section contacts du pro affiche un tableau groupé par campagne avec un système de **3 filtres** (`score≥720 / atteint / palier 2`) et fait un `fetch('/api/pro/contacts')`. On ajoute un **atelier par campagne** : sélection de campagne → panneau audience (facettes) + barre de filtres/recherche → liste filtrée (refetch `/api/pro/contacts?campaignId=&filters=`) + segments enregistrés. Réutiliser le style existant (classes `card`, `chip`, `chip-accent`, `muted`, `row`, `col`, `btn`, `SectionTitle`).

- [ ] **Step 1: Repérer le composant Contacts et son fetch**

Localiser dans `public/prototype/components/Pro.jsx` la fonction qui rend « Mes contacts » (titre « Prospects ayant accepté », `SectionTitle eyebrow="Mes contacts"`), son `fetch('/api/pro/contacts')`, et la liste des campagnes du pro (le tableau est groupé par campagne — il existe donc déjà une liste de `{ campaignId, campaign }`). Noter le nom de l'état qui contient les lignes (ex. `rows`/`contacts`).

- [ ] **Step 2: Ajouter l'état de l'atelier**

Dans le composant Contacts, ajouter :

```jsx
const [activeCampaign, setActiveCampaign] = React.useState(null); // { id, name } ou null
const [audience, setAudience] = React.useState(null); // { total, availableTiers, facets, savedSegments }
const [filters, setFilters] = React.useState({}); // SegmentFilters
const [filteredRows, setFilteredRows] = React.useState(null); // null = pas de filtrage actif
const [segMenuOpen, setSegMenuOpen] = React.useState(false);
```

- [ ] **Step 3: Charger l'audience quand une campagne est sélectionnée**

```jsx
React.useEffect(() => {
  if (!activeCampaign) { setAudience(null); return; }
  let cancelled = false;
  fetch(`/api/pro/campaigns/${activeCampaign.id}/audience`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(j => { if (!cancelled && j) setAudience(j); })
    .catch(() => {});
  return () => { cancelled = true; };
}, [activeCampaign]);
```

- [ ] **Step 4: Refetch la liste filtrée quand les filtres changent**

```jsx
React.useEffect(() => {
  if (!activeCampaign) { setFilteredRows(null); return; }
  let cancelled = false;
  const params = new URLSearchParams({ campaignId: activeCampaign.id });
  if (Object.keys(filters).length > 0) params.set('filters', JSON.stringify(filters));
  fetch(`/api/pro/contacts?${params.toString()}`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(j => { if (!cancelled && j) setFilteredRows(j.rows || []); })
    .catch(() => {});
  return () => { cancelled = true; };
}, [activeCampaign, filters]);
```

- [ ] **Step 5: Rendre le panneau Audience**

Au-dessus du tableau, quand `audience` est chargée, afficher les distributions (barres simples). Exemple pour le score et une facette catégorielle (répéter le pattern pour chaque clé présente dans `audience.facets`) :

```jsx
{audience && (
  <div className="card" style={{ padding: 16, marginBottom: 16 }}>
    <div className="mono caps muted" style={{ marginBottom: 10 }}>
      Audience · {audience.total} contact{audience.total === 1 ? '' : 's'}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
      <FacetBlock title="BUPP Score" items={audience.facets.score.map(b => ({ value: b.label, count: b.count }))} />
      {audience.facets.region && <FacetBlock title="Région" items={audience.facets.region} />}
      {audience.facets.revenus && <FacetBlock title="Revenus" items={audience.facets.revenus} />}
      {audience.facets.epargne && <FacetBlock title="Épargne" items={audience.facets.epargne} />}
      {audience.facets.statutPro && <FacetBlock title="Statut pro" items={audience.facets.statutPro} />}
      {audience.facets.logement && <FacetBlock title="Logement" items={audience.facets.logement} />}
      {audience.facets.foyer && <FacetBlock title="Foyer" items={audience.facets.foyer} />}
      {audience.facets.vehicule && <FacetBlock title="Véhicule" items={audience.facets.vehicule} />}
      {audience.facets.animaux && <FacetBlock title="Animaux" items={audience.facets.animaux} />}
      <FacetBlock title="Contact" items={audience.facets.reached} />
    </div>
  </div>
)}
```

Et définir le petit composant `FacetBlock` (au même niveau que les autres helpers de `Pro.jsx`) :

```jsx
function FacetBlock({ title, items }) {
  const max = Math.max(1, ...items.map(i => i.count));
  return (
    <div>
      <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 6 }}>{title}</div>
      <div className="col gap-1">
        {items.map(i => (
          <div key={i.value} className="row center" style={{ gap: 8 }}>
            <div style={{ flex: 1, fontSize: 12 }}>{i.value}</div>
            <div style={{ width: 60, height: 6, background: 'var(--ivory-2)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${(i.count / max) * 100}%`, height: '100%', background: 'var(--accent)' }} />
            </div>
            <div className="mono" style={{ fontSize: 11, width: 28, textAlign: 'right' }}>{i.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Rendre la barre de filtres + recherche**

Sous le panneau audience, une barre qui pousse dans `filters` (chaque facette présente devient un `<select multiple>` simplifié en chips, ou un select). Exemple minimal pour la région + score + recherche (répliquer pour les autres facettes présentes via `audience.facets`) :

```jsx
{audience && (
  <div className="row center gap-2" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
    <input
      placeholder="Rechercher (métier, ville, projet…)"
      defaultValue={filters.q || ''}
      onChange={e => setFilters(f => ({ ...f, q: e.target.value || undefined }))}
      style={{ fontSize: 12, padding: '6px 10px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--paper)' }}
    />
    <select
      value={filters.scoreMin ?? ''}
      onChange={e => setFilters(f => ({ ...f, scoreMin: e.target.value ? Number(e.target.value) : undefined }))}
      style={{ fontSize: 12, padding: '6px 10px', borderRadius: 999, border: '1px solid var(--line)' }}>
      <option value="">Tout score</option>
      <option value="600">≥ 600</option>
      <option value="720">≥ 720</option>
    </select>
    {audience.facets.region && (
      <select
        value=""
        onChange={e => { const v = e.target.value; if (v) setFilters(f => ({ ...f, region: [...(f.region || []), v].filter((x, i, a) => a.indexOf(x) === i) })); }}
        style={{ fontSize: 12, padding: '6px 10px', borderRadius: 999, border: '1px solid var(--line)' }}>
        <option value="">Région…</option>
        {audience.facets.region.map(r => <option key={r.value} value={r.value}>{r.value} ({r.count})</option>)}
      </select>
    )}
    {Object.keys(filters).length > 0 && (
      <button className="chip" onClick={() => setFilters({})}><Icon name="rotate" size={11}/> Réinitialiser</button>
    )}
  </div>
)}
```

> Les chips des valeurs sélectionnées (region/revenus/…) s'affichent à côté avec un « × » qui les retire de `filters[key]`. Répliquer le pattern `select` ci-dessus pour chaque facette catégorielle présente dans `audience.facets` (revenus, epargne, logement, statutPro, foyer, vehicule, animaux), en poussant/retirant dans le tableau correspondant de `filters`.

- [ ] **Step 7: Brancher la liste sur `filteredRows`**

Quand `activeCampaign` est défini, la liste affichée = `filteredRows` (au lieu de toutes les lignes). Afficher le compteur « N contacts » et un état vide « Aucun contact pour ce filtre » + bouton Réinitialiser quand `filteredRows.length === 0` et qu'au moins un filtre est actif. Les **actions de contact existantes** (appel/email/SMS/WhatsApp/détails) restent inchangées sur chaque ligne.

- [ ] **Step 8: Segments enregistrés (save / load / delete)**

Ajouter un bouton « Enregistrer ce filtre » et un menu « Mes segments » :

```jsx
<button className="btn btn-ghost btn-sm" onClick={async () => {
  const name = window.prompt('Nom du segment ?');
  if (!name) return;
  const r = await fetch('/api/pro/segments', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ campaignId: activeCampaign.id, name, filters }),
  });
  if (r.ok) { const j = await r.json(); setAudience(a => a ? { ...a, savedSegments: [j.segment, ...(a.savedSegments || [])] } : a); }
}}>Enregistrer ce filtre</button>

{audience?.savedSegments?.length > 0 && (
  <div className="row center gap-2" style={{ flexWrap: 'wrap' }}>
    {audience.savedSegments.map(s => (
      <span key={s.id} className="chip">
        <button onClick={() => setFilters(s.filters || {})} style={{ background: 'none' }}>{s.name}</button>
        <button onClick={async () => {
          await fetch(`/api/pro/segments/${s.id}`, { method: 'DELETE' });
          setAudience(a => a ? { ...a, savedSegments: a.savedSegments.filter(x => x.id !== s.id) } : a);
        }} aria-label="Supprimer le segment" style={{ background: 'none', marginLeft: 4 }}>×</button>
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 9: Vérifier le parse Babel + le build**

Run: `node -e "const p=require('@babel/parser');const fs=require('fs');p.parse(fs.readFileSync('public/prototype/components/Pro.jsx','utf8'),{sourceType:'module',plugins:['jsx']});console.log('PARSE_OK')"`
Expected: `PARSE_OK`.
Puis : `npm run build`
Expected: build sans erreur.

- [ ] **Step 10: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro/segmentation/web): panneau audience + facettes/recherche + segments enregistrés"
```

---

## Task 9: Vérification finale

- [ ] **Step 1: Suite de tests complète**

Run: `npm test`
Expected: tous verts, dont `lib/pro/segmentation/{decode,facets,filter}.test.ts`.

- [ ] **Step 2: Typecheck + lint global**

Run: `npx tsc --noEmit && npx eslint .`
Expected: 0 erreur.

- [ ] **Step 3: Vérification manuelle (next dev)**

Run: `npm run dev`. Se connecter en **pro** (compte de test pro avec une campagne **clôturée** ayant des contacts acceptés ; au besoin en créer une et la clôturer). Onglet « Mes contacts » :
- sélectionner la campagne → le **panneau audience** s'affiche (distributions cohérentes avec les paliers achetés ; les facettes des paliers non achetés sont absentes) ;
- appliquer score/région/recherche → la **liste se filtre**, le **compteur** suit ; un filtre sans résultat montre l'état vide + reset ;
- « Enregistrer ce filtre » (nom) → le segment apparaît ; le recharger ré-applique les critères ; le supprimer le retire ;
- les **actions contact** par ligne fonctionnent comme avant.

> Note : un compte pro est exclusif (1 compte = prospect OU pro). Tester avec un email frais + bascule Professionnel.

- [ ] **Step 4: Commit final éventuel**

```bash
git add -A
git commit -m "chore(pro/segmentation): ajustements UI après vérification manuelle"
```

---

## Self-Review (effectué)

- **Couverture spec** : décodage paliers autorisés/masqués (T1), facettes structurées + buckets score (T2), filtres ET + recherche + sanitation (T3), loader campagne (T4), route audience gatée (T5), liste filtrée rétro-compatible (T6), table `pro_segments` + CRUD (T7), UI audience/facettes/recherche/segments (T8), tests + vérif (T1-3/T9). Non-objectifs (broadcast, voix/anti-exfil, inter-campagnes, mobile) hors plan.
- **Placeholders** : aucun — code complet à chaque étape (les libs pures et routes en intégral ; l'UI prototype en étapes concrètes adaptées au gros fichier existant).
- **Cohérence des types** : `SegmentContact`/`TierKey`/`CategoricalKey`/`SegmentFilters`/`AudienceFacets` définis en T1 et réutilisés tels quels (T2 `buildFacets`, T3 `matchesFilters`/`sanitizeFilters`, T4 `decodeContacts`/`loadCampaignAudience`). Clés de facettes identiques côté facets, filter, et UI. Réponse audience `{ total, availableTiers, facets, savedSegments }` consommée à l'identique par l'UI. `/api/pro/contacts` renvoie `{ rows, count }` (rétro-compatible, l'`count` est additif).
- **Périmètre** : un seul sous-système (atelier de segmentation), un seul plan. Migration via SQL Editor + `migration repair` (jamais `db push`).
