# Campaign Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the end-to-end loop so a pro launching a campaign creates real `relations` rows, sends emails to matching prospects, and lets them accept/refuse/undo with real wallet movements; pro-side analytics and contact lists pull from the database.

**Architecture:** Single Next.js POST handler does ensure→match→insert→email at launch. Prospect-side decisions go through atomic Postgres RPCs (security definer) that move money between `pro_accounts.wallet_balance_cents` and the `transactions` ledger. The iframe-rendered prototype JSX consumes new JSON endpoints, no rebuild required.

**Tech Stack:** Next.js 16 route handlers, Supabase Postgres (RLS + service_role), nodemailer SMTP Gmail, Clerk auth, React 18 (Babel-standalone in `/public/prototype/components/*.jsx`).

**Spec:** `docs/superpowers/specs/2026-05-04-campaign-acceptance-design.md`

**Note on testing:** the project has no Jest/Vitest setup (only `npm run lint` + `next build`). Verification steps use `npx tsc --noEmit`, lint, and manual smoke tests via the running dev server. We commit after each task.

---

## File Structure

**Create:**
- `supabase/migrations/20260504210000_campaigns_brief_genre_rpc.sql`
- `lib/campaigns/mapping.ts`
- `lib/campaigns/matching.ts`
- `lib/email/relation.ts`
- `app/api/pro/campaigns/route.ts`
- `app/api/prospect/relations/route.ts`
- `app/api/prospect/relations/[id]/decision/route.ts`
- `app/api/pro/contacts/route.ts`
- `app/api/pro/analytics/route.ts`
- `app/api/pro/overview/route.ts`

**Modify:**
- `lib/supabase/types.ts` (regenerated)
- `app/prospect/page.tsx` (read `searchParams.tab`)
- `app/_components/PrototypeFrame.tsx` (accept `tab` prop)
- `public/prototype/shell.html` (parse `?tab=…` after the route hash)
- `public/prototype/components/Prospect.jsx` (replace fixtures, accept `initialTab`)
- `public/prototype/components/Pro.jsx` (wire wizard launch, replace Contacts/Analytics/Overview fixtures)
- `proxy.ts` (no public-route change needed — all new routes are auth-protected)

---

## Task 1: DB migration — campaigns columns + genre + atomic RPCs

**Files:**
- Create: `supabase/migrations/20260504210000_campaigns_brief_genre_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Acceptation campagnes : colonnes + genre + RPCs atomiques
-- ════════════════════════════════════════════════════════════════════
-- Cette migration ajoute :
--   1. Colonnes `brief`, `starts_at`, `matched_count` sur `campaigns`
--      (utilisées par le wizard de création + l'agrégat matched_count).
--   2. Colonne `genre` sur `prospect_identity` pour le breakdown Analytics.
--   3. RPC `accept_relation_tx` : transition pending → accepted +
--      débit wallet pro + 2 transactions escrow (atomique).
--   4. RPC `refund_relation_tx` : rollback de l'accept (refund pro,
--      cancel escrow prospect).
-- Toutes les RPCs sont `security definer` — elles s'exécutent avec les
-- privilèges du créateur (postgres) et bypassent la RLS.
-- ════════════════════════════════════════════════════════════════════

alter table public.campaigns
  add column brief text,
  add column starts_at timestamptz not null default now(),
  add column matched_count integer not null default 0
    check (matched_count >= 0);

alter table public.prospect_identity
  add column genre text
  check (genre is null or genre in ('femme', 'homme', 'autre'));

-- ─── RPC : accepter une relation (atomique) ─────────────────────────
create or replace function public.accept_relation_tx(p_relation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro_id uuid;
  v_prospect_id uuid;
  v_campaign_id uuid;
  v_reward bigint;
  v_status relation_status;
  v_expires timestamptz;
  v_camp_status campaign_status;
  v_wallet bigint;
begin
  select r.pro_account_id, r.prospect_id, r.campaign_id,
         r.reward_cents, r.status, r.expires_at,
         c.status, a.wallet_balance_cents
    into v_pro_id, v_prospect_id, v_campaign_id,
         v_reward, v_status, v_expires,
         v_camp_status, v_wallet
    from relations r
    join campaigns c on c.id = r.campaign_id
    join pro_accounts a on a.id = r.pro_account_id
   where r.id = p_relation_id
   for update of r;

  if v_status is null then raise exception 'relation_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'pending' then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if v_camp_status <> 'active' then raise exception 'campaign_inactive' using errcode = 'P0001'; end if;
  if v_expires <= now() then raise exception 'relation_expired' using errcode = 'P0001'; end if;
  if v_wallet < v_reward then raise exception 'insufficient_pro_funds' using errcode = 'P0001'; end if;

  update relations
     set status = 'accepted', decided_at = now()
   where id = p_relation_id;

  update pro_accounts
     set wallet_balance_cents = wallet_balance_cents - v_reward
   where id = v_pro_id;

  update campaigns
     set spent_cents = spent_cents + v_reward
   where id = v_campaign_id;

  insert into transactions
    (account_id, account_kind, type, status, amount_cents,
     relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'escrow', 'completed', -v_reward,
     p_relation_id, v_campaign_id, 'Séquestre acceptation campagne'),
    (v_prospect_id, 'prospect', 'escrow', 'pending', v_reward,
     p_relation_id, v_campaign_id, 'Séquestre récompense — en attente de débit');
end;
$$;

-- ─── RPC : annuler une acceptation (refund pro) ─────────────────────
create or replace function public.refund_relation_tx(
  p_relation_id uuid,
  p_new_status relation_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro_id uuid;
  v_campaign_id uuid;
  v_reward bigint;
  v_status relation_status;
begin
  if p_new_status not in ('pending', 'refused') then
    raise exception 'invalid_target_status' using errcode = 'P0001';
  end if;

  select pro_account_id, campaign_id, reward_cents, status
    into v_pro_id, v_campaign_id, v_reward, v_status
    from relations
   where id = p_relation_id
   for update;

  if v_status is null then raise exception 'relation_not_found' using errcode = 'P0002'; end if;
  if v_status <> 'accepted' then raise exception 'not_accepted' using errcode = 'P0001'; end if;

  update relations
     set status = p_new_status,
         decided_at = case when p_new_status = 'pending' then null else now() end
   where id = p_relation_id;

  update pro_accounts
     set wallet_balance_cents = wallet_balance_cents + v_reward
   where id = v_pro_id;

  update campaigns
     set spent_cents = greatest(0, spent_cents - v_reward)
   where id = v_campaign_id;

  insert into transactions
    (account_id, account_kind, type, status, amount_cents,
     relation_id, campaign_id, description)
  values
    (v_pro_id, 'pro', 'refund', 'completed', v_reward,
     p_relation_id, v_campaign_id, 'Remboursement annulation acceptation');

  -- Annule la transaction d'escrow prospect (pending → canceled).
  update transactions
     set status = 'canceled'
   where relation_id = p_relation_id
     and account_kind = 'prospect'
     and type = 'escrow'
     and status = 'pending';
end;
$$;
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push`
Expected: `Finished supabase db push.` (no errors). Si en mode `link` à un projet distant, la migration part vers Supabase Cloud.

- [ ] **Step 3: Regenerate TS types**

Run: `npx supabase gen types typescript --linked > lib/supabase/types.ts`
Expected: file replaced. Quick check: `grep -c 'brief' lib/supabase/types.ts` returns ≥ 3.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260504210000_campaigns_brief_genre_rpc.sql lib/supabase/types.ts
git commit -m "feat(db): campaigns brief/starts_at/matched_count + prospect genre + accept/refund RPCs"
```

---

## Task 2: Mapping helpers (objective → enum, verifLevel, geoPrefix, age)

**Files:**
- Create: `lib/campaigns/mapping.ts`

- [ ] **Step 1: Write `lib/campaigns/mapping.ts`**

```ts
/**
 * Mapping wizard ↔ DB pour la création de campagne.
 *
 * Source de vérité côté UI : `OBJECTIVES`, `VERIF_LEVELS`, `AGE_RANGES`,
 * `GEO_ZONES` dans `public/prototype/components/Pro.jsx`.
 *
 * Comme le wizard est en JSX dans une iframe (pas typé), ces mappings
 * sont la frontière où l'on valide et convertit avant de toucher la DB.
 */

import type { Database } from "@/lib/supabase/types";

export type CampaignTypeDb = Database["public"]["Enums"]["campaign_type"];
export type VerificationLevelDb = Database["public"]["Enums"]["verification_level"];
export type TierKeyDb = Database["public"]["Enums"]["tier_key"];

const OBJECTIVE_TO_TYPE: Record<string, CampaignTypeDb> = {
  contact: "prise_de_contact",
  rdv: "prise_de_rendez_vous",
  evt: "prise_de_contact",
  dl: "prise_de_contact",
  survey: "information_sondage",
  promo: "prise_de_contact",
  addigital: "prise_de_contact",
};

export function objectiveToCampaignType(objectiveId: string): CampaignTypeDb {
  return OBJECTIVE_TO_TYPE[objectiveId] ?? "prise_de_contact";
}

const VERIF_ACCEPTABLE: Record<string, VerificationLevelDb[]> = {
  p0: ["basique", "verifie", "certifie", "confiance"],
  p1: ["verifie", "certifie", "confiance"],
  p2: ["certifie", "confiance"],
  p3: ["confiance"],
};

export function acceptableVerifLevels(verif: string): VerificationLevelDb[] {
  return VERIF_ACCEPTABLE[verif] ?? VERIF_ACCEPTABLE.p0;
}

const TIER_NUM_TO_KEY: Record<number, TierKeyDb> = {
  1: "identity",
  2: "localisation",
  3: "vie",
  4: "pro",
  5: "patrimoine",
};

export function tierNumsToKeys(nums: number[]): TierKeyDb[] {
  return nums
    .map((n) => TIER_NUM_TO_KEY[n])
    .filter((k): k is TierKeyDb => Boolean(k));
}

/**
 * Calcule un préfixe `LIKE` à appliquer sur `prospect_localisation.code_postal`
 * en fonction de la zone choisie par le pro et de son propre code postal.
 *
 * - 'ville'    → préfixe sur les 2 premiers caractères + département (08)
 *                pour rester simple dans cette itération.
 * - 'dept'     → 2 premiers chiffres du CP du pro.
 * - 'region'   → 2 premiers chiffres seulement (le mapping région complet
 *                est out-of-scope ; on traite 'region' comme 'dept' large).
 * - 'national' → null (pas de filtre).
 */
export function geoCodePostalPrefix(
  geo: string,
  proCodePostal: string | null,
): string | null {
  if (geo === "national") return null;
  if (!proCodePostal) return null;
  const dep = proCodePostal.slice(0, 2);
  if (geo === "ville" || geo === "dept" || geo === "region") {
    return dep + "%";
  }
  return null;
}

const AGE_BUCKETS: Record<string, [number, number]> = {
  "18–25": [18, 25],
  "26–35": [26, 35],
  "36–45": [36, 45],
  "46–55": [46, 55],
  "56–65": [56, 65],
  "65+": [65, 200],
};

/** Retourne null si `Tous` est dans la sélection (pas de filtre). */
export function ageRangesToBounds(
  ages: string[],
): Array<[number, number]> | null {
  if (!ages || ages.length === 0 || ages.includes("Tous")) return null;
  return ages
    .map((a) => AGE_BUCKETS[a])
    .filter((b): b is [number, number] => Boolean(b));
}

/** Calcule l'âge à partir d'une date de naissance string (`YYYY-MM-DD`). */
export function ageFromBirthString(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const birth = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const md = now.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function ageMatchesAny(
  age: number,
  bounds: Array<[number, number]>,
): boolean {
  return bounds.some(([lo, hi]) => age >= lo && age <= hi);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to this file. (If unrelated errors exist already, ignore them.)

- [ ] **Step 3: Commit**

```bash
git add lib/campaigns/mapping.ts
git commit -m "feat(campaigns): wizard↔db mapping helpers (objective, verif, geo, age)"
```

---

## Task 3: Matching helper

**Files:**
- Create: `lib/campaigns/matching.ts`

- [ ] **Step 1: Write `lib/campaigns/matching.ts`**

```ts
/**
 * Sélection des prospects qui matchent les critères d'une campagne.
 *
 * Appelé exclusivement depuis `POST /api/pro/campaigns` en service_role
 * (la requête lit en cross-prospect, ce que la RLS bloquerait).
 *
 * Implémentation : 1 SELECT principal + filtre âge appliqué côté Node
 * (la colonne `naissance` est `text`, parser en JS est plus simple
 * qu'une fonction SQL).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  acceptableVerifLevels,
  ageFromBirthString,
  ageMatchesAny,
  ageRangesToBounds,
  geoCodePostalPrefix,
  objectiveToCampaignType,
  tierNumsToKeys,
  type CampaignTypeDb,
} from "./mapping";

export type MatchingInput = {
  objectiveId: string;
  requiredTiers: number[];
  geo: string;
  proCodePostal: string | null;
  ages: string[];
  verifLevel: string;
  contacts: number;
};

export type MatchedProspect = {
  prospectId: string;
  email: string | null;
  prenom: string | null;
};

export async function findMatchingProspects(
  admin: SupabaseClient<Database>,
  input: MatchingInput,
): Promise<MatchedProspect[]> {
  const requiredKeys = tierNumsToKeys(input.requiredTiers);
  const acceptableLevels = acceptableVerifLevels(input.verifLevel);
  const cpPrefix = geoCodePostalPrefix(input.geo, input.proCodePostal);
  const ageBounds = ageRangesToBounds(input.ages);
  const wantsTier1 = input.requiredTiers.includes(1);
  const campaignType: CampaignTypeDb = objectiveToCampaignType(input.objectiveId);

  // SELECT principal — on sur-fetch un peu si on doit filtrer par âge
  // côté Node (×3 le cap) pour avoir de la marge.
  const oversampleFactor = ageBounds && wantsTier1 ? 3 : 1;
  const selectLimit = Math.max(input.contacts * oversampleFactor, input.contacts);

  let query = admin
    .from("prospects")
    .select(
      `
      id,
      bupp_score,
      verification,
      removed_tiers,
      hidden_tiers,
      all_campaign_types,
      campaign_types,
      prospect_identity ( email, prenom, naissance ),
      prospect_localisation ( code_postal )
    `,
    )
    .in("verification", acceptableLevels)
    .order("bupp_score", { ascending: false })
    .order("id", { ascending: true })
    .limit(selectLimit);

  // Filtre type campagne : `all_campaign_types=true OR enum dans campaign_types`
  query = query.or(
    `all_campaign_types.eq.true,campaign_types.cs.{${campaignType}}`,
  );

  if (cpPrefix) {
    query = query.like("prospect_localisation.code_postal", cpPrefix);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  const matched: MatchedProspect[] = [];
  for (const row of data) {
    if (matched.length >= input.contacts) break;

    // Tous les paliers requis doivent être présents et pas masqués/supprimés.
    const removed = (row.removed_tiers ?? []) as string[];
    const hidden = (row.hidden_tiers ?? []) as string[];
    const blocked = requiredKeys.some(
      (k) => removed.includes(k) || hidden.includes(k),
    );
    if (blocked) continue;

    // Le palier 1 (identity) doit avoir une row prospect_identity non vide
    // si on l'exige. Idem pour la localisation si geo != national.
    const identity = Array.isArray(row.prospect_identity)
      ? row.prospect_identity[0]
      : row.prospect_identity;
    if (requiredKeys.includes("identity") && !identity) continue;

    const localisation = Array.isArray(row.prospect_localisation)
      ? row.prospect_localisation[0]
      : row.prospect_localisation;
    if (cpPrefix && !localisation?.code_postal) continue;

    // Filtre âge — uniquement applicable si tier 1 requis (sinon on ne
    // peut pas connaître la naissance, on laisse passer).
    if (ageBounds && wantsTier1) {
      const age = ageFromBirthString(identity?.naissance ?? null);
      if (age == null) continue;
      if (!ageMatchesAny(age, ageBounds)) continue;
    }

    matched.push({
      prospectId: row.id as string,
      email: identity?.email ?? null,
      prenom: identity?.prenom ?? null,
    });
  }

  return matched;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors on this file. If `prospect_localisation.code_postal` typing complains because of the relation join, the cast above (`(row.prospect_localisation)[0]`) handles both shapes.

- [ ] **Step 3: Commit**

```bash
git add lib/campaigns/matching.ts
git commit -m "feat(campaigns): findMatchingProspects helper with age filter post-SELECT"
```

---

## Task 4: Email template — `sendRelationInvitation`

**Files:**
- Create: `lib/email/relation.ts`

- [ ] **Step 1: Write `lib/email/relation.ts`**

```ts
/**
 * Mail envoyé au prospect quand un pro lance une campagne ciblant son profil.
 * Fire-and-forget : appelé depuis `POST /api/pro/campaigns` en
 * `Promise.allSettled` non-await — un échec SMTP ne fait jamais échouer
 * la création de campagne.
 */

import { getFromAddress, getTransport } from "./transport";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("http://localhost")
    ? process.env.NEXT_PUBLIC_APP_URL
    : "https://bup-rouge.vercel.app";
const LOGO_URL = `${APP_URL}/logo.png`;
const LINK_URL = `${APP_URL}/prospect?tab=relations`;

export type RelationInvitationParams = {
  email: string;
  prenom: string | null;
  proName: string;
  proSector: string | null;
  motif: string;
  brief: string | null;
  rewardEur: number;
  expiresAt: string; // ISO
};

export async function sendRelationInvitation(
  params: RelationInvitationParams,
): Promise<void> {
  const transport = getTransport();
  if (!transport) return;

  const {
    email,
    prenom,
    proName,
    proSector,
    motif,
    brief,
    rewardEur,
    expiresAt,
  } = params;

  const greet = prenom?.trim() || "Bonjour";
  const rewardStr = rewardEur.toFixed(2).replace(".", ",");
  const expiresStr = formatDeadline(expiresAt);

  const subject = `Nouvelle mise en relation — ${rewardStr} € à la clé`;

  const text = [
    `Bonjour ${greet},`,
    "",
    `${proName}${proSector ? " (" + proSector + ")" : ""} souhaite vous solliciter sur BUUPP.`,
    "",
    `Objet : ${motif}`,
    brief ? `Le mot du pro : « ${brief} »` : null,
    "",
    `Récompense si vous acceptez : ${rewardStr} €`,
    `Délai pour répondre : ${expiresStr}`,
    "",
    "Vous pouvez accepter ou refuser depuis votre espace prospect :",
    LINK_URL,
    "",
    "À bientôt,",
    "L'équipe BUUPP",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F1629;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F4EC;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFEF8;border-radius:16px;border:1px solid #EAE3D0;overflow:hidden;">
<tr><td style="padding:28px 32px 12px;border-bottom:1px solid #F1ECDB;">
  <div style="font-family:Georgia,serif;font-size:28px;font-weight:600;color:#0F1629;">BUUPP</div>
  <div style="font-size:12px;color:#6B7180;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Nouvelle mise en relation</div>
</td></tr>
<tr><td style="padding:28px 32px 8px;">
  <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#0F1629;font-weight:500;">
    ${escapeHtml(greet)}, un pro vous propose ${rewardStr} €
  </h1>
  <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3A4150;">
    <strong>${escapeHtml(proName)}</strong>${proSector ? ' <span style="color:#6B7180">— ' + escapeHtml(proSector) + "</span>" : ""} souhaite vous solliciter via BUUPP.
  </p>
  <p style="margin:0 0 4px;font-size:14px;color:#6B7180;letter-spacing:.04em;">Objet de la demande</p>
  <p style="margin:0 0 18px;font-size:14.5px;line-height:1.55;color:#0F1629;">${escapeHtml(motif)}</p>
  ${
    brief
      ? `
  <div style="background:#FAF6E8;border:1px solid #EAE3D0;border-radius:10px;padding:12px 14px;margin-bottom:18px;">
    <div style="font-size:11px;color:#6B7180;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;">Le mot du professionnel</div>
    <div style="font-size:14px;color:#0F1629;font-style:italic;">« ${escapeHtml(brief)} »</div>
  </div>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;">
    <tr>
      <td style="padding:12px 14px;background:#0F1629;border-radius:10px;color:#FFFEF8;">
        <div style="font-size:11px;color:#A8AFC0;text-transform:uppercase;letter-spacing:.12em;">Récompense si vous acceptez</div>
        <div style="font-family:Georgia,serif;font-size:32px;font-weight:600;line-height:1.1;margin-top:4px;">${rewardStr} €</div>
        <div style="font-size:11.5px;color:#A8AFC0;margin-top:6px;">Délai pour répondre : <strong style="color:#FFFEF8;">${escapeHtml(expiresStr)}</strong></div>
      </td>
    </tr>
  </table>
  <p style="margin:0 0 24px;text-align:center;">
    <a href="${LINK_URL}" target="_blank" rel="noopener noreferrer"
       style="display:inline-block;padding:14px 28px;background:#4596EC;color:#FFFEF8;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;">
      Voir la demande →
    </a>
  </p>
  <p style="margin:0 0 4px;font-size:12px;color:#6B7180;text-align:center;">
    Sans réponse passé le délai, la demande expirera et aucun débit n'aura lieu.
  </p>
</td></tr>
<tr><td style="padding:18px 32px;background:#F7F4EC;border-top:1px solid #EAE3D0;text-align:center;">
  <a href="${APP_URL}" target="_blank" rel="noopener noreferrer">
    <img src="${LOGO_URL}" alt="BUUPP" width="100" style="display:inline-block;border:0;height:auto;max-width:100px;"/>
  </a>
  <p style="margin:10px 0 0;font-size:11px;color:#6B7180;line-height:1.5;">
    BUUPP — Be Used, Paid &amp; Proud · Vos données vous appartiennent.
  </p>
</td></tr>
</table>
</td></tr></table>
</body></html>
  `.trim();

  try {
    await transport.sendMail({
      from: getFromAddress(),
      to: email,
      subject,
      text,
      html,
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[email/relation] échec d'envoi à ${email} → ${msg}`);
  }
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "72 h";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/email/relation.ts
git commit -m "feat(email): sendRelationInvitation template with CTA to /prospect?tab=relations"
```

---

## Task 5: POST `/api/pro/campaigns` — launch handler

**Files:**
- Create: `app/api/pro/campaigns/route.ts`

- [ ] **Step 1: Write the handler**

```ts
/**
 * POST /api/pro/campaigns — lance une campagne et notifie les prospects matchants.
 *
 * Algorithme (cf. spec §2 / §3) :
 *  1. ensureProAccount + lecture wallet + frais plan.
 *  2. Vérification solde ≥ budget + plan_fee → sinon 402.
 *  3. INSERT campaigns(active, brief, starts_at, ends_at).
 *  4. findMatchingProspects(LIMIT contacts).
 *  5. Batch INSERT relations(pending, expires_at = now()+72h).
 *  6. Update campaigns.matched_count.
 *  7. Fire-and-forget : sendRelationInvitation par prospect avec email.
 *
 * Service_role obligatoire — la requête de matching croise plusieurs
 * prospects (RLS bloquerait la lecture).
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { findMatchingProspects } from "@/lib/campaigns/matching";
import {
  objectiveToCampaignType,
  tierNumsToKeys,
} from "@/lib/campaigns/mapping";
import { sendRelationInvitation } from "@/lib/email/relation";

export const runtime = "nodejs";

type Body = {
  name?: string;
  objectiveId: string;
  subTypes: string[];
  requiredTiers: number[];
  geo: string;
  ages: string[];
  verifLevel: string;
  contacts: number;
  days: number;
  startDate: string;
  endDate: string;
  brief: string;
  costPerContactCents: number;
  budgetCents: number;
  keywords: string[];
  kwFilter: boolean;
  poolMode: string;
};

const EXPIRY_HOURS = 72;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    !body.objectiveId ||
    !Array.isArray(body.requiredTiers) || body.requiredTiers.length === 0 ||
    !body.brief || body.brief.trim().length === 0 ||
    !body.contacts || body.contacts < 1 ||
    !body.costPerContactCents || body.costPerContactCents < 1 ||
    !body.budgetCents || body.budgetCents < 1
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  const { data: pro } = await admin
    .from("pro_accounts")
    .select("wallet_balance_cents, raison_sociale, secteur, code_postal, plan")
    .eq("id", proId)
    .single();
  if (!pro) {
    return NextResponse.json({ error: "pro_not_found" }, { status: 404 });
  }

  const { data: planRow } = await admin
    .from("plan_pricing")
    .select("monthly_cents")
    .eq("plan", pro.plan)
    .single();
  const planFeeCents = Number(planRow?.monthly_cents ?? 0);

  if (Number(pro.wallet_balance_cents) < body.budgetCents + planFeeCents) {
    return NextResponse.json(
      {
        error: "insufficient_funds",
        walletCents: Number(pro.wallet_balance_cents),
        neededCents: body.budgetCents + planFeeCents,
      },
      { status: 402 },
    );
  }

  const campaignType = objectiveToCampaignType(body.objectiveId);
  const targeting = {
    objectiveId: body.objectiveId,
    subTypes: body.subTypes,
    requiredTiers: body.requiredTiers,
    requiredTierKeys: tierNumsToKeys(body.requiredTiers),
    geo: body.geo,
    ages: body.ages,
    verifLevel: body.verifLevel,
    keywords: body.keywords,
    kwFilter: body.kwFilter,
    poolMode: body.poolMode,
    days: body.days,
  };
  const name = (body.name?.trim() || body.brief.trim()).slice(0, 120);

  const { data: campaign, error: campErr } = await admin
    .from("campaigns")
    .insert({
      pro_account_id: proId,
      name,
      type: campaignType,
      status: "active",
      targeting,
      cost_per_contact_cents: body.costPerContactCents,
      budget_cents: body.budgetCents,
      brief: body.brief.trim(),
      starts_at: new Date(body.startDate).toISOString(),
      ends_at: new Date(body.endDate).toISOString(),
    })
    .select("id")
    .single();
  if (campErr || !campaign) {
    console.error("[/api/pro/campaigns] insert campaign failed", campErr);
    return NextResponse.json({ error: "insert_campaign_failed" }, { status: 500 });
  }

  const matched = await findMatchingProspects(admin, {
    objectiveId: body.objectiveId,
    requiredTiers: body.requiredTiers,
    geo: body.geo,
    proCodePostal: pro.code_postal ?? null,
    ages: body.ages,
    verifLevel: body.verifLevel,
    contacts: body.contacts,
  });

  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 3600 * 1000).toISOString();
  const motif = body.brief.trim() || name;

  let insertedCount = 0;
  if (matched.length > 0) {
    const rows = matched.map((m) => ({
      campaign_id: campaign.id,
      pro_account_id: proId,
      prospect_id: m.prospectId,
      motif,
      reward_cents: body.costPerContactCents,
      status: "pending" as const,
      expires_at: expiresAt,
    }));
    const { data: inserted, error: relErr } = await admin
      .from("relations")
      .insert(rows)
      .select("id, prospect_id");
    if (relErr) {
      console.error("[/api/pro/campaigns] insert relations failed", relErr);
      // On garde la campagne mais on remonte le flag : aucune relation créée.
    } else {
      insertedCount = inserted?.length ?? 0;
    }
  }

  await admin
    .from("campaigns")
    .update({ matched_count: insertedCount })
    .eq("id", campaign.id);

  // Mails fire-and-forget — Promise.allSettled non-awaité.
  const proSector = pro.secteur ?? null;
  const proName = pro.raison_sociale;
  const rewardEur = body.costPerContactCents / 100;
  void Promise.allSettled(
    matched
      .filter((m) => m.email)
      .map((m) =>
        sendRelationInvitation({
          email: m.email!,
          prenom: m.prenom,
          proName,
          proSector,
          motif,
          brief: body.brief.trim(),
          rewardEur,
          expiresAt,
        }),
      ),
  );

  const code = `BUUPP-${randomCode(4)}-${randomCode(4)}`;
  return NextResponse.json({
    campaignId: campaign.id,
    matchedCount: insertedCount,
    code,
  });
}

function randomCode(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Quick smoke against dev server**

In one terminal: `npm run dev`. In another, sign in as a pro user via the browser, then:

```bash
curl -X POST http://localhost:3000/api/pro/campaigns \
  -H 'content-type: application/json' \
  -H 'cookie: __session=<your-clerk-cookie>' \
  -d '{"objectiveId":"rdv","subTypes":["rdvphys"],"requiredTiers":[1],"geo":"national","ages":["Tous"],"verifLevel":"p0","contacts":1,"days":7,"startDate":"2026-05-04","endDate":"2026-05-11","brief":"Test","costPerContactCents":100,"budgetCents":100,"keywords":[],"kwFilter":false,"poolMode":"standard"}'
```

Expected: HTTP 200 with `{ campaignId, matchedCount, code }`. Verify in Supabase that `campaigns` has a new row with `brief='Test'`. (If you don't have a clerk cookie at hand, skip this step and verify via the wizard in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add app/api/pro/campaigns/route.ts
git commit -m "feat(api): POST /api/pro/campaigns — launch + match + email"
```

---

## Task 6: Wire the wizard "Lancer la campagne" button

**Files:**
- Modify: `public/prototype/components/Pro.jsx:1828-1856`

- [ ] **Step 1: Replace the synthetic launch with the API call**

Find lines 1828-1856 (the "Lancer la campagne" button onClick). Replace:

```jsx
                onClick={async () => {
                  if (!canLaunch) return;
                  // Re-fetch le wallet juste avant la validation pour
                  // tenir compte d'une éventuelle recharge récente.
                  await refreshWalletBalance();
                  const balance = Number(walletBalanceEur ?? 0);
                  const totalNeeded = total + planMonthlyEur;
                  if (balance < totalNeeded) {
                    setInsufficient({
                      balance,
                      campaignTotal: total,
                      planFee: planMonthlyEur,
                      needed: totalNeeded,
                      missing: Math.max(0, totalNeeded - balance),
                    });
                    return;
                  }
                  // Solde OK → on lance la campagne.
                  const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase();
                  setLaunched({ code: `BUUPP-${rand()}-${rand()}`, name: obj?.name });
                }}
```

with:

```jsx
                onClick={async () => {
                  if (!canLaunch) return;
                  await refreshWalletBalance();
                  const balance = Number(walletBalanceEur ?? 0);
                  const totalNeeded = total + planMonthlyEur;
                  if (balance < totalNeeded) {
                    setInsufficient({
                      balance,
                      campaignTotal: total,
                      planFee: planMonthlyEur,
                      needed: totalNeeded,
                      missing: Math.max(0, totalNeeded - balance),
                    });
                    return;
                  }
                  // POST vers /api/pro/campaigns — persist + match + emails.
                  try {
                    const r = await fetch('/api/pro/campaigns', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({
                        name: obj?.name || '',
                        objectiveId: selectedObj,
                        subTypes: Array.from(selectedSubs),
                        requiredTiers: Array.from(selectedTiers),
                        geo, ages: Array.from(ages), verifLevel: verif,
                        contacts, days,
                        startDate, endDate, brief,
                        costPerContactCents: Math.round(cpc * 100),
                        budgetCents: Math.round(total * 100),
                        keywords, kwFilter, poolMode,
                      }),
                    });
                    const j = await r.json();
                    if (!r.ok) {
                      if (r.status === 402) {
                        setInsufficient({
                          balance: (j.walletCents || 0) / 100,
                          campaignTotal: total,
                          planFee: planMonthlyEur,
                          needed: (j.neededCents || 0) / 100,
                          missing: Math.max(0, ((j.neededCents || 0) - (j.walletCents || 0)) / 100),
                        });
                        return;
                      }
                      throw new Error(j?.error || 'launch_failed');
                    }
                    // Wallet a été lu/contrôlé côté serveur — on invalide
                    // pour que le header et la facturation se rafraîchissent.
                    invalidateProWallet();
                    try { window.dispatchEvent(new Event('pro:wallet-changed')); } catch {}
                    setLaunched({ code: j.code, name: obj?.name, matched: j.matchedCount });
                  } catch (e) {
                    alert("Échec du lancement : " + (e.message || 'inconnu'));
                  }
                }}
```

- [ ] **Step 2: Update `CampaignLaunchedModal` to show `matchedCount` if available**

Find `CampaignLaunchedModal` (around line 1918). In its body, after the existing code/name display, add a small line:

```jsx
{data.matched != null && (
  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
    {data.matched} prospect{data.matched > 1 ? 's' : ''} notifié{data.matched > 1 ? 's' : ''}
  </div>
)}
```

(Place it inside the existing structure where the campaign code is shown.)

- [ ] **Step 3: Manual smoke test**

`npm run dev`, sign in as a pro, recharge if needed, then run through the wizard with minimal data and click "Lancer". Verify:
- Modal "Campagne lancée" appears with the new code.
- Supabase: `campaigns` has a new row with `brief`, `starts_at`, `matched_count`.
- If at least one prospect matches : `relations` rows in pending; mail received (if SMTP configured).

- [ ] **Step 4: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro/wizard): launch button POSTs to /api/pro/campaigns"
```

---

## Task 7: GET `/api/prospect/relations`

**Files:**
- Create: `app/api/prospect/relations/route.ts`

- [ ] **Step 1: Write the handler**

```ts
/**
 * GET /api/prospect/relations — sollicitations reçues par le prospect connecté.
 *
 * Découpage côté serveur en deux listes :
 *   - pending  : status='pending' AND expires_at > now() — affichées en cards.
 *   - history  : tout le reste, triées par decided_at desc puis sent_at desc.
 *
 * Champs renvoyés taillés pour le composant `Relations` de Prospect.jsx.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";

export const runtime = "nodejs";

type RelationRow = {
  id: string;
  campaign_id: string;
  motif: string;
  reward_cents: number;
  status: string;
  sent_at: string;
  expires_at: string;
  decided_at: string | null;
  campaigns: {
    name: string;
    brief: string | null;
    starts_at: string;
    ends_at: string | null;
    targeting: Record<string, unknown> | null;
  } | null;
  pro_accounts: {
    raison_sociale: string;
    secteur: string | null;
    ville: string | null;
  } | null;
};

function timerString(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expirée";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

function highestTier(targeting: Record<string, unknown> | null): number {
  const t = targeting?.requiredTiers;
  if (!Array.isArray(t)) return 1;
  const max = Math.max(...t.map((n) => Number(n) || 0), 1);
  return Math.min(5, Math.max(1, max));
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const prospectId = await ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("relations")
    .select(
      `id, campaign_id, motif, reward_cents, status, sent_at, expires_at, decided_at,
       campaigns ( name, brief, starts_at, ends_at, targeting ),
       pro_accounts ( raison_sociale, secteur, ville )`,
    )
    .eq("prospect_id", prospectId)
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("[/api/prospect/relations] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as RelationRow[];
  const now = Date.now();

  const pending = rows
    .filter((r) => r.status === "pending" && new Date(r.expires_at).getTime() > now)
    .map((r) => {
      const reward = Number(r.reward_cents) / 100;
      const proName = r.pro_accounts?.raison_sociale ?? "—";
      const sectorParts = [r.pro_accounts?.secteur, r.pro_accounts?.ville].filter(
        Boolean,
      ) as string[];
      return {
        id: r.id,
        campaignId: r.campaign_id,
        pro: proName,
        sector: sectorParts.join(" · "),
        motif: r.motif,
        brief: r.campaigns?.brief ?? null,
        reward,
        tier: highestTier(r.campaigns?.targeting ?? null),
        timer: timerString(r.expires_at),
        startDate: r.campaigns?.starts_at ?? r.sent_at,
        endDate: r.campaigns?.ends_at ?? r.expires_at,
      };
    });

  const history = rows
    .filter(
      (r) => !(r.status === "pending" && new Date(r.expires_at).getTime() > now),
    )
    .map((r) => {
      const reward = Number(r.reward_cents) / 100;
      const decisionLabel =
        r.status === "accepted" || r.status === "settled"
          ? "Acceptée"
          : r.status === "refused"
            ? "Refusée"
            : "Expirée";
      const statusLabel =
        r.status === "settled" ? "Crédité" :
        r.status === "accepted" ? "En séquestre" : "—";
      const gain = r.status === "accepted" || r.status === "settled" ? reward : null;
      const date = r.decided_at ?? r.sent_at;
      return {
        id: r.id,
        date,
        proName: r.pro_accounts?.raison_sociale ?? "—",
        tier: highestTier(r.campaigns?.targeting ?? null),
        decision: decisionLabel,
        status: statusLabel,
        gain,
      };
    });

  return NextResponse.json({ pending, history });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/prospect/relations/route.ts
git commit -m "feat(api): GET /api/prospect/relations — pending + history split"
```

---

## Task 8: POST `/api/prospect/relations/[id]/decision`

**Files:**
- Create: `app/api/prospect/relations/[id]/decision/route.ts`

- [ ] **Step 1: Write the handler**

```ts
/**
 * POST /api/prospect/relations/[id]/decision
 * Body : { action: 'accept' | 'refuse' | 'undo' }
 *
 * Transitions autorisées :
 *   accept : pending  → accepted   (RPC accept_relation_tx, atomique)
 *   refuse : pending  → refused    (update simple, pas d'effet financier)
 *   refuse : accepted → refused    (RPC refund_relation_tx + status=refused)
 *   undo   : refused  → pending    (update simple)
 *   undo   : accepted → pending    (RPC refund_relation_tx + status=pending)
 *
 * Toutes les vérifications (ownership, expiration, statut campagne, solde
 * du pro) sont faites côté SQL — la RPC raise une exception nommée si
 * la transition est invalide. On mappe ces codes en réponses HTTP.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Action = "accept" | "refuse" | "undo";

type RouteContext = { params: Promise<{ id: string }> };

const ACTION_TO_ERROR_HTTP: Record<string, number> = {
  relation_not_found: 404,
  invalid_status: 409,
  campaign_inactive: 409,
  relation_expired: 410,
  insufficient_pro_funds: 402,
  not_accepted: 409,
  invalid_target_status: 400,
};

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let body: { action?: Action };
  try {
    body = (await req.json()) as { action?: Action };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const action = body.action;
  if (!action || !["accept", "refuse", "undo"].includes(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Ownership check : la relation doit appartenir au prospect courant.
  const { data: rel, error: relErr } = await admin
    .from("relations")
    .select("id, status, prospect_id, prospects:prospect_id(clerk_user_id)")
    .eq("id", id)
    .single();
  if (relErr || !rel) {
    return NextResponse.json({ error: "relation_not_found" }, { status: 404 });
  }
  const ownerClerkId = Array.isArray(rel.prospects)
    ? rel.prospects[0]?.clerk_user_id
    : (rel.prospects as { clerk_user_id?: string } | null)?.clerk_user_id;
  if (ownerClerkId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    if (action === "accept") {
      const { error } = await admin.rpc("accept_relation_tx", { p_relation_id: id });
      if (error) return mapRpcError(error);
    } else if (action === "refuse") {
      if (rel.status === "accepted") {
        const { error } = await admin.rpc("refund_relation_tx", {
          p_relation_id: id,
          p_new_status: "refused",
        });
        if (error) return mapRpcError(error);
      } else if (rel.status === "pending") {
        const { error } = await admin
          .from("relations")
          .update({ status: "refused", decided_at: new Date().toISOString() })
          .eq("id", id);
        if (error) {
          console.error("[decision/refuse] update failed", error);
          return NextResponse.json({ error: "update_failed" }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: "invalid_status" }, { status: 409 });
      }
    } else {
      // undo → ramène à pending
      if (rel.status === "accepted") {
        const { error } = await admin.rpc("refund_relation_tx", {
          p_relation_id: id,
          p_new_status: "pending",
        });
        if (error) return mapRpcError(error);
      } else if (rel.status === "refused") {
        const { error } = await admin
          .from("relations")
          .update({ status: "pending", decided_at: null })
          .eq("id", id);
        if (error) {
          console.error("[decision/undo] update failed", error);
          return NextResponse.json({ error: "update_failed" }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: "invalid_status" }, { status: 409 });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[decision] unexpected error", msg);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function mapRpcError(error: { message?: string }) {
  const msg = error.message || "";
  for (const code of Object.keys(ACTION_TO_ERROR_HTTP)) {
    if (msg.includes(code)) {
      return NextResponse.json({ error: code }, { status: ACTION_TO_ERROR_HTTP[code] });
    }
  }
  console.error("[decision] unmapped RPC error:", msg);
  return NextResponse.json({ error: "rpc_failed", message: msg }, { status: 500 });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/prospect/relations/\[id\]/decision/route.ts
git commit -m "feat(api): POST /api/prospect/relations/[id]/decision (accept/refuse/undo)"
```

---

## Task 9: Wire `ProspectProvider` + `Relations` to the API

**Files:**
- Modify: `public/prototype/components/Prospect.jsx:73-230` (provider + state)
- Modify: `public/prototype/components/Prospect.jsx:1592-1828` (Relations component)

- [ ] **Step 1: Replace `INITIAL_PENDING_RELATIONS` and accept/refuse logic**

In Prospect.jsx, find the block starting at line 73 (`const INITIAL_PENDING_RELATIONS = [...]`) and the provider initialization at line 105. Replace the whole block from line 73 through the `pendingRelationsCount` definition (line 153) with:

```jsx
const ProspectCtx = React.createContext(null);

function ProspectProvider({ children }) {
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [deleted, setDeleted] = useState({});
  const [removed, setRemoved] = useState({});
  const [hydrated, setHydrated] = useState(false);

  // Hydratation `Mes données` (inchangée).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/prospect/donnees', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setProfile(p => ({
          ...p,
          identity:    { ...p.identity,    ...data.identity },
          localisation:{ ...p.localisation,...data.localisation },
          vie:         { ...p.vie,         ...data.vie },
          pro:         { ...p.pro,         ...data.pro },
          patrimoine:  { ...p.patrimoine,  ...data.patrimoine },
        }));
        const nextDeleted = {};
        (data.hiddenTiers || []).forEach(t => { nextDeleted[t] = true; });
        setDeleted(nextDeleted);
        const nextRemoved = {};
        (data.removedTiers || []).forEach(t => { nextRemoved[t] = true; });
        setRemoved(nextRemoved);
      } catch (e) { console.warn('[prospect/donnees] GET error', e); }
      finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Relations (pending + history) — fetch initial + revalidation ──
  const [pendingRelations, setPendingRelations] = useState([]);
  const [historyRelations, setHistoryRelations] = useState([]);
  const [relationsHydrated, setRelationsHydrated] = useState(false);

  const refetchRelations = React.useCallback(async () => {
    try {
      const r = await fetch('/api/prospect/relations', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setPendingRelations(j.pending || []);
      setHistoryRelations(j.history || []);
    } catch (e) { console.warn('[prospect/relations] GET error', e); }
    finally { setRelationsHydrated(true); }
  }, []);
  useEffect(() => { refetchRelations(); }, [refetchRelations]);

  const postDecision = async (id, action) => {
    try {
      const r = await fetch(`/api/prospect/relations/${id}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        console.warn('[prospect/relations] decision failed', r.status, j);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[prospect/relations] decision error', e);
      return false;
    }
  };

  // États optimistes locaux pour répondre instantanément.
  const [optimistic, setOptimistic] = useState({}); // id → 'accepted' | 'refused' | 'pending'

  const acceptRelation = async (id) => {
    setOptimistic(o => ({ ...o, [id]: 'accepted' }));
    const ok = await postDecision(id, 'accept');
    if (!ok) setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    await refetchRelations();
    setOptimistic({});
  };
  const refuseRelation = async (id) => {
    setOptimistic(o => ({ ...o, [id]: 'refused' }));
    const ok = await postDecision(id, 'refuse');
    if (!ok) setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    await refetchRelations();
    setOptimistic({});
  };
  const undoAcceptRelation = async (id) => {
    setOptimistic(o => ({ ...o, [id]: 'pending' }));
    const ok = await postDecision(id, 'undo');
    if (!ok) setOptimistic(o => { const n = {...o}; delete n[id]; return n; });
    await refetchRelations();
    setOptimistic({});
  };
  const undoRefuseRelation = undoAcceptRelation;

  const accepted = {};
  const refused = {};
  pendingRelations.forEach(r => {
    const ov = optimistic[r.id];
    if (ov === 'accepted') accepted[r.id] = true;
    else if (ov === 'refused') refused[r.id] = true;
  });

  const pendingRelationsCount = pendingRelations.filter(
    r => !accepted[r.id] && !refused[r.id]
  ).length;
```

(Then keep the existing `updateField`, `suppressTemp`, `restore`, `deletePermanent`, `addField`, `setAllCampaignTypes`, `toggleCampaignType`, `toggleCategory` definitions and the existing return / Provider value block. Just update the Provider value to include `historyRelations` and remove `acceptedRelations`/`refusedRelations` setters since we now derive them):

In the same Prospect.jsx, in the `<ProspectCtx.Provider value={{ ... }}>` block (around line 220-227), replace:

```jsx
      pendingRelations, acceptedRelations, refusedRelations,
      acceptRelation, refuseRelation, undoAcceptRelation, undoRefuseRelation,
      pendingRelationsCount,
```

with:

```jsx
      pendingRelations, historyRelations,
      acceptedRelations: accepted, refusedRelations: refused,
      acceptRelation, refuseRelation, undoAcceptRelation, undoRefuseRelation,
      pendingRelationsCount, relationsHydrated,
```

- [ ] **Step 2: Update `Relations` component to consume real history**

Find the `Relations` function (line 1592). Replace the destructuring and the hardcoded `history` array (lines 1593-1605) with:

```jsx
function Relations() {
  const {
    pendingRelations: pending,
    historyRelations,
    acceptedRelations: accepted,
    refusedRelations: refused,
    acceptRelation, refuseRelation,
    undoAcceptRelation, undoRefuseRelation,
    relationsHydrated,
  } = useProspect();
  const history = (historyRelations || []).map(h => ([
    formatHistoryDate(h.date),
    h.proName,
    h.tier,
    h.decision,
    h.status,
    h.gain != null ? '+' + h.gain.toFixed(2).replace('.', ',') : '—',
  ]));
```

Add this helper just above the `Relations` function (around line 1591):

```jsx
function formatHistoryDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short',
  }).format(d);
}
```

Add a "Chargement…" placeholder in the cards grid when `!relationsHydrated && pending.length === 0`. In the Relations component, just before `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>`, add:

```jsx
{!relationsHydrated ? (
  <div className="card" style={{ padding: 24, textAlign: 'center' }}>
    <div className="muted" style={{ fontSize: 13 }}>Chargement de vos sollicitations…</div>
  </div>
) : pending.length === 0 ? (
  <div className="card" style={{ padding: 24, textAlign: 'center' }}>
    <div className="muted" style={{ fontSize: 13 }}>Aucune demande en attente pour le moment.</div>
  </div>
) : (
```

…and close the conditional `)}` after the cards `.map(...)` block ends and before `<div className="card" style={{ padding: 28 }}>` (the Historique card).

- [ ] **Step 3: Update the historique table empty state**

In the same component (around line 1797-1800), the existing empty state already handles `filteredHistory.length === 0`. No change needed there — it now naturally adapts.

- [ ] **Step 4: Manual smoke test**

`npm run dev`, sign in as a prospect with at least one pending relation (created via Task 6 in the pro dashboard). Open `/prospect`, navigate to "Mises en relation":
- The card shows the pro's actual `raison_sociale`, the brief, the dates, and the reward.
- Cliquer "+" ouvre la modale avec le détail.
- Cliquer "Accepter" → la card passe en mode accepté + le wallet pro est débité (vérifie via Supabase ou Facturation pro).
- Cliquer "Revenir sur mon acceptation" → repasse en pending, wallet recrédité.
- Cliquer "Refuser" → card passe en refusée, aucun débit.
- Recharge la page : l'état persiste (lecture DB).
- L'historique liste les décisions avec gain + date.

- [ ] **Step 5: Commit**

```bash
git add public/prototype/components/Prospect.jsx
git commit -m "feat(prospect): wire Relations to /api/prospect/relations + decision API"
```

---

## Task 10: Initial tab handling — `/prospect?tab=relations`

**Files:**
- Modify: `app/prospect/page.tsx`
- Modify: `app/_components/PrototypeFrame.tsx`
- Modify: `public/prototype/shell.html`
- Modify: `public/prototype/components/Prospect.jsx:246-279`

- [ ] **Step 1: Read `tab` searchParam in the page**

Replace `app/prospect/page.tsx`:

```tsx
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import PrototypeFrame from "../_components/PrototypeFrame";

export const metadata = { title: "BUUPP — Espace Prospect" };

const VALID_TABS = new Set([
  "portefeuille", "donnees", "relations", "verif", "score",
  "prefs", "parrainage", "fiscal",
]);

type SearchParams = Promise<{ tab?: string }>;

export default async function ProspectPage(props: { searchParams: SearchParams }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Auth required");

  const user = await currentUser();
  const primary = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  );
  await ensureProspect({
    clerkUserId: userId,
    email: primary?.emailAddress ?? null,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("prospects")
    .select("id, bupp_score, verification, created_at")
    .single();
  if (error) {
    console.error("[/prospect] Lecture RLS échouée :", error);
  }

  const sp = await props.searchParams;
  const tab = sp.tab && VALID_TABS.has(sp.tab) ? sp.tab : null;

  return <PrototypeFrame route="prospect" tab={tab} />;
}
```

- [ ] **Step 2: Forward `tab` to the iframe URL**

Replace `app/_components/PrototypeFrame.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";

const ROUTE_TO_PATH: Record<string, string> = {
  landing: "/",
  waitlist: "/liste-attente",
  auth: "/connexion",
  prospect: "/prospect",
  pro: "/pro",
};

export default function PrototypeFrame({
  route,
  tab,
}: {
  route: "auth" | "prospect" | "pro" | "waitlist";
  tab?: string | null;
}) {
  const router = useRouter();
  const { signOut } = useClerk();

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const data = e.data as
        | { bupp?: string; route?: string }
        | undefined;
      if (!data?.bupp) return;
      if (data.bupp === "signOut") {
        await signOut({ redirectUrl: "/" });
        return;
      }
      if (data.bupp === "goto") {
        const target = data.route && ROUTE_TO_PATH[data.route];
        if (!target) return;
        if (target === "/liste-attente") {
          try { sessionStorage.setItem("bupp:waitlist-ok", "1"); } catch {}
        }
        router.push(target);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router, signOut]);

  const hash = tab ? `${route}?tab=${encodeURIComponent(tab)}` : route;

  return (
    <iframe
      src={`/prototype/shell.html#${hash}`}
      title={`BUUPP — ${route}`}
      style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        border: 0, display: "block", background: "#F7F4EC",
      }}
    />
  );
}
```

- [ ] **Step 3: Parse the `?tab=` after the route hash in `shell.html`**

In `public/prototype/shell.html`, find the inline script (around line 31). Replace the `readRoute` function and the `App` component's `route` handling:

```html
    function readRouteAndTab() {
      const raw = (window.location.hash || '').replace('#', '').trim();
      const [route, query] = raw.split('?');
      let tab = null;
      if (query) {
        const params = new URLSearchParams(query);
        tab = params.get('tab');
      }
      const safeRoute = ['landing','auth','prospect','pro','waitlist'].includes(route) ? route : 'landing';
      return { route: safeRoute, tab };
    }

    function App() {
      const initial = readRouteAndTab();
      const [route, setRoute] = React.useState(initial.route);
      const [initialTab, setInitialTab] = React.useState(initial.tab);

      React.useEffect(() => {
        const onHash = () => {
          const next = readRouteAndTab();
          setRoute(next.route);
          setInitialTab(next.tab);
        };
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
      }, []);

      React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        try { window.parent && window.parent.postMessage({ bupp: 'route', route }, '*'); } catch (_) {}
      }, [route]);

      const go = (r) => {
        if (window.parent && window.parent !== window) {
          try { window.parent.postMessage({ bupp: 'goto', route: r }, '*'); return; } catch (_) {}
        }
        window.location.hash = r;
      };

      return (
        <>
          {route === 'landing' && <Landing go={go}/>}
          {route === 'auth' && <Auth go={go}/>}
          {route === 'prospect' && <ProspectDashboard go={go} initialTab={initialTab}/>}
          {route === 'pro' && <ProDashboard go={go}/>}
          {route === 'waitlist' && (
            <div style={{ position:'fixed', inset:0, background:'#080808', zIndex: 1 }}>
              <iframe src="/prototype/waitlist.html" title="Wait List" style={{ width:'100%', height:'100%', border:0, display:'block' }}/>
            </div>
          )}
        </>
      );
    }
```

- [ ] **Step 4: Honor `initialTab` in `ProspectDashboard`**

In `public/prototype/components/Prospect.jsx`, find:

```jsx
function ProspectDashboard({ go }) {
  return (
    <ProspectProvider>
      <ProspectDashboardInner go={go}/>
    </ProspectProvider>
  );
}

function ProspectDashboardInner({ go }) {
  const [sec, setSec] = useState('portefeuille');
```

Replace with:

```jsx
function ProspectDashboard({ go, initialTab }) {
  return (
    <ProspectProvider>
      <ProspectDashboardInner go={go} initialTab={initialTab}/>
    </ProspectProvider>
  );
}

function ProspectDashboardInner({ go, initialTab }) {
  const [sec, setSec] = useState(initialTab || 'portefeuille');
```

- [ ] **Step 5: Manual smoke test**

`npm run dev`, sign in as a prospect, then visit `http://localhost:3000/prospect?tab=relations`. Expected: dashboard opens directly on the "Mises en relation" tab.

- [ ] **Step 6: Commit**

```bash
git add app/prospect/page.tsx app/_components/PrototypeFrame.tsx public/prototype/shell.html public/prototype/components/Prospect.jsx
git commit -m "feat(prospect): /prospect?tab=relations deep-links the relations tab"
```

---

## Task 11: GET `/api/pro/contacts` + wire `Contacts()`

**Files:**
- Create: `app/api/pro/contacts/route.ts`
- Modify: `public/prototype/components/Pro.jsx:2057-2180`

- [ ] **Step 1: Write the handler**

```ts
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

export async function GET() {
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
  const { data, error } = await admin
    .from("relations")
    .select(
      `id, decided_at, status,
       campaigns ( name, targeting ),
       prospects:prospect_id ( id, bupp_score,
         prospect_identity ( prenom, nom, email, telephone )
       )`,
    )
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .order("decided_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[/api/pro/contacts] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    id: string;
    decided_at: string | null;
    status: string;
    campaigns: { name: string; targeting: { requiredTiers?: number[] } | null } | null;
    prospects: {
      id: string;
      bupp_score: number;
      prospect_identity: { prenom: string | null; nom: string | null; email: string | null; telephone: string | null } | null;
    } | null;
  };

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
    const fullName =
      `${ident?.prenom ?? ""} ${ident?.nom ?? ""}`.trim() || "Prospect anonyme";
    return {
      relationId: r.id,
      name: fullName,
      score: id?.bupp_score ?? 0,
      campaign: camp?.name ?? "—",
      tier,
      email: maskEmail(ident?.email),
      telephone: maskPhone(ident?.telephone),
      receivedAt: r.decided_at,
      evaluation: null as null | "valide" | "difficile" | "invalide",
    };
  });

  return NextResponse.json({ rows });
}
```

- [ ] **Step 2: Wire `Contacts()` in Pro.jsx**

Replace the body of `function Contacts()` (lines 2057-2074) up to the `return` :

```jsx
function Contacts() {
  const [allRows, setAllRows] = React.useState(null); // null = loading
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/contacts', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(j => { if (!cancelled) setAllRows(j.rows || []); })
      .catch(() => { if (!cancelled) setAllRows([]); });
    return () => { cancelled = true; };
  }, []);

  const FILTERS = {
    f1: { label: 'Score ≥ 720',        test: r => Number(r.score) >= 720 },
    f2: { label: "Évaluation validée", test: r => r.evaluation === 'valide' },
    f3: { label: 'Palier 2',            test: r => Number(r.tier) === 2 },
  };
  const [active, setActive] = useState(new Set());
  const toggle = (k) => setActive(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const clear = () => setActive(new Set());
  const ALL = allRows || [];
  const rows = active.size === 0 ? ALL : ALL.filter(r => [...active].every(k => FILTERS[k].test(r)));
```

Then replace the `<tbody>` body (lines ~2134-2167) with:

```jsx
            <tbody>
              {allRows === null && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div className="muted" style={{ fontSize: 13 }}>Chargement…</div>
                </td></tr>
              )}
              {allRows !== null && rows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {allRows.length === 0
                      ? 'Aucun prospect n\'a encore accepté de mise en relation.'
                      : 'Aucun prospect ne correspond aux filtres activés.'}
                  </div>
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.relationId || i}>
                  <td className="row center gap-3"><Avatar name={r.name} size={28}/><span>{r.name}</span></td>
                  <td className="mono tnum">{r.score}</td>
                  <td className="muted">{r.campaign}</td>
                  <td><span className="chip">P{r.tier}</span></td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.email}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.telephone}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{formatRelativeFr(r.receivedAt)}</td>
                  <td>
                    {r.evaluation === 'valide' ? <span className="chip chip-good">✓ Valide</span>
                      : r.evaluation === 'difficile' ? <span className="chip chip-warn">Difficile</span>
                      : <div className="row gap-1">
                        <button className="chip" style={{ cursor:'pointer' }}>Valide</button>
                        <button className="chip" style={{ cursor:'pointer' }}>Diff.</button>
                        <button className="chip" style={{ cursor:'pointer' }}>Invalide</button>
                      </div>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}><Icon name="phone" size={12}/></button>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}><Icon name="email" size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
```

Add a tiny helper above `Contacts`:

```jsx
function formatRelativeFr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const now = Date.now();
  const diff = now - d.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'à l\'instant';
  if (h < 24) return `il y a ${h} h`;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(d);
}
```

- [ ] **Step 3: Manual smoke test**

`npm run dev`, login pro, accept relations from the prospect side first, then check pro's "Mes contacts" tab — entries appear with watermarked email/phone.

- [ ] **Step 4: Commit**

```bash
git add app/api/pro/contacts/route.ts public/prototype/components/Pro.jsx
git commit -m "feat(pro/contacts): wire to GET /api/pro/contacts with watermarked PII"
```

---

## Task 12: GET `/api/pro/analytics` + wire `Analytics()`

**Files:**
- Create: `app/api/pro/analytics/route.ts`
- Modify: `public/prototype/components/Pro.jsx:2182-2286`

- [ ] **Step 1: Write the handler**

```ts
/**
 * GET /api/pro/analytics — agrégats de performance des campagnes du pro.
 *
 * Calculés en mémoire à partir de la table `relations` (status finaux et
 * campagnes ciblant chaque palier). Pour les 4 breakdowns (palier, géo,
 * âge, sexe), la base est : `relations` du pro avec status `accepted` ou
 * `settled` (ce qui se compte comme "réussite") joint sur prospects.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";
import { ageFromBirthString } from "@/lib/campaigns/mapping";

export const runtime = "nodejs";

const AGE_BUCKETS: Array<[string, number, number]> = [
  ["18–25", 18, 25], ["26–35", 26, 35], ["36–45", 36, 45],
  ["46–55", 46, 55], ["56–65", 56, 65], ["65+", 66, 200],
];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("relations")
    .select(
      `status,
       campaigns ( targeting ),
       prospects:prospect_id (
         prospect_identity ( naissance, genre ),
         prospect_localisation ( ville )
       )`,
    )
    .eq("pro_account_id", proId);

  if (error) {
    console.error("[/api/pro/analytics] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    status: string;
    campaigns: { targeting: { requiredTiers?: number[] } | null } | null;
    prospects: {
      prospect_identity: { naissance: string | null; genre: string | null } | null;
      prospect_localisation: { ville: string | null } | null;
    } | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const camp = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns;
    const id = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
    const pi = id?.prospect_identity
      ? (Array.isArray(id.prospect_identity) ? id.prospect_identity[0] : id.prospect_identity)
      : null;
    const pl = id?.prospect_localisation
      ? (Array.isArray(id.prospect_localisation) ? id.prospect_localisation[0] : id.prospect_localisation)
      : null;
    return {
      status: r.status,
      tiers: (camp?.targeting?.requiredTiers ?? []) as number[],
      naissance: pi?.naissance ?? null,
      genre: pi?.genre ?? null,
      ville: pl?.ville ?? null,
    };
  });

  const isWin = (s: string) => s === "accepted" || s === "settled";
  const isFinal = (s: string) =>
    s === "accepted" || s === "settled" || s === "refused" || s === "expired";

  // 1. Acceptance rate by tier (on relations finales).
  const acceptanceByTier = [1, 2, 3, 4, 5].map((tier) => {
    const finals = rows.filter((r) => isFinal(r.status) && r.tiers.includes(tier));
    const wins = finals.filter((r) => isWin(r.status));
    const pct = finals.length === 0 ? 0 : Math.round((wins.length / finals.length) * 100);
    const labels = ["Identification", "Localisation", "Style de vie", "Pro", "Patrimoine"];
    return { tier, label: labels[tier - 1], pct };
  });

  // 2. Geographic top 5 par taux d'acceptation.
  const geoMap = new Map<string, { wins: number; finals: number }>();
  for (const r of rows) {
    if (!isFinal(r.status) || !r.ville) continue;
    const m = geoMap.get(r.ville) || { wins: 0, finals: 0 };
    m.finals++; if (isWin(r.status)) m.wins++;
    geoMap.set(r.ville, m);
  }
  const geoBreakdown = Array.from(geoMap.entries())
    .map(([ville, m]) => ({
      ville,
      contacts: m.wins,
      pct: m.finals === 0 ? 0 : Math.round((m.wins / m.finals) * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  // 3. Age breakdown sur relations gagnées.
  const ageWins = AGE_BUCKETS.map(() => 0);
  let ageTotal = 0;
  for (const r of rows) {
    if (!isWin(r.status)) continue;
    const age = ageFromBirthString(r.naissance);
    if (age == null) continue;
    const idx = AGE_BUCKETS.findIndex(([, lo, hi]) => age >= lo && age <= hi);
    if (idx < 0) continue;
    ageWins[idx]++; ageTotal++;
  }
  const ageBreakdown = AGE_BUCKETS.map(([label], i) => ({
    label,
    pct: ageTotal === 0 ? 0 : Math.round((ageWins[i] / ageTotal) * 100),
  }));

  // 4. Sex breakdown.
  const genres = { femme: 0, homme: 0, autre: 0 } as Record<string, number>;
  let genreTotal = 0;
  for (const r of rows) {
    if (!isWin(r.status)) continue;
    const g = (r.genre || "autre").toLowerCase();
    const key = g === "femme" || g === "homme" ? g : "autre";
    genres[key]++; genreTotal++;
  }
  const sexBreakdown = [
    { label: "Femmes", pct: genreTotal === 0 ? 0 : Math.round((genres.femme / genreTotal) * 100) },
    { label: "Hommes", pct: genreTotal === 0 ? 0 : Math.round((genres.homme / genreTotal) * 100) },
    { label: "Autre / non précisé", pct: genreTotal === 0 ? 0 : Math.round((genres.autre / genreTotal) * 100) },
  ];

  return NextResponse.json({
    acceptanceByTier, geoBreakdown, ageBreakdown, sexBreakdown,
    sampleSize: { rows: rows.length, wins: rows.filter((r) => isWin(r.status)).length },
  });
}
```

- [ ] **Step 2: Wire `Analytics()` in Pro.jsx**

Replace the `function Analytics() { ... }` body at lines 2182-2286 with the version below. The structure is identical to the original — only the data source changes.

```jsx
function Analytics() {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/analytics', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled) setData(j); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, []);
  const empty = !data || data.sampleSize?.wins === 0;
  const acceptance = data?.acceptanceByTier || [
    {tier:1,label:'Identification',pct:0},{tier:2,label:'Localisation',pct:0},
    {tier:3,label:'Style de vie',pct:0},{tier:4,label:'Pro',pct:0},
    {tier:5,label:'Patrimoine',pct:0},
  ];
  const geo = data?.geoBreakdown || [];
  const ages = data?.ageBreakdown || [];
  const sex = data?.sexBreakdown || [
    {label:'Femmes',pct:0},{label:'Hommes',pct:0},{label:'Autre / non précisé',pct:0},
  ];

  return (
    <div className="col gap-6">
      <SectionTitle eyebrow="Analytics" title="Performance fine" desc={empty
        ? "Aucune mise en relation acceptée pour le moment — les graphiques s'animent dès le premier contact."
        : "Analyses sur 30 derniers jours · mise à jour toutes les 15 minutes"}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Taux d'acceptation par palier</div>
          {acceptance.map(r => (
            <div key={r.tier} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}><span className="chip">P{r.tier}</span> {r.label}</span>
                <span className="mono tnum">{r.pct}%</span>
              </div>
              <Progress value={r.pct/100}/>
            </div>
          ))}
        </div>
        <div className="card analytics-creneaux" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Meilleurs créneaux</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>Heatmap du taux d'acceptation heure × jour</div>
          <Heatmap/>
        </div>
      </div>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Répartition géographique</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 18 }}>Pourcentage de contacts acceptés par zone</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {geo.length === 0 && (
            <div className="muted" style={{ gridColumn: '1 / -1', fontSize: 13, padding: 16 }}>
              Aucune ville renseignée chez vos prospects acceptés pour le moment.
            </div>
          )}
          {geo.map((r, i) => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="serif" style={{ fontSize: 18 }}>{r.ville}</div>
              <div className="serif tnum" style={{ fontSize: 28, color: 'var(--accent)' }}>{r.pct}%</div>
              <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{r.contacts} contact{r.contacts > 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Répartition par tranche d'âge</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 20 }}>Pourcentage de contacts acceptés par segment</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {ages.map(({ label: l, pct: v }, i) => (
            <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="mono caps muted" style={{ fontSize: 10, marginBottom: 4 }}>{l}</div>
              <div className="serif tnum" style={{ fontSize: 28, color: 'var(--accent)' }}>{v}%</div>
              <div style={{ height: 4, background: 'var(--ivory-2)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: Math.min(100, v * 3) + '%', background: 'var(--accent)', borderRadius: 999 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 28 }}>
        <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Répartition par sexe</div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 20 }}>Pourcentage de contacts acceptés par genre déclaré</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            [sex[0].label, sex[0].pct, 'color-mix(in oklab, var(--accent) 90%, #EC4899)'],
            [sex[1].label, sex[1].pct, 'var(--accent)'],
            [sex[2].label, sex[2].pct, 'var(--ink-4)'],
          ].map(([l, v, c], i) => (
            <div key={i} style={{ padding: 20, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="row between center" style={{ marginBottom: 10 }}>
                <div className="mono caps muted" style={{ fontSize: 10 }}>{l}</div>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: c }}/>
              </div>
              <div className="serif tnum" style={{ fontSize: 36, color: c }}>{v}%</div>
              <div style={{ height: 6, background: 'var(--ivory-2)', borderRadius: 999, marginTop: 12, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: v + '%', background: c, borderRadius: 999 }}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, height: 14, borderRadius: 999, overflow: 'hidden', display: 'flex', border: '1px solid var(--line)' }}>
          <div style={{ width: sex[0].pct + '%', background: 'color-mix(in oklab, var(--accent) 90%, #EC4899)' }}/>
          <div style={{ width: sex[1].pct + '%', background: 'var(--accent)' }}/>
          <div style={{ width: sex[2].pct + '%', background: 'var(--ink-4)' }}/>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke test**

`npm run dev`, login pro, navigate to Analytics. Sample data is empty for a fresh account — the empty-state copy appears. After accepting relations from the prospect side, refresh: real percentages.

- [ ] **Step 4: Commit**

```bash
git add app/api/pro/analytics/route.ts public/prototype/components/Pro.jsx
git commit -m "feat(pro/analytics): wire Analytics tab to GET /api/pro/analytics"
```

---

## Task 13: GET `/api/pro/overview` + wire `Overview()`

**Files:**
- Create: `app/api/pro/overview/route.ts`
- Modify: `public/prototype/components/Pro.jsx:160-247`

- [ ] **Step 1: Write the handler**

```ts
/**
 * GET /api/pro/overview — KPI cards de la Vue d'ensemble pro.
 *  - contactsAccepted30d : count(relations status in (accepted, settled) AND decided_at >= 30d ago)
 *  - acceptanceRate      : wins / finals (toutes campagnes confondues)
 *  - avgCostCents        : moyenne des reward_cents sur relations gagnées 30d
 *  - lastAcceptances     : 4 dernières acceptations pour le tableau "Dernières acceptations"
 *  - tierBreakdown       : 5 paliers, count + somme reward
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("relations")
    .select(
      `id, status, reward_cents, decided_at,
       campaigns ( name, targeting ),
       prospects:prospect_id ( bupp_score,
         prospect_identity ( prenom, nom )
       )`,
    )
    .eq("pro_account_id", proId)
    .order("decided_at", { ascending: false });

  if (error) {
    console.error("[/api/pro/overview] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  type Row = {
    id: string;
    status: string;
    reward_cents: number;
    decided_at: string | null;
    campaigns: { name: string; targeting: { requiredTiers?: number[] } | null } | null;
    prospects: {
      bupp_score: number;
      prospect_identity: { prenom: string | null; nom: string | null } | null;
    } | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const c = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns;
    const id = Array.isArray(r.prospects) ? r.prospects[0] : r.prospects;
    const pi = id?.prospect_identity
      ? (Array.isArray(id.prospect_identity) ? id.prospect_identity[0] : id.prospect_identity)
      : null;
    const tiers = (c?.targeting?.requiredTiers ?? [1]) as number[];
    return {
      id: r.id,
      status: r.status,
      reward_cents: Number(r.reward_cents ?? 0),
      decided_at: r.decided_at,
      campaign: c?.name ?? "—",
      tier: Math.max(1, ...tiers.map((n) => Number(n) || 0)),
      score: id?.bupp_score ?? 0,
      name: `${pi?.prenom ?? ""} ${pi?.nom ?? ""}`.trim() || "Prospect anonyme",
    };
  });

  const isWin = (s: string) => s === "accepted" || s === "settled";
  const isFinal = (s: string) =>
    s === "accepted" || s === "settled" || s === "refused" || s === "expired";

  const wins30d = rows.filter(
    (r) => isWin(r.status) && r.decided_at && r.decided_at >= since,
  );
  const finals = rows.filter((r) => isFinal(r.status));
  const wins = rows.filter((r) => isWin(r.status));
  const acceptanceRate =
    finals.length === 0 ? 0 : Math.round((wins.length / finals.length) * 100);
  const avgCostCents =
    wins30d.length === 0
      ? 0
      : Math.round(
          wins30d.reduce((acc, r) => acc + r.reward_cents, 0) / wins30d.length,
        );

  const lastAcceptances = wins.slice(0, 4).map((r) => ({
    name: r.name, score: r.score, campaign: r.campaign, tier: r.tier,
    receivedAt: r.decided_at, costCents: r.reward_cents,
  }));

  const tierBreakdown = [1, 2, 3, 4, 5].map((tier) => {
    const ws = wins.filter((r) => r.tier === tier);
    return {
      tier,
      label: ["Identification","Localisation","Style de vie","Pro","Patrimoine"][tier - 1],
      contacts: ws.length,
      totalCents: ws.reduce((acc, r) => acc + r.reward_cents, 0),
    };
  });

  return NextResponse.json({
    contactsAccepted30d: wins30d.length,
    acceptanceRate,
    avgCostCents,
    lastAcceptances,
    tierBreakdown,
  });
}
```

- [ ] **Step 2: Wire `Overview()` in Pro.jsx**

Replace the `function Overview({ onCreate })` body (lines 160-247). Keep the same JSX skeleton but pull data from the API:

```jsx
function Overview({ onCreate }) {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/pro/overview', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled) setData(j); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, []);
  const fmt2 = v => Number(v ?? 0).toFixed(2).replace('.', ',');
  const k1 = data?.contactsAccepted30d ?? 0;
  const k2 = (data?.acceptanceRate ?? 0) + '%';
  const k3 = fmt2((data?.avgCostCents ?? 0) / 100) + ' €';
  const last = data?.lastAcceptances || [];
  const tiers = data?.tierBreakdown || [];

  return (
    <div className="col gap-6">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          ['Contacts acceptés (30j)', String(k1), '', 'trend'],
          ["Taux d'acceptation", k2, '', 'check'],
          ['Coût moyen / contact', k3, '', 'money'],
          ['ROI estimé', k1 === 0 ? '—' : '×' + (1 + k1 * 0.15).toFixed(1).replace('.', ','), '', 'sparkle'],
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: 20 }}>
            <div className="row between center" style={{ marginBottom: 14 }}>
              <div className="mono caps muted" style={{ fontSize: 10 }}>{k[0]}</div>
              <span style={{ color: 'var(--accent)' }}><Icon name={k[3]} size={14}/></span>
            </div>
            <div className="serif tnum" style={{ fontSize: 36 }}>{k[1]}</div>
            {k[2] && <div className="mono" style={{ fontSize: 12, color: 'var(--good)', marginTop: 4 }}>{k[2]} vs mois dernier</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <div className="serif" style={{ fontSize: 22 }}>Performance des campagnes</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Contacts obtenus, 30 derniers jours</div>
            </div>
            <div className="row gap-2">
              {['7J', '30J', '90J'].map((t, i) => (
                <button key={t} className="chip" style={{ cursor: 'pointer', background: i === 1 ? 'var(--ink)' : 'var(--ivory-2)', color: i === 1 ? 'var(--paper)' : 'var(--ink-3)', border: 0 }}>{t}</button>
              ))}
            </div>
          </div>
          <BarChart/>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Répartition par palier</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 18 }}>Coût et volume des 30 derniers jours</div>
          {tiers.length === 0 && (
            <div className="muted" style={{ fontSize: 13 }}>Aucun contact accepté pour le moment.</div>
          )}
          {tiers.map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: i < tiers.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}><span className="chip">P{r.tier}</span> {r.label}</span>
                <span className="mono tnum" style={{ fontSize: 12 }}>{r.contacts} contacts · {fmt2(r.totalCents/100)} €</span>
              </div>
              <Progress value={Math.min(1, r.contacts / 40)}/>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="row between historique-header" style={{ marginBottom: 20 }}>
          <div className="serif" style={{ fontSize: 22 }}>Dernières acceptations</div>
          <button className="btn btn-ghost btn-sm btn-voir-tout">Voir tout <Icon name="arrow" size={12}/></button>
        </div>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead><tr><th>Prospect</th><th>Campagne</th><th>Palier</th><th>BUUPP Score</th><th>Reçu</th><th style={{textAlign:'right'}}>Coût</th></tr></thead>
            <tbody>
              {last.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '28px 12px' }}>
                  <span className="muted" style={{ fontSize: 13 }}>Aucune acceptation pour le moment.</span>
                </td></tr>
              )}
              {last.map((r, i) => (
                <tr key={i}>
                  <td className="row center gap-3"><Avatar name={r.name} size={28}/><span>{r.name}</span></td>
                  <td>{r.campaign}</td>
                  <td><span className="chip">Palier {r.tier}</span></td>
                  <td><span className="mono tnum">{r.score}</span></td>
                  <td className="muted mono">{formatRelativeFr(r.receivedAt)}</td>
                  <td className="mono tnum" style={{ textAlign: 'right' }}>−{fmt2(r.costCents/100)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke test**

`npm run dev`, pro account, Vue d'ensemble shows real KPIs. Empty state when no acceptances yet. Accept some relations and refresh.

- [ ] **Step 4: Commit**

```bash
git add app/api/pro/overview/route.ts public/prototype/components/Pro.jsx
git commit -m "feat(pro/overview): wire KPI cards + last acceptances to GET /api/pro/overview"
```

---

## Task 14: End-to-end smoke test

**Files:** none (validation only)

- [ ] **Step 1: Boot the dev server cleanly**

```bash
rm -rf .next
npm run dev
```

Verify the server starts and responds at http://localhost:3000.

- [ ] **Step 2: Run the spec's manual test plan**

Walk through the 11 steps documented in the spec under "Tests manuels" (`docs/superpowers/specs/2026-05-04-campaign-acceptance-design.md` last section). For each step, note what worked and what didn't.

In particular verify:
- ✅ Lancement campagne → `campaigns` row + `relations` rows + emails envoyés.
- ✅ Email reçu → cliquer le lien → atterrit sur `/prospect?tab=relations` directement sur l'onglet.
- ✅ Accepter → wallet pro débité (visible dans le header), card passe en mode accord.
- ✅ "Revenir sur mon acceptation" → wallet recrédité, card repasse en pending.
- ✅ "Mes contacts" pro → prospect apparaît avec email/tél masqués après acceptation.
- ✅ "Analytics" pro → palier acquérant un % > 0, ville top 1, bucket d'âge, sexe.

- [ ] **Step 3: Lint pass**

```bash
npm run lint
```

Expected: no new warnings/errors. Fix any introduced by the new files (most likely `react-hooks/exhaustive-deps` on the new `useEffect` blocks — already wrapped with cleanup).

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: build succeeds. Typescript errors here would have been caught earlier by `npx tsc --noEmit`, but `next build` validates the route handler signatures.

- [ ] **Step 5: Final commit if any cleanups**

```bash
git add -A
git commit -m "chore(campaigns): post-smoke fixes" || echo "nothing to commit"
```
