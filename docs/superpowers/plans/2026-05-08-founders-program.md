# Founders Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Founder" status (waitlist members at launch day) granting +10 min priority on flash deals and a 2× reward bonus during the 1st month, financed by the pro with per-campaign opt-out.

**Architecture:** Schema change (`app_config` singleton + flags on `prospects`/`campaigns`/`relations`), trigger that syncs `is_founder` from waitlist via `prospect_identity.email`, RPC `accept_relation_tx` reads the three flags + window helper to apply the 2× bonus atomically. UI surfaces the badge (prospect dashboard, flash deal modal), the toggle (pro create-campaign), and the legal disclosures (CGU/CGV).

**Tech Stack:** Postgres (Supabase migrations), Next.js 16 client+server components, Clerk auth, prototype JSX (in-browser Babel).

**Reference spec:** `docs/superpowers/specs/2026-05-08-founders-program-design.md`.

**No test framework in repo** → verifications use manual SQL queries, `curl`, and UI checks. Each task ends with a verification step before commit.

---

## Task 1: Migration A — schema (app_config, flags, trigger, window helper)

**Files:**
- Create: `supabase/migrations/20260508120000_founders_program.sql`

- [ ] **Step 1: Write the migration**

Full file content:

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Programme Fondateur (Phase 1 : schéma)
-- ════════════════════════════════════════════════════════════════════
-- Singleton `app_config` (date de lancement), flag `is_founder` sur
-- `prospects`, toggle `founder_bonus_enabled` sur `campaigns`, snapshot
-- `founder_bonus_applied` sur `relations`. Trigger sur
-- `prospect_identity` qui synchronise `prospects.is_founder` depuis la
-- waitlist (matching email + date). Helper SQL pour la fenêtre 1 mois.
-- La RPC `accept_relation_tx` est mise à jour dans une migration
-- séparée pour isoler l'évolution financière.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Table de configuration globale (singleton) ─────────────────
create table public.app_config (
  id boolean primary key default true check (id),
  launch_at timestamptz not null,
  updated_at timestamptz default now()
);

-- Seed initial : date placeholder très éloignée → fenêtre 1 mois
-- déjà expirée, donc aucun bonus n'est appliqué tant qu'un admin
-- n'a pas explicitement UPDATE la valeur (fail-safe).
insert into public.app_config (id, launch_at)
values (true, '1970-01-01T00:00:00Z')
on conflict (id) do nothing;

-- ─── 2. Flag fondateur sur le prospect ─────────────────────────────
alter table public.prospects
  add column is_founder boolean not null default false;

create index prospects_is_founder_idx on public.prospects (is_founder)
  where is_founder = true;

-- ─── 3. Toggle pro par campagne (default ON) ───────────────────────
alter table public.campaigns
  add column founder_bonus_enabled boolean not null default true;

-- ─── 4. Snapshot bonus appliqué (audit + email) ────────────────────
alter table public.relations
  add column founder_bonus_applied boolean not null default false;

-- ─── 5. Trigger : sync is_founder depuis prospect_identity.email ───
create or replace function public.sync_founder_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_launch_at timestamptz;
  v_email_in_waitlist boolean;
begin
  if new.email is null then
    update public.prospects
       set is_founder = false
     where id = new.prospect_id;
    return new;
  end if;

  select launch_at into v_launch_at from public.app_config where id = true;
  if v_launch_at is null then
    return new;
  end if;

  select exists (
    select 1 from public.waitlist w
     where lower(w.email) = lower(new.email)
       and w.created_at <= v_launch_at
  ) into v_email_in_waitlist;

  update public.prospects
     set is_founder = v_email_in_waitlist
   where id = new.prospect_id;

  return new;
end;
$$;

create trigger prospect_identity_sync_founder_status
  after insert or update of email on public.prospect_identity
  for each row execute function public.sync_founder_status();

-- ─── 6. Helper : fenêtre 1 mois post-lancement ─────────────────────
create or replace function public.is_within_founder_bonus_window()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_config
     where now() <= launch_at + interval '1 month'
  );
$$;

revoke all on function public.is_within_founder_bonus_window() from public;
grant execute on function public.is_within_founder_bonus_window() to anon, authenticated;
```

- [ ] **Step 2: Apply locally**

Run: `npx supabase db reset`
Expected: migration applies without error, schema includes the new columns.

- [ ] **Step 3: Sanity SQL — verify schema**

Run via psql or Supabase studio:
```sql
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='prospects' and column_name='is_founder';
-- Expected: 1 row, boolean

select tgname from pg_trigger
 where tgname='prospect_identity_sync_founder_status';
-- Expected: 1 row

select public.is_within_founder_bonus_window();
-- Expected: false (launch_at is 1970)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260508120000_founders_program.sql
git commit -m "feat(db): founders schema — app_config, flags, sync trigger, window helper"
```

---

## Task 2: Migration B — `accept_relation_tx` applies the 2× bonus

**Files:**
- Create: `supabase/migrations/20260508120100_accept_relation_tx_founder_bonus.sql`

- [ ] **Step 1: Read the existing RPC to preserve all current invariants**

Run: read `supabase/migrations/20260504220000_accept_relation_lock_fix_and_grants.sql` lines 16-80 to capture the current shape (locking, escrow inserts, error names).

Expected: the existing function locks the relation row, validates status/expiration, inserts escrow rows, sets `relations.status = 'accepted'`. We will preserve all of this and only branch on the bonus.

- [ ] **Step 2: Write the new migration**

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Programme Fondateur (Phase 2 : RPC d'acceptation)
-- ════════════════════════════════════════════════════════════════════
-- Modifie `accept_relation_tx` pour appliquer un bonus ×2 quand :
--   prospects.is_founder = true
--   AND campaigns.founder_bonus_enabled = true
--   AND public.is_within_founder_bonus_window() = true
-- Le débit pro et le reward prospect sont doublés, et
-- `relations.founder_bonus_applied` est positionné à true (snapshot).
-- En cas de solde pro insuffisant pour 2×, on raise comme pour le
-- débit standard : `insufficient_pro_funds`.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.accept_relation_tx(p_relation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_pro_id uuid;
  v_prospect_id uuid;
  v_status text;
  v_expires_at timestamptz;
  v_cost_per_contact_cents bigint;
  v_pro_balance_cents bigint;
  v_is_founder boolean;
  v_bonus_enabled boolean;
  v_in_window boolean;
  v_apply_bonus boolean := false;
  v_reward_cents bigint;
begin
  -- Verrouille la relation pour éviter une double acceptation concurrente.
  select r.campaign_id, r.prospect_id, r.status, r.expires_at,
         c.cost_per_contact_cents, c.pro_id, c.founder_bonus_enabled,
         p.is_founder
    into v_campaign_id, v_prospect_id, v_status, v_expires_at,
         v_cost_per_contact_cents, v_pro_id, v_bonus_enabled,
         v_is_founder
    from public.relations r
    join public.campaigns c on c.id = r.campaign_id
    join public.prospects p on p.id = r.prospect_id
   where r.id = p_relation_id
     for update of r;

  if v_campaign_id is null then
    raise exception 'relation_not_found';
  end if;
  if v_status <> 'pending' then
    raise exception 'invalid_status';
  end if;
  if v_expires_at <= now() then
    raise exception 'relation_expired';
  end if;

  v_in_window := public.is_within_founder_bonus_window();
  v_apply_bonus := v_is_founder and v_bonus_enabled and v_in_window;

  v_reward_cents := v_cost_per_contact_cents;
  if v_apply_bonus then
    v_reward_cents := v_reward_cents * 2;
  end if;

  -- Verrouille le compte pro pour la vérif du solde.
  select balance_cents into v_pro_balance_cents
    from public.pro_accounts
   where id = v_pro_id
     for update;

  if v_pro_balance_cents < v_reward_cents then
    raise exception 'insufficient_pro_funds';
  end if;

  -- Bascule la relation en accepted + snapshot bonus.
  update public.relations
     set status = 'accepted',
         decided_at = now(),
         reward_cents = v_reward_cents,
         founder_bonus_applied = v_apply_bonus
   where id = p_relation_id;

  -- Débit pro vers escrow (= reward effectif).
  update public.pro_accounts
     set balance_cents = balance_cents - v_reward_cents
   where id = v_pro_id;

  -- Inserts escrow : on conserve la structure existante avec deux
  -- mouvements distincts (acceptation campagne + récompense en attente).
  insert into public.pro_movements (pro_id, amount_cents, kind, relation_id, campaign_id, label)
  values (v_pro_id, -v_reward_cents, 'escrow', p_relation_id, v_campaign_id, 'Séquestre acceptation campagne');

  insert into public.prospect_movements (prospect_id, amount_cents, kind, relation_id, campaign_id, label)
  values (v_prospect_id, v_reward_cents, 'escrow', p_relation_id, v_campaign_id, 'Séquestre récompense — en attente de débit');
end;
$$;

revoke all on function public.accept_relation_tx(uuid) from public;
grant execute on function public.accept_relation_tx(uuid) to authenticated;
```

> **Note importante :** la signature `accept_relation_tx(p_relation_id uuid)` est inchangée. Toute la logique financière reste atomique (verrous `FOR UPDATE` + compute + writes dans la même transaction). Le seul ajout fonctionnel est la lecture des trois conditions et la multiplication conditionnelle.

- [ ] **Step 3: Apply + sanity SQL**

Run: `npx supabase db reset`

Run:
```sql
-- Vérifie que la fonction existe et est SECURITY DEFINER.
select prosecdef from pg_proc where proname='accept_relation_tx';
-- Expected: t (true)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260508120100_accept_relation_tx_founder_bonus.sql
git commit -m "feat(db): accept_relation_tx applies founder 2x bonus when eligible"
```

---

## Task 3: SQL functional smoke test (manual)

**Files:**
- N/A (pure SQL verification, no code changes)

- [ ] **Step 1: Insert a fake waitlist + fake prospect to test the trigger**

Run via SQL console:
```sql
-- 1) Pose la date de lancement à demain pour éviter les races.
update public.app_config set launch_at = now() + interval '1 day' where id = true;

-- 2) Insère un email dans waitlist.
insert into public.waitlist (email, prenom, nom, ville)
values ('test-founder@example.com', 'Test', 'Founder', 'Pau');

-- 3) Insère un prospect (clerk_user_id factice) puis prospect_identity.
insert into public.prospects (clerk_user_id) values ('clerk_test_founder') returning id;
-- Récupère l'id renvoyé, mettons :prospect_id

insert into public.prospect_identity (prospect_id, email)
values (:prospect_id, 'test-founder@example.com');

-- 4) Vérifie le flag.
select is_founder from public.prospects where id = :prospect_id;
-- Expected: t (true)
```

- [ ] **Step 2: Test du contre-cas (email inconnu)**

```sql
insert into public.prospects (clerk_user_id) values ('clerk_test_random') returning id;
-- :prospect_id_2

insert into public.prospect_identity (prospect_id, email)
values (:prospect_id_2, 'random@example.com');

select is_founder from public.prospects where id = :prospect_id_2;
-- Expected: f (false)
```

- [ ] **Step 3: Test fenêtre 1 mois**

```sql
update public.app_config set launch_at = now() - interval '40 days' where id = true;
select public.is_within_founder_bonus_window();
-- Expected: f (40 jours > 1 mois)

update public.app_config set launch_at = now() - interval '10 days' where id = true;
select public.is_within_founder_bonus_window();
-- Expected: t

-- Reset à une date proche pour la suite des tests.
update public.app_config set launch_at = now() where id = true;
```

- [ ] **Step 4: Cleanup**

```sql
delete from public.prospect_identity where prospect_id in (:prospect_id, :prospect_id_2);
delete from public.prospects where id in (:prospect_id, :prospect_id_2);
delete from public.waitlist where email = 'test-founder@example.com';
```

- [ ] **Step 5: Pas de commit (smoke test, aucun fichier modifié)**

---

## Task 4: Lib helper `lib/founders/index.ts`

**Files:**
- Create: `lib/founders/index.ts`

- [ ] **Step 1: Write the helper**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type FounderContext = {
  isFounder: boolean;
  isWithinBonusWindow: boolean;
};

/**
 * Lecture du contexte fondateur pour un prospect (ou anonyme).
 *
 * - Si `prospectId` est `null` → user anonyme : `isFounder = false`,
 *   `isWithinBonusWindow` quand même lu pour informer les calculs
 *   d'affichage côté flash deals API.
 * - Sinon : lit `prospects.is_founder` + `is_within_founder_bonus_window()`.
 */
export async function getFounderContext(
  admin: SupabaseClient,
  prospectId: string | null,
): Promise<FounderContext> {
  // Toujours lire la fenêtre (sert aussi pour décider si l'affichage
  // doublé doit être tenté côté UI).
  const { data: winRow } = await admin.rpc("is_within_founder_bonus_window");
  const isWithinBonusWindow = winRow === true;

  if (!prospectId) {
    return { isFounder: false, isWithinBonusWindow };
  }

  const { data: prospect } = await admin
    .from("prospects")
    .select("is_founder")
    .eq("id", prospectId)
    .maybeSingle();

  return {
    isFounder: prospect?.is_founder === true,
    isWithinBonusWindow,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/founders/index.ts
git commit -m "feat(founders): add getFounderContext helper"
```

---

## Task 5: `/api/landing/flash-deals` — fenêtre 10 min + reward affiché

**Files:**
- Modify: `app/api/landing/flash-deals/route.ts`

- [ ] **Step 1: Add the import + filter logic**

Add at the top (with existing imports):
```ts
import { getFounderContext } from "@/lib/founders";
```

Inside `GET()`, after the existing auth/prospect lookup, before the `flashes.map(...)` block, replace the current `.from("campaigns")` query with the conditional 10-min filter:

```ts
const founder = await getFounderContext(admin, prospect?.id ?? null);

// Fenêtre +10 min : seuls les fondateurs voient un flash deal créé il
// y a moins de 10 min. Pour tout le monde d'autre, filtre serveur.
let campaignQuery = admin
  .from("campaigns")
  .select(
    `id, name, ends_at, brief, cost_per_contact_cents, targeting,
     founder_bonus_enabled, created_at,
     pro_accounts ( raison_sociale, secteur )`,
  )
  .eq("status", "active")
  .gt("ends_at", nowIso)
  .order("ends_at", { ascending: true })
  .limit(20);

if (!founder.isFounder) {
  campaignQuery = campaignQuery.lt(
    "created_at",
    new Date(Date.now() - 10 * 60_000).toISOString(),
  );
}

const { data, error } = await campaignQuery;
```

(Replace the existing query — keep its semantics, only add the conditional `.lt(...)` and the new selected columns.)

- [ ] **Step 2: Compute the displayed reward + bonus flag in the mapping**

In the `deals = flashes.map(...)` block, derive the effective reward when bonus is applicable:

```ts
const deals = flashes.map((r) => {
  const pro = Array.isArray(r.pro_accounts) ? r.pro_accounts[0] : r.pro_accounts;
  const targeting = r.targeting ?? {};
  // ... (logique requiredTiers / requiredTierKeys / multiplier inchangée)
  const baseCostCents = Number(r.cost_per_contact_cents ?? 0);
  const founderBonusEligible =
    founder.isFounder &&
    founder.isWithinBonusWindow &&
    r.founder_bonus_enabled === true;
  const displayedCostCents = founderBonusEligible
    ? baseCostCents * 2
    : baseCostCents;

  return {
    id: r.id,
    name: r.name,
    endsAt: r.ends_at,
    brief: r.brief,
    multiplier,
    costPerContactCents: displayedCostCents,
    requiredTiers,
    requiredTierKeys,
    proName: pro?.raison_sociale ?? null,
    proSector: pro?.secteur ?? null,
    isAuthenticated: prospect !== null,
    relationId: rel?.id ?? null,
    relationStatus: rel?.status ?? null,
    missingTierKeys,
    founderBonusApplied: founderBonusEligible, // ← nouveau champ
  };
});
```

> **Important :** la `CampaignRow` type au-dessus du handler doit gagner deux champs : `founder_bonus_enabled: boolean;` et `created_at: string;`. Mettre à jour la déclaration en haut du fichier.

- [ ] **Step 3: Type-update for `Deal` côté client (`app/page.tsx`)**

In `app/page.tsx`, find the `type Deal = { ... }` block and add:
```ts
founderBonusApplied: boolean;
```
This new optional/required field is consumed by the modal (Task 8).

- [ ] **Step 4: Manual verification**

- Démarrer dev server (`npm run dev`)
- Anonyme : `curl http://localhost:3000/api/landing/flash-deals` → vérifier que `founderBonusApplied` est présent et que les deals < 10 min sont filtrés (créer un deal récent en SQL pour tester).
- Connecté en fondateur : même curl avec cookie de session → tous les deals visibles.

- [ ] **Step 5: Commit**

```bash
git add app/api/landing/flash-deals/route.ts app/page.tsx
git commit -m "feat(flash-deals): 10-min priority window + founder reward doubling in payload"
```

---

## Task 6: Expose `is_founder` via `/api/prospect/donnees`

**Files:**
- Modify: `app/api/prospect/donnees/route.ts`

- [ ] **Step 1: Read the existing GET handler around line 70-90**

Locate the parallel `Promise.all(...)` reading the 5 tier tables. We add a 6th parallel read on `prospects` to get `is_founder`.

- [ ] **Step 2: Add the read + return field**

Inside `Promise.all([...])`, append:
```ts
admin.from("prospects").select("is_founder").eq("id", prospectId).maybeSingle(),
```

Then, when building the response (`return NextResponse.json({ ... })`), add:
```ts
isFounder: prospectsRow.data?.is_founder === true,
```
(rename the destructured result from `Promise.all` accordingly — typically `[identity, localisation, vie, pro, patrimoine, hidden, prospectsRow] = await Promise.all([...])`).

- [ ] **Step 3: Verify**

Run: `curl -b "<session>" http://localhost:3000/api/prospect/donnees | jq .isFounder`
Expected: `true` for waitlist-matched user, `false` otherwise.

- [ ] **Step 4: Commit**

```bash
git add app/api/prospect/donnees/route.ts
git commit -m "feat(prospect): expose is_founder in /api/prospect/donnees payload"
```

---

## Task 7: Email — mention bonus fondateur dans `relation-accepted`

**Files:**
- Modify: `lib/email/relation-accepted.ts`
- Modify: `app/api/prospect/relations/[id]/decision/route.ts` (passe le flag au mailer)

- [ ] **Step 1: Add `founderBonusApplied` to the mailer signature**

Open `lib/email/relation-accepted.ts`. Add to the input type:
```ts
type RelationAcceptedArgs = {
  email: string;
  prenom: string | null;
  proName: string;
  proSector: string | null;
  motif: string | null;
  rewardEur: number;
  campaignEndsAt: string | null;
  authCode: string | null;
  founderBonusApplied?: boolean;  // ← nouveau
};
```

- [ ] **Step 2: Branch on the flag in the email body**

Inside the template (HTML or text), add a conditional section:
```ts
const founderSection = args.founderBonusApplied
  ? `
    <p style="margin:18px 0;padding:12px 16px;background:#FFF8E1;
              border:1px solid #F2C879;border-radius:8px;color:#5C4400;">
      🎖️ <strong>Bonus fondateur appliqué</strong><br/>
      Vous touchez <strong>${formatEur(args.rewardEur)}</strong> au lieu
      de ${formatEur(args.rewardEur / 2)} grâce à votre statut de
      fondateur·ice (+100% sur le 1er mois post-lancement).
    </p>`
  : "";
```
Et insère `${founderSection}` dans le HTML, juste avant la signature.

- [ ] **Step 3: Pass the flag from the decision route**

In `app/api/prospect/relations/[id]/decision/route.ts`, in the `sendDecisionEmail` function, the relation row already has `founder_bonus_applied`. Update the SELECT to include it:
```ts
.select(
  `id, reward_cents, motif, founder_bonus_applied,
   campaigns ( ends_at, code ),
   pro_accounts ( raison_sociale, secteur ),
   prospects ( prospect_identity ( email, prenom ) )`,
)
```
And pass to the mailer:
```ts
sendRelationAccepted({
  email, prenom, proName, proSector,
  motif: r.motif ?? null,
  rewardEur, campaignEndsAt, authCode,
  founderBonusApplied: r.founder_bonus_applied === true,
});
```

(Add `founder_bonus_applied: boolean;` to the `DecisionRelationRow` type.)

- [ ] **Step 4: Manual verification**

Trigger an acceptance flow on a founder-eligible relation and inspect the SMTP capture (logs) — the email body should include the bonus paragraph.

- [ ] **Step 5: Commit**

```bash
git add lib/email/relation-accepted.ts app/api/prospect/relations/[id]/decision/route.ts
git commit -m "feat(email): mention founder 2x bonus in relation-accepted"
```

---

## Task 8: Modale flash deal home — badge "Bonus fondateur ×2"

**Files:**
- Modify: `app/page.tsx` (function `FlashDealModal`)

- [ ] **Step 1: Locate the reward block**

In `FlashDealModal`, find the JSX block that renders "Récompense" + the big amount (around the line ` Récompense ` literal). Just below the amount, conditionally insert a gold badge.

- [ ] **Step 2: Insert the badge JSX**

Right after the amount span (`{rewardEur} €`):
```tsx
{deal.founderBonusApplied && (
  <div
    className="mono caps"
    style={{
      marginTop: 6,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "3px 10px",
      borderRadius: 999,
      background: "#FFF1B8",
      color: "#5C4400",
      border: "1px solid #F2C879",
      fontSize: 11,
      letterSpacing: ".06em",
    }}
  >
    🎖️ Bonus fondateur ×2
  </div>
)}
```

- [ ] **Step 3: Typecheck + lint**

Run:
- `npx tsc --noEmit`
- `npx eslint app/page.tsx`

Expected: no new errors (only the pre-existing `<img>` warning).

- [ ] **Step 4: Visual verification**

Open the home with a fondateur session, click a flash deal → modal shows the gold badge under the reward number.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home/modal): show founder x2 badge on eligible flash deals"
```

---

## Task 9: Badge fondateur dans le dashboard prospect (prototype)

**Files:**
- Modify: `public/prototype/components/Prospect.jsx`

- [ ] **Step 1: Hydrate `is_founder` in `ProspectProvider`**

Locate the existing fetch on `/api/prospect/donnees`. The response now includes `isFounder`. Add a state `isFounder` to the provider and store it. Find the `useEffect` that calls `refetchDonnees` (or similar around line 90-110) and store `j.isFounder`.

```jsx
const [isFounder, setIsFounder] = useState(false);
// dans le bloc de hydratation après fetch /api/prospect/donnees :
setIsFounder(j.isFounder === true);
```

Expose `isFounder` via le contexte (`ProspectCtx.Provider value={{ ..., isFounder }}`).

- [ ] **Step 2: Show the badge in `TopBar` or `ProspectHeader`**

Find the component rendering the user name in the header. Add next to it:
```jsx
{isFounder && (
  <span
    title="Vous êtes fondateur·ice — priorité 10 min sur les flash deals"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 999,
      background: '#FFF1B8',
      color: '#5C4400',
      border: '1px solid #F2C879',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.04em',
      marginLeft: 8,
    }}
  >
    🎖️ Fondateur·ice
  </span>
)}
```

(Pull `isFounder` from `useProspect()` where the badge is rendered.)

- [ ] **Step 3: Visual verification**

Open `/prospect` as a founder → badge visible dans le header.
Open `/prospect` as a non-founder → pas de badge.

- [ ] **Step 4: Commit**

```bash
git add public/prototype/components/Prospect.jsx
git commit -m "feat(prospect/dashboard): show founder badge in header"
```

---

## Task 10: Création campagne — toggle bonus + récap (prototype pro)

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (function `CreateCampaign`)
- Modify: `app/api/pro/campaigns/route.ts` (POST/PUT — accepter `founder_bonus_enabled`)

- [ ] **Step 1: Trouver le state local de `CreateCampaign`**

Dans `Pro.jsx`, locate `function CreateCampaign(...)`. Inspecter les `useState` qui pilotent le payload de la campagne (durée, palier, brief, etc.).

- [ ] **Step 2: Ajouter le state du toggle**

```jsx
const [founderBonusEnabled, setFounderBonusEnabled] = useState(true);
```

- [ ] **Step 3: Insérer le toggle dans l'étape "Réglages"**

Près des autres réglages (durée, palier), ajouter :
```jsx
<div style={{
  marginTop: 16, padding: 14, borderRadius: 10,
  border: '1px solid var(--line)', background: 'var(--paper)',
}}>
  <div className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        Activer le bonus fondateur (+100% le 1er mois)
      </div>
      <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
        Pendant le mois suivant le lancement officiel de BUUPP, chaque
        acceptation par un fondateur vous coûtera <strong>2× le tarif
        palier choisi</strong>. Désactivable : vos campagnes restent
        visibles aux fondateurs, mais ils gagneront le tarif standard.
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={founderBonusEnabled}
      onClick={() => setFounderBonusEnabled(v => !v)}
      style={{
        flexShrink: 0, width: 42, height: 24, borderRadius: 999,
        background: founderBonusEnabled ? 'var(--accent)' : 'var(--line-2)',
        border: 'none', cursor: 'pointer', position: 'relative',
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: founderBonusEnabled ? 20 : 2,
        width: 20, height: 20, borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.18)', transition: 'left .18s',
      }}/>
    </button>
  </div>
</div>
```

- [ ] **Step 4: Mettre à jour le récap**

Dans l'étape "Récapitulatif" de `CreateCampaign`, ajouter (avant le total) :
```jsx
<div style={{ marginTop: 14, padding: 14, borderRadius: 10,
              background: 'var(--ivory-2)', border: '1px solid var(--line)' }}>
  <div className="mono caps" style={{ fontSize: 10, color: 'var(--ink-4)', marginBottom: 6 }}>
    Bonus fondateur (1er mois post-lancement)
  </div>
  {founderBonusEnabled ? (
    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
      Activé — chaque acceptation par un fondateur vous coûtera
      <strong> {fmtEur(costPerContactEur * 2)}</strong> au lieu de {fmtEur(costPerContactEur)}.
      Coût max si tous fondateurs : <strong>{fmtEur(costPerContactEur * 2 * estimatedContacts)}</strong>.
    </div>
  ) : (
    <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
      Désactivé pour cette campagne — les fondateurs gagneront le tarif
      standard ({fmtEur(costPerContactEur)}).
    </div>
  )}
</div>
```

(Adapter `fmtEur`, `costPerContactEur`, `estimatedContacts` aux noms locaux du composant — repérer en lisant le code existant.)

- [ ] **Step 5: Inclure dans le payload de création**

Trouver le POST vers `/api/pro/campaigns` (ou équivalent) dans `Pro.jsx` et ajouter le champ :
```jsx
body: JSON.stringify({
  ...,
  founder_bonus_enabled: founderBonusEnabled,
}),
```

- [ ] **Step 6: Côté API, persister le champ**

Dans `app/api/pro/campaigns/route.ts`, dans le handler de création (POST) :
```ts
const founderBonusEnabled = body.founder_bonus_enabled !== false; // default true
// ... dans l'INSERT :
founder_bonus_enabled: founderBonusEnabled,
```

- [ ] **Step 7: Visual + manual verification**

- Créer une campagne en pro → toggle visible, default ON.
- Désactiver le toggle → récap montre la ligne "Désactivé".
- Vérifier en SQL : `select founder_bonus_enabled from campaigns order by created_at desc limit 1;`

- [ ] **Step 8: Commit**

```bash
git add public/prototype/components/Pro.jsx app/api/pro/campaigns/route.ts
git commit -m "feat(pro/create-campaign): founder bonus toggle + recap line"
```

---

## Task 11: CGU — article Programme Fondateur

**Files:**
- Modify: `app/cgu/page.tsx`

- [ ] **Step 1: Lire le fichier pour identifier la zone d'insertion**

Read the file. Identifier la fin du dernier article et insérer un nouveau bloc avant la signature/footer.

- [ ] **Step 2: Insérer l'article**

Following the existing JSX article structure (heading + paragraph), add:
```tsx
<section style={{ marginTop: 32 }}>
  <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 12 }}>
    Programme Fondateur·ice
  </h2>
  <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)' }}>
    Toute personne s&apos;étant inscrite sur la liste d&apos;attente avant
    la date officielle de lancement de BUUPP devient
    <strong> fondateur·ice</strong> à la création de son compte. Ce statut,
    permanent, ouvre droit à&nbsp;:
  </p>
  <ul style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)', paddingLeft: 22 }}>
    <li>une <strong>priorité de 10 minutes</strong> sur les sollicitations
      « flash deal » (visibles aux fondateur·ices avant le grand public)&nbsp;;</li>
    <li>un <strong>doublement de la récompense</strong> versée pour chaque
      sollicitation acceptée pendant le <strong>1er mois suivant le
      lancement</strong>, sauf indication contraire du professionnel à
      l&apos;origine de la sollicitation.</li>
  </ul>
  <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-3)' }}>
    Aucune action n&apos;est requise de la part du fondateur·ice : le
    bénéfice est calculé automatiquement à l&apos;acceptation.
  </p>
</section>
```

- [ ] **Step 3: Verify**

Render `/cgu` in the browser, scroll to the bottom — l'article apparaît.

- [ ] **Step 4: Commit**

```bash
git add app/cgu/page.tsx
git commit -m "docs(cgu): add Programme Fondateur·ice article"
```

---

## Task 12: CGV — article Bonus Fondateur côté pro

**Files:**
- Modify: `app/cgv/page.tsx`

- [ ] **Step 1: Insérer l'article**

```tsx
<section style={{ marginTop: 32 }}>
  <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, marginBottom: 12 }}>
    Bonus Fondateur — Conséquence pour le Professionnel
  </h2>
  <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)' }}>
    Pendant le 1er mois suivant le lancement officiel de BUUPP, chaque
    acceptation d&apos;une sollicitation par un prospect fondateur·ice
    donne lieu à un débit de <strong>2× le tarif palier choisi</strong>
    sur le solde du Professionnel. Lors de la création d&apos;une
    campagne, le Professionnel peut désactiver cette mécanique pour la
    campagne concernée — ses sollicitations resteront alors visibles
    aux fondateur·ices, mais ces dernier·ères gagneront le tarif
    standard.
  </p>
  <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-3)' }}>
    Le Professionnel reconnaît être dûment informé de ce surcoût avant
    validation de la campagne. Le récapitulatif présenté à l&apos;étape
    de validation indique explicitement le coût maximal projeté avec et
    sans le bonus.
  </p>
</section>
```

- [ ] **Step 2: Verify + commit**

```bash
git add app/cgv/page.tsx
git commit -m "docs(cgv): add Bonus Fondateur article (pro side, opt-out)"
```

---

## Task 13: End-to-end manuel + push

**Files:**
- N/A (manual verification)

- [ ] **Step 1: Re-sync existing prospects (one-shot SQL)**

If working on a non-empty database, fire the trigger for all existing identities:
```sql
update public.prospect_identity set email = email where email is not null;
```

- [ ] **Step 2: Set the real launch date**

```sql
update public.app_config set launch_at = '<DATE_LANCEMENT_REELLE>' where id = true;
```
(Replace by the date the user provides at deployment time — keep `1970-01-01` as the safe default during dev.)

- [ ] **Step 3: Manual end-to-end smoke**

1. Connect as a founder → `/prospect` shows founder badge in header.
2. Home `/` → flash deal modal shows reward × 2 + "Bonus fondateur ×2" badge if a campaign with `founder_bonus_enabled=true` is active and you're inside the 1-month window.
3. Click Accept on a founder-eligible relation → success, refresh `/prospect?tab=relations` → relation in history with double reward.
4. Inspect SMTP logs → email contains the founder bonus section.
5. As a pro, create a campaign → toggle "Bonus fondateur" visible, recap shows the cost projection.
6. Disable the toggle on a fresh campaign → DB row has `founder_bonus_enabled=false`. A founder accepting it earns standard tarif (no bonus).
7. Anonymous browsing of `/api/landing/flash-deals` immediately after creating a campaign → recent campaign absent (10-min filter), reappears after 10 min.

- [ ] **Step 4: Push**

```bash
git push
```

---

## Notes pour le worker exécutant

- **Ordre obligatoire** : Tasks 1 → 13. Task 5 dépend de Task 4 (helper). Task 7 dépend de Task 2 (RPC qui sets `founder_bonus_applied`). Task 9 dépend de Task 6 (donnees expose `isFounder`).
- **Le seed launch_at = 1970** est volontaire : la fenêtre 1 mois est par défaut expirée, le bonus n'est jamais appliqué jusqu'à ce qu'un admin UPDATE en SQL. Fail-safe.
- **Pas de framework de tests** dans le repo. Chaque task ends par une vérification manuelle (SQL, curl, ou UI). Si un framework est ajouté plus tard, on portera les vérifs en automatisé.
- **Migration fréquente** : à chaque task touchant la BD, lancer `npx supabase db reset` (côté local) — destructif, fais une sauvegarde si tu as des données dev importantes.
