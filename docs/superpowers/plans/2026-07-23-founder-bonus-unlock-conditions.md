# Bonus fondateur — conditions de déblocage — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le bonus fondateur de 5 € n'est plus crédité dès l'ouverture du compte : il est provisionné en `pending` (visible mais verrouillé) et ne se débloque qu'après 3 mois d'ancienneté du compte **et** au moins une sollicitation acceptée.

**Architecture:** La règle de déblocage vit dans une unique fonction SQL (`founder_bonus_unlock_state`), consommée à la fois par la RPC ensembliste de déblocage et par l'API portefeuille. Le cycle `pending` → `completed` reprend à l'identique le pattern du séquestre des relations (`settle_ripe_relations` + wrapper paresseux). Les agrégats du portefeuille filtrant déjà `status = 'completed'`, le verrouillage est obtenu par construction, sans exception à maintenir.

**Tech Stack:** Next.js 16 (App Router, Server Components) · Supabase Postgres (RPC `security definer`) · Vitest · Brevo (email) · JSX vanilla transpilé par Babel dans l'iframe prototype.

## Global Constraints

- **Spec de référence :** `docs/superpowers/specs/2026-07-23-founder-bonus-unlock-conditions-design.md`. En cas de doute, la spec fait foi.
- **Montant du bonus :** 500 cents, inchangé.
- **Conditions de déblocage :** `now() >= greatest(prospects.created_at + interval '3 months', app_config.launch_at)` **ET** au moins une ligne `relations` du prospect avec `status ∈ ('accepted','settled')`.
- **Aucune reprise rétroactive :** aucune requête ne doit modifier une transaction `signup_bonus` déjà en `status = 'completed'`.
- **Aucune expiration :** aucun mécanisme de purge, de date limite ou de reprise des bonus restés `pending`.
- **Migrations Supabase :** ne JAMAIS lancer `supabase db push` (bases locale et distante divergées). Les migrations s'appliquent via le SQL Editor puis `supabase migration repair`. Le fichier de migration est néanmoins commité dans `supabase/migrations/`.
- **Langue :** commentaires de code, libellés d'interface et messages de commit en français, comme tout le dépôt.
- **Périmètre :** web uniquement. Le mobile (worktree `worktree-mobile-app`) est répliqué dans un second temps et n'est pas touché par ce plan.
- **Commandes de vérification :** `npm test` (vitest), `npx tsc --noEmit`, `npm run lint`.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/20260724120000_founder_bonus_unlock_conditions.sql` *(créé)* | Règle de déblocage, provisionnement, RPC de déblocage, index |
| `lib/supabase/types.ts` *(modifié)* | Types TypeScript des 3 nouvelles RPC |
| `lib/prospect/transactions.ts` *(modifié)* | Libellé + chip du couple `('signup_bonus','pending')` |
| `lib/founder-bonus/sync.ts` *(créé)* | Provisionnement, déblocage, notifications — implémentation unique |
| `lib/founder-bonus/distribute.ts` *(supprimé)* | Remplacé par `sync.ts` |
| `app/api/admin/founder-bonus/distribute/route.ts` *(modifié)* | Appelle `provisionFounderBonuses` |
| `app/api/admin/digest/route.ts` *(modifié)* | Le cron quotidien appelle `syncFounderBonusesAndNotify` |
| `app/api/prospect/wallet/route.ts` *(modifié)* | Sync paresseuse + 5 champs d'état du bonus |
| `app/api/prospect/movements/route.ts` *(modifié)* | Sync paresseuse |
| `app/api/prospect/payout/withdraw/route.ts` *(modifié)* | Correction du calcul de solde (bug préexistant) |
| `public/prototype/components/Prospect.jsx` *(modifié)* | Carte « bonus verrouillé » + ligne d'historique en attente |

---

### Task 1 : Migration SQL et types

**Files:**
- Create: `supabase/migrations/20260724120000_founder_bonus_unlock_conditions.sql`
- Modify: `lib/supabase/types.ts:1586-1624`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: trois RPC utilisables via `admin.rpc(...)` —
  - `founder_bonus_unlock_state(p_prospect_id: string)` → `{ unlock_at: string; has_acceptance: boolean; met: boolean }[]`
  - `provision_founder_signup_bonus(p_prospect_id: string)` → `boolean`
  - `unlock_ripe_founder_signup_bonuses()` → `{ prospect_id: string; transaction_id: string; clerk_user_id: string; email: string; prenom: string }[]`

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/20260724120000_founder_bonus_unlock_conditions.sql` :

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Bonus fondateur : conditions de déblocage
-- ════════════════════════════════════════════════════════════════════
-- Le bonus de 5 € n'est plus crédité dès l'ouverture du compte. Il est
-- désormais PROVISIONNÉ en `pending` (visible dans le portefeuille mais
-- verrouillé) et se DÉBLOQUE quand les DEUX conditions sont réunies :
--   1. 3 mois calendaires révolus depuis `prospects.created_at` ;
--   2. au moins une relation `status ∈ ('accepted','settled')`.
-- `app_config.launch_at` reste un plancher : pas de déblocage avant le
-- lancement officiel.
--
-- Aucune reprise rétroactive : les lignes `signup_bonus` déjà `completed`
-- ne sont PAS touchées. Aucune expiration : un bonus dont les conditions
-- ne tombent jamais reste `pending` indéfiniment.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Source de vérité des conditions ───
-- Consommée par la RPC de déblocage ET par /api/prospect/wallet : la règle
-- n'est écrite qu'ici. `greatest` ignore les NULL en Postgres, donc un
-- `launch_at` absent revient simplement à ne pas appliquer de plancher.
create or replace function public.founder_bonus_unlock_state(p_prospect_id uuid)
returns table (
  unlock_at      timestamptz,
  has_acceptance boolean,
  met            boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.unlock_at,
         s.has_acceptance,
         (now() >= s.unlock_at and s.has_acceptance) as met
    from public.prospects p
    left join public.app_config c on c.id = true
    cross join lateral (
      select greatest(p.created_at + interval '3 months', c.launch_at) as unlock_at,
             exists (
               select 1
                 from public.relations r
                where r.prospect_id = p.id
                  and r.status in ('accepted', 'settled')
             ) as has_acceptance
    ) s
   where p.id = p_prospect_id;
$$;

-- ─── 2. Provisionnement (statut `pending`) ───
-- `founder_signup_bonus_applied` change de sémantique : il signifiait
-- « crédité », il signifie désormais « PROVISIONNÉ » (la ligne existe,
-- quel que soit son statut). Les lignes existantes à `true` correspondent
-- à des bonus `completed` — provisionnés ET débloqués — donc cohérentes.
create or replace function public.provision_founder_signup_bonus(p_prospect_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_founder boolean;
  v_applied    boolean;
begin
  select is_founder, founder_signup_bonus_applied
    into v_is_founder, v_applied
    from public.prospects
   where id = p_prospect_id
   for update;

  -- Pas trouvé, non fondateur, ou déjà provisionné → no-op.
  if not found or v_is_founder is not true or v_applied is true then
    return false;
  end if;

  insert into public.transactions
    (account_id, account_kind, type, status, amount_cents, description)
  values
    (p_prospect_id, 'prospect', 'signup_bonus', 'pending', 500,
     'Bonus fondateur à l''inscription');

  update public.prospects
     set founder_signup_bonus_applied = true
   where id = p_prospect_id;

  return true;
end;
$$;

-- ─── 3. Wrapper déprécié ───
-- Le code actuellement en production appelle encore
-- `apply_founder_signup_bonus`. On le conserve le temps que le nouveau
-- code soit déployé, sinon la fenêtre entre migration et déploiement
-- casserait le cron. À supprimer lors d'un prochain nettoyage.
create or replace function public.apply_founder_signup_bonus(p_prospect_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.provision_founder_signup_bonus(p_prospect_id);
$$;

-- ─── 4. Déblocage ensembliste ───
-- Calqué sur `settle_ripe_relations`. Ne renvoie QUE les lignes
-- effectivement transitionnées → exactement une notification par bonus.
-- La re-vérification `t.status = 'pending'` dans l'UPDATE est le garde-fou
-- de concurrence : en READ COMMITTED, un appel concurrent bloque sur le
-- verrou de ligne puis réévalue la clause, voit `completed`, et n'obtient
-- aucune ligne en RETURNING.
create or replace function public.unlock_ripe_founder_signup_bonuses()
returns table (
  prospect_id    uuid,
  transaction_id uuid,
  clerk_user_id  text,
  email          text,
  prenom         text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with ripe as (
    select t.id as tid
      from transactions t
     where t.type         = 'signup_bonus'
       and t.status       = 'pending'
       and t.account_kind = 'prospect'
       and (select s.met from public.founder_bonus_unlock_state(t.account_id) s)
  ),
  unlocked as (
    update transactions t
       set status = 'completed'
      from ripe
     where t.id     = ripe.tid
       and t.status = 'pending'
    returning t.id as tid, t.account_id as pid
  )
  select u.pid,
         u.tid,
         p.clerk_user_id,
         pi.email,
         pi.prenom
    from unlocked u
    join prospects p on p.id = u.pid
    left join prospect_identity pi on pi.prospect_id = u.pid;
end;
$$;

-- ─── 5. Index ───
-- Borne le balayage du job de déblocage aux seuls bonus en attente.
create index if not exists transactions_signup_bonus_pending_idx
  on public.transactions (account_id)
  where type = 'signup_bonus'
    and status = 'pending'
    and account_kind = 'prospect';

-- ─── 6. Droits ───
revoke all on function public.founder_bonus_unlock_state(uuid) from public, anon, authenticated;
revoke all on function public.provision_founder_signup_bonus(uuid) from public, anon, authenticated;
revoke all on function public.unlock_ripe_founder_signup_bonuses() from public, anon, authenticated;
grant execute on function public.founder_bonus_unlock_state(uuid) to service_role;
grant execute on function public.provision_founder_signup_bonus(uuid) to service_role;
grant execute on function public.unlock_ripe_founder_signup_bonuses() to service_role;
```

- [ ] **Step 2 : Déclarer les types des RPC**

Dans `lib/supabase/types.ts`, bloc `Functions`, insérer par ordre alphabétique. `founder_bonus_unlock_state` se place après `count_founder_filleuls` (ligne 1601-1604) :

```ts
      founder_bonus_unlock_state: {
        Args: { p_prospect_id: string }
        Returns: {
          has_acceptance: boolean
          met: boolean
          unlock_at: string
        }[]
      }
```

`provision_founder_signup_bonus` se place après `is_within_founder_bonus_window` (ligne 1605) :

```ts
      provision_founder_signup_bonus: {
        Args: { p_prospect_id: string }
        Returns: boolean
      }
```

`unlock_ripe_founder_signup_bonuses` se place après `settle_ripe_relations` (ligne 1613-1624) :

```ts
      unlock_ripe_founder_signup_bonuses: {
        Args: never
        Returns: {
          clerk_user_id: string
          email: string
          prenom: string
          prospect_id: string
          transaction_id: string
        }[]
      }
```

- [ ] **Step 3 : Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/20260724120000_founder_bonus_unlock_conditions.sql lib/supabase/types.ts
git commit -m "feat(db/bonus-fondateur): conditions de déblocage (3 mois + 1 acceptation)"
```

---

### Task 2 : Libellé du bonus verrouillé dans l'historique

**Files:**
- Modify: `lib/prospect/transactions.ts:20-42`
- Test: `tests/lib/prospect/transactions.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `statusLabel('signup_bonus','pending') === "En attente de déblocage"` et `statusChip('signup_bonus','pending') === "warn"`, consommés par `/api/prospect/movements` et l'UI.

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `tests/lib/prospect/transactions.test.ts` :

```ts
describe("bonus fondateur verrouillé", () => {
  it("libelle un signup_bonus pending comme en attente de déblocage", () => {
    expect(statusLabel("signup_bonus", "pending")).toBe("En attente de déblocage");
  });

  it("garde le libellé « Crédité » une fois débloqué", () => {
    expect(statusLabel("signup_bonus", "completed")).toBe("Crédité");
  });

  it("affiche un chip orange tant que le bonus est verrouillé", () => {
    expect(statusChip("signup_bonus", "pending")).toBe("warn");
  });

  it("affiche un chip vert une fois le bonus débloqué", () => {
    expect(statusChip("signup_bonus", "completed")).toBe("good");
  });
});
```

Vérifier que `statusLabel` et `statusChip` figurent bien dans l'import en tête du fichier ; les ajouter sinon.

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `npx vitest run tests/lib/prospect/transactions.test.ts`
Expected: FAIL — `statusLabel` renvoie `"pending"` au lieu de `"En attente de déblocage"`, `statusChip` renvoie `""` au lieu de `"warn"`.

- [ ] **Step 3 : Implémenter**

Dans `lib/prospect/transactions.ts`, remplacer la ligne `signup_bonus` de `statusLabel` :

```ts
  if (type === "signup_bonus")
    return status === "completed" ? "Crédité"
      : status === "pending" ? "En attente de déblocage" : status;
```

Puis, dans `statusChip`, ajouter avant le `return ""` final :

```ts
  // Bonus fondateur provisionné mais pas encore débloqué : même traitement
  // visuel que le séquestre (orange), il n'entre pas dans le solde.
  if (type === "signup_bonus" && status === "pending") return "warn";
```

Enfin, mettre à jour le commentaire de `GAIN_TRANSACTION_TYPES` :

```ts
/** Types de transaction comptés comme "gain" du prospect (mois + cumul +
 *  disponible). `signup_bonus` = bonus fondateur 5 €. Attention : ces types
 *  ne sont comptés qu'en `status = 'completed'` — un bonus fondateur encore
 *  verrouillé (`pending`) est donc exclu du solde par construction, sans
 *  exception à maintenir ici. */
```

- [ ] **Step 4 : Lancer les tests pour les voir passer**

Run: `npx vitest run tests/lib/prospect/transactions.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/prospect/transactions.ts tests/lib/prospect/transactions.test.ts
git commit -m "feat(prospect/portefeuille): libellé « en attente de déblocage » du bonus fondateur"
```

---

### Task 3 : Module de synchronisation du bonus

**Files:**
- Create: `lib/founder-bonus/sync.ts`
- Test: `tests/lib/founder-bonus/sync.test.ts`

**Interfaces:**
- Consumes: les RPC `provision_founder_signup_bonus` et `unlock_ripe_founder_signup_bonuses` (Task 1) ; `sendFounderBonusEmail` / `FounderBonusParams` depuis `@/lib/email/founder-bonus`.
- Produces:
  - `provisionFounderBonuses(admin, opts: { confirm: boolean; }): Promise<ProvisionResult>` avec `ProvisionResult = { eligible: number; provisioned: number; errors: number }`
  - `unlockRipeFounderBonusesAndNotify(admin, opts?: { sendEmail?: (email: string, params: FounderBonusParams) => Promise<void> }): Promise<UnlockResult>` avec `UnlockResult = { unlocked: number; broadcasted: number; emailed: number; errors: number }`
  - `syncFounderBonusesAndNotify(admin): Promise<{ provision: ProvisionResult; unlock: UnlockResult }>`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `tests/lib/founder-bonus/sync.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import {
  provisionFounderBonuses,
  unlockRipeFounderBonusesAndNotify,
} from "@/lib/founder-bonus/sync";

// Faux client admin : éligibles au provisionnement + lignes débloquées
// renvoyées par la RPC, `admin_broadcasts.insert` espionné.
function makeAdmin(
  eligible: { id: string }[] = [],
  unlocked: {
    prospect_id: string;
    transaction_id: string;
    clerk_user_id: string | null;
    email: string | null;
    prenom: string | null;
  }[] = [],
) {
  const insertSpy = vi.fn().mockResolvedValue({ error: null });
  const rpcSpy = vi.fn((name: string) => {
    if (name === "unlock_ripe_founder_signup_bonuses") {
      return Promise.resolve({ data: unlocked, error: null });
    }
    return Promise.resolve({ data: true, error: null });
  });
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "prospects") {
        return {
          select: () => ({
            eq: () => ({ eq: () => Promise.resolve({ data: eligible, error: null }) }),
          }),
        };
      }
      if (table === "admin_broadcasts") return { insert: insertSpy };
      throw new Error("table inattendue: " + table);
    }),
    rpc: rpcSpy,
  };
  return { admin, insertSpy, rpcSpy };
}

describe("provisionFounderBonuses", () => {
  it("dry-run : compte les éligibles sans rien écrire", async () => {
    const { admin, rpcSpy } = makeAdmin([{ id: "p1" }, { id: "p2" }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await provisionFounderBonuses(admin as any, { confirm: false });
    expect(res.eligible).toBe(2);
    expect(res.provisioned).toBe(0);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("confirm : provisionne via la RPC, sans notifier", async () => {
    const { admin, rpcSpy, insertSpy } = makeAdmin([{ id: "p1" }, { id: "p2" }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await provisionFounderBonuses(admin as any, { confirm: true });
    expect(res.provisioned).toBe(2);
    expect(rpcSpy).toHaveBeenCalledWith("provision_founder_signup_bonus", {
      p_prospect_id: "p1",
    });
    // Le provisionnement ne notifie pas : la notification a lieu au déblocage.
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("unlockRipeFounderBonusesAndNotify", () => {
  it("aucun bonus mûr : ne notifie rien", async () => {
    const { admin, insertSpy } = makeAdmin([], []);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await unlockRipeFounderBonusesAndNotify(admin as any, { sendEmail });
    expect(res.unlocked).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("un bonus débloqué : une cloche + un email", async () => {
    const { admin, insertSpy } = makeAdmin([], [
      { prospect_id: "p1", transaction_id: "t1", clerk_user_id: "c1", email: "lea@ex.com", prenom: "Léa" },
    ]);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await unlockRipeFounderBonusesAndNotify(admin as any, { sendEmail });
    expect(res.unlocked).toBe(1);
    expect(res.broadcasted).toBe(1);
    expect(res.emailed).toBe(1);
    expect(sendEmail).toHaveBeenCalledWith("lea@ex.com", { prenom: "Léa" });
  });

  it("bénéficiaire sans email ni clerk id : débloqué sans notification", async () => {
    const { admin, insertSpy } = makeAdmin([], [
      { prospect_id: "p2", transaction_id: "t2", clerk_user_id: null, email: null, prenom: null },
    ]);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await unlockRipeFounderBonusesAndNotify(admin as any, { sendEmail });
    expect(res.unlocked).toBe(1);
    expect(res.broadcasted).toBe(0);
    expect(res.emailed).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Lancer les tests pour les voir échouer**

Run: `npx vitest run tests/lib/founder-bonus/sync.test.ts`
Expected: FAIL — `Cannot find module '@/lib/founder-bonus/sync'`.

- [ ] **Step 3 : Implémenter le module**

Créer `lib/founder-bonus/sync.ts` :

```ts
/**
 * Cycle de vie du bonus fondateur 5 €.
 *
 * Deux étapes distinctes, volontairement séparées :
 *  - PROVISIONNEMENT : dès qu'un compte fondateur existe, on écrit la
 *    transaction `signup_bonus` en `pending`. Elle est visible dans le
 *    portefeuille mais exclue du solde (les agrégats filtrent
 *    `status = 'completed'`). Aucune notification à ce stade.
 *  - DÉBLOCAGE : quand les conditions tombent (3 mois d'ancienneté du
 *    compte + au moins une sollicitation acceptée, avec `launch_at` pour
 *    plancher), la RPC ensembliste bascule la ligne en `completed` et
 *    renvoie les bénéficiaires à notifier. La règle elle-même vit
 *    exclusivement dans `founder_bonus_unlock_state` côté SQL.
 *
 * Sémantique en cas d'échec après déblocage : la RPC bascule le statut
 * AVANT l'insertion du broadcast et l'envoi de l'email. Si l'un des deux
 * échoue, un re-run ne les rejoue PAS (la ligne n'est plus `pending`).
 * L'opérateur doit comparer les compteurs du résultat : un écart
 * `unlocked > broadcasted/emailed` signale des notifications à reprendre.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  sendFounderBonusEmail,
  type FounderBonusParams,
} from "@/lib/email/founder-bonus";

type Admin = SupabaseClient<Database>;

export type ProvisionResult = {
  eligible: number;
  provisioned: number;
  errors: number;
};

export type UnlockResult = {
  unlocked: number;
  broadcasted: number;
  emailed: number;
  errors: number;
};

const BROADCAST = {
  title: "Votre bonus fondateur est débloqué 🎁",
  body:
    "Merci d'avoir rejoint BUUPP dès la liste d'attente ! Votre bonus " +
    "fondateur de 5,00 € vient d'être débloqué : votre compte a plus de " +
    "trois mois et vous avez accepté au moins une sollicitation. Il est " +
    "dès maintenant disponible et retirable.\n\nL'équipe BUUPP",
};

/**
 * Écrit la transaction `pending` pour les fondateurs qui n'en ont pas
 * encore. Idempotent : la RPC repose sur le drapeau
 * `prospects.founder_signup_bonus_applied`.
 */
export async function provisionFounderBonuses(
  admin: Admin,
  opts: { confirm: boolean },
): Promise<ProvisionResult> {
  const result: ProvisionResult = { eligible: 0, provisioned: 0, errors: 0 };

  const { data, error } = await admin
    .from("prospects")
    .select("id")
    .eq("is_founder", true)
    .eq("founder_signup_bonus_applied", false);
  if (error) {
    console.error("[founder-bonus] éligibles read failed", error.message);
    return result;
  }
  const rows = data ?? [];
  result.eligible = rows.length;

  if (!opts.confirm) return result; // dry-run : on s'arrête après le compte.

  for (const row of rows) {
    const { data: provisioned, error: rpcErr } = await admin.rpc(
      "provision_founder_signup_bonus",
      { p_prospect_id: row.id },
    );
    if (rpcErr) {
      console.error("[founder-bonus] provision rpc failed", row.id, rpcErr.message);
      result.errors += 1;
      continue;
    }
    if (provisioned === true) result.provisioned += 1;
  }

  return result;
}

/**
 * Bascule en `completed` les bonus dont les conditions sont réunies, puis
 * notifie chaque bénéficiaire (cloche ciblée + email).
 */
export async function unlockRipeFounderBonusesAndNotify(
  admin: Admin,
  opts?: { sendEmail?: (email: string, params: FounderBonusParams) => Promise<void> },
): Promise<UnlockResult> {
  const sendEmail = opts?.sendEmail ?? sendFounderBonusEmail;
  const result: UnlockResult = { unlocked: 0, broadcasted: 0, emailed: 0, errors: 0 };

  const { data, error } = await admin.rpc("unlock_ripe_founder_signup_bonuses");
  if (error) {
    console.error("[founder-bonus] unlock rpc failed", error.message);
    return result;
  }
  const rows = data ?? [];
  result.unlocked = rows.length;
  if (rows.length === 0) return result;

  console.log(`[founder-bonus] ${rows.length} bonus débloqué(s)`);

  for (const row of rows) {
    try {
      if (row.clerk_user_id) {
        const { error: bErr } = await admin.from("admin_broadcasts").insert({
          title: BROADCAST.title,
          body: BROADCAST.body,
          audience: "prospects",
          created_by_admin_id: "system:founder-bonus",
          target_clerk_user_id: row.clerk_user_id,
        });
        if (bErr) {
          console.error("[founder-bonus] broadcast insert failed", row.prospect_id, bErr.message);
          result.errors += 1;
        } else {
          result.broadcasted += 1;
        }
      } else {
        console.warn("[founder-bonus] débloqué sans clerk_user_id, broadcast ignoré", row.prospect_id);
      }

      if (row.email) {
        await sendEmail(row.email, { prenom: row.prenom ?? null });
        result.emailed += 1;
      } else {
        console.warn("[founder-bonus] débloqué sans email, email ignoré", row.prospect_id);
      }
    } catch (err) {
      console.error("[founder-bonus] unexpected error", row.prospect_id, err);
      result.errors += 1;
    }
  }

  return result;
}

/**
 * Point d'entrée unique : provisionne puis débloque. Appelé par le cron
 * quotidien et, en lecture paresseuse, par les endpoints portefeuille —
 * exactement comme `settleRipeRelationsAndNotify`.
 */
export async function syncFounderBonusesAndNotify(
  admin: Admin,
): Promise<{ provision: ProvisionResult; unlock: UnlockResult }> {
  const provision = await provisionFounderBonuses(admin, { confirm: true });
  const unlock = await unlockRipeFounderBonusesAndNotify(admin);
  return { provision, unlock };
}
```

- [ ] **Step 4 : Lancer les tests pour les voir passer**

Run: `npx vitest run tests/lib/founder-bonus/sync.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5 : Commit**

```bash
git add lib/founder-bonus/sync.ts tests/lib/founder-bonus/sync.test.ts
git commit -m "feat(bonus-fondateur): module de provisionnement et de déblocage"
```

---

### Task 4 : Rebrancher le cron et l'endpoint admin

**Files:**
- Delete: `lib/founder-bonus/distribute.ts`, `tests/lib/founder-bonus/distribute.test.ts`, `tests/lib/founder-bonus/launch.test.ts`
- Modify: `app/api/admin/digest/route.ts:25,101-124,149`
- Modify: `app/api/admin/founder-bonus/distribute/route.ts`
- Modify: `tests/api/admin/founder-bonus-distribute.test.ts`

**Interfaces:**
- Consumes: `provisionFounderBonuses`, `syncFounderBonusesAndNotify` (Task 3).
- Produces: le cron quotidien débloque les bonus mûrs ; l'endpoint admin renvoie `{ eligible, provisioned, errors }`.

- [ ] **Step 1 : Supprimer l'ancien module et ses tests**

```bash
git rm lib/founder-bonus/distribute.ts tests/lib/founder-bonus/distribute.test.ts tests/lib/founder-bonus/launch.test.ts
```

Ces tests couvraient la distribution inconditionnelle et la garde `launch_at` côté TypeScript. La garde `launch_at` vit désormais dans `founder_bonus_unlock_state` (SQL) et le reste est couvert par `tests/lib/founder-bonus/sync.test.ts`.

- [ ] **Step 2 : Rebrancher le cron quotidien**

Dans `app/api/admin/digest/route.ts`, remplacer l'import ligne 25 :

```ts
import { syncFounderBonusesAndNotify } from "@/lib/founder-bonus/sync";
```

Puis, dans le corps du handler, remplacer la déclaration et l'appel (lignes ~101-124) :

```ts
  let founderBonus: Awaited<
    ReturnType<typeof syncFounderBonusesAndNotify>
  > | null = null;
```

```ts
    // Provisionne les nouveaux fondateurs et débloque ceux dont les
    // conditions sont réunies (3 mois d'ancienneté + 1 acceptation).
    // Cf. lib/founder-bonus/sync.ts.
    try {
      founderBonus = await syncFounderBonusesAndNotify(admin);
    } catch (err) {
      console.error("[/api/admin/digest] founder bonus sync failed", err);
    }
```

La ligne 149 (`founderBonus: founderBonus ?? null`) reste inchangée.

- [ ] **Step 3 : Rebrancher l'endpoint admin**

Dans `app/api/admin/founder-bonus/distribute/route.ts`, remplacer l'import de `distributeFounderBonus` par :

```ts
import { provisionFounderBonuses } from "@/lib/founder-bonus/sync";
```

et l'appel correspondant par :

```ts
  const result = await provisionFounderBonuses(admin, { confirm });
```

Mettre à jour le commentaire d'en-tête du fichier :

```ts
/**
 * POST /api/admin/founder-bonus/distribute — provisionne le bonus fondateur
 * aux prospects éligibles (is_founder, sans ligne de bonus). Le bonus est
 * écrit en `pending` : il ne devient disponible qu'une fois les conditions
 * de déblocage réunies (cf. lib/founder-bonus/sync.ts). Dry-run par défaut,
 * `?confirm=1` pour écrire réellement.
 */
```

- [ ] **Step 4 : Adapter le test de l'endpoint**

Dans `tests/api/admin/founder-bonus-distribute.test.ts`, remplacer le bloc de mock (lignes 10-13) :

```ts
const provisionMock = vi.fn();
vi.mock("@/lib/founder-bonus/sync", () => ({
  provisionFounderBonuses: (...a: unknown[]) => provisionMock(...a),
}));
```

Puis remplacer chaque `distributeMock` par `provisionMock` dans les quatre tests, et les valeurs simulées par la nouvelle forme du résultat :

```ts
    // test « dry-run par défaut »
    provisionMock.mockResolvedValueOnce({ eligible: 7, provisioned: 0, errors: 0 });
```

```ts
    // test « confirm=1 »
    provisionMock.mockResolvedValueOnce({ eligible: 7, provisioned: 7, errors: 0 });
```

Dans ce dernier test, remplacer l'assertion `expect(json.credited).toBe(7);` par :

```ts
    expect(json.provisioned).toBe(7);
```

Les assertions sur `json.dryRun`, `json.eligible`, le 404 de la garde admin et le 500 `distribute_failed` restent inchangées.

- [ ] **Step 5 : Lancer la suite complète**

Run: `npm test`
Expected: PASS — aucun test résiduel ne référence `lib/founder-bonus/distribute`.

- [ ] **Step 6 : Vérifier types et lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "refactor(bonus-fondateur): le cron provisionne et débloque au lieu de distribuer"
```

---

### Task 5 : Exposer l'état du bonus dans /api/prospect/wallet

**Files:**
- Modify: `app/api/prospect/wallet/route.ts`

**Interfaces:**
- Consumes: `syncFounderBonusesAndNotify` (Task 3), RPC `founder_bonus_unlock_state` (Task 1).
- Produces: la réponse JSON gagne `signupBonusPendingCents`, `signupBonusPendingEur`, `signupBonusUnlockAt`, `signupBonusHasAcceptance`, `signupBonusLocked`. `signupBonusCents`/`Eur` gardent leur sens actuel (bonus **débloqué** seul) — le mobile déjà déployé les consomme.

- [ ] **Step 1 : Ajouter la synchronisation paresseuse**

Après l'import de `settleRipeRelationsAndNotify`, ajouter :

```ts
import { syncFounderBonusesAndNotify } from "@/lib/founder-bonus/sync";
```

Puis, juste après l'appel `await settleRipeRelationsAndNotify(admin);` :

```ts
  // Idem pour le bonus fondateur : provisionne la ligne `pending` d'un
  // nouveau fondateur et débloque celle dont les conditions viennent
  // d'être réunies, avant de calculer les agrégats.
  await syncFounderBonusesAndNotify(admin);
```

- [ ] **Step 2 : Lire le bonus en attente et son état**

Dans le `Promise.all` des lectures parallèles, ajouter deux entrées après `signupBonus` — la déstructuration passe donc à neuf éléments :

```ts
      admin
        .from("transactions")
        .select("amount_cents")
        .eq("account_kind", "prospect")
        .eq("account_id", prospectId)
        .eq("type", "signup_bonus")
        .eq("status", "pending"),
      admin.rpc("founder_bonus_unlock_state", { p_prospect_id: prospectId }),
```

et adapter la ligne de déstructuration :

```ts
  const [gainsLifetime, gainsMonth, withdrawals, escrowRelations, relations, prospectRow, signupBonus, signupBonusPending, unlockState] =
```

- [ ] **Step 3 : Calculer et renvoyer les champs**

Après `const signupBonusCents = sumAmounts(signupBonus.data);`, ajouter :

```ts
  const signupBonusPendingCents = sumAmounts(signupBonusPending.data);
  // La RPC renvoie une ligne (aucune si le prospect n'existe pas).
  const unlock = unlockState.data?.[0] ?? null;
```

Puis, dans l'objet `NextResponse.json({...})`, après `signupBonusEur` :

```ts
    signupBonusPendingCents,
    signupBonusPendingEur: Math.round(signupBonusPendingCents) / 100,
    signupBonusLocked: signupBonusPendingCents > 0,
    signupBonusUnlockAt: unlock?.unlock_at ?? null,
    signupBonusHasAcceptance: unlock?.has_acceptance ?? false,
```

- [ ] **Step 4 : Documenter le contrat**

Compléter le commentaire d'en-tête du fichier, après la ligne décrivant `escrow` :

```
 *   - signupBonusCents        : bonus fondateur DÉBLOQUÉ (compté dans
 *                               `available`).
 *   - signupBonusPendingCents : bonus fondateur provisionné mais encore
 *                               verrouillé — exclu de tous les agrégats.
 *   - signupBonusUnlockAt     : date de déblocage = max(création du compte
 *                               + 3 mois, launch_at).
 *   - signupBonusHasAcceptance: true si ≥ 1 sollicitation acceptée.
 *   - signupBonusLocked       : true s'il reste un bonus verrouillé.
```

- [ ] **Step 5 : Vérifier**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: aucune erreur, tous les tests passent.

- [ ] **Step 6 : Commit**

```bash
git add app/api/prospect/wallet/route.ts
git commit -m "feat(prospect/wallet): expose l'état de déblocage du bonus fondateur"
```

---

### Task 6 : Synchronisation paresseuse sur l'historique

**Files:**
- Modify: `app/api/prospect/movements/route.ts:137-145`

**Interfaces:**
- Consumes: `syncFounderBonusesAndNotify` (Task 3).
- Produces: rien de nouveau — garantit seulement que l'historique n'affiche pas un bonus verrouillé dont les conditions sont déjà tombées.

- [ ] **Step 1 : Ajouter l'appel**

Ajouter l'import :

```ts
import { syncFounderBonusesAndNotify } from "@/lib/founder-bonus/sync";
```

Puis, immédiatement après l'appel existant à `settleRipeRelationsAndNotify(admin)` :

```ts
  // Même logique pour le bonus fondateur : l'historique ne doit pas
  // afficher « en attente de déblocage » une ligne déjà mûre.
  await syncFounderBonusesAndNotify(admin);
```

- [ ] **Step 2 : Vérifier**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add app/api/prospect/movements/route.ts
git commit -m "feat(prospect/movements): synchronise le bonus fondateur à la lecture"
```

---

### Task 7 : Corriger le calcul du solde retirable

**Files:**
- Modify: `app/api/prospect/payout/withdraw/route.ts:98-114`

**Interfaces:**
- Consumes: `GAIN_TRANSACTION_TYPES` depuis `@/lib/prospect/transactions`.
- Produces: rien de nouveau — corrige une incohérence entre le solde affiché et le solde vérifié au retrait.

**Contexte :** la route liste les types de gain en dur (`["credit","referral_bonus"]`) et omet `signup_bonus`, alors que `/api/prospect/wallet` utilise `GAIN_TRANSACTION_TYPES` qui l'inclut. Un fondateur dont le solde repose sur le seul bonus voit donc `canWithdraw: true` puis reçoit `insufficient_funds`. Le filtre `status = 'completed'` déjà présent suffit à maintenir un bonus verrouillé hors du solde retirable.

- [ ] **Step 1 : Importer la constante partagée**

Ajouter en tête de fichier :

```ts
import { GAIN_TRANSACTION_TYPES } from "@/lib/prospect/transactions";
```

- [ ] **Step 2 : Remplacer la liste en dur**

Ligne 104, remplacer :

```ts
      .in("type", ["credit", "referral_bonus"])
```

par :

```ts
      // Même définition du "gain" que /api/prospect/wallet — sinon le solde
      // affiché et le solde vérifié ici divergent (le bonus fondateur était
      // compté dans l'un et pas dans l'autre). Le filtre `completed`
      // ci-dessous exclut le bonus encore verrouillé.
      .in("type", [...GAIN_TRANSACTION_TYPES])
```

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add app/api/prospect/payout/withdraw/route.ts
git commit -m "fix(prospect/retrait): compter le bonus fondateur dans le solde vérifié"
```

---

### Task 8 : Interface prospect — carte du bonus verrouillé

**Files:**
- Modify: `public/prototype/components/Prospect.jsx:2779-2790` (lecture des champs), `~2806-2810` (insertion de la carte), `2944-2972` (historique), fin du fichier près de `BalanceCard` (nouveau composant)

**Interfaces:**
- Consumes: les champs `signupBonusLocked`, `signupBonusPendingEur`, `signupBonusUnlockAt`, `signupBonusHasAcceptance` de `/api/prospect/wallet` (Task 5) et le `kind`/`statusLabel` de `/api/prospect/movements` (Task 2).
- Produces: rien (feuille de l'arbre).

**Note :** ce fichier est chargé dans l'iframe prototype et transpilé par Babel côté navigateur. Après modification, vider `.next` et redémarrer `next dev` si les changements ne se reflètent pas (cf. cache Turbopack).

- [ ] **Step 1 : Lire les nouveaux champs**

Après la ligne `const signupBonusEur = wallet?.signupBonusEur ?? 0;` (2783), ajouter :

```jsx
  const bonusLocked = wallet?.signupBonusLocked ?? false;
  const bonusPendingEur = wallet?.signupBonusPendingEur ?? 0;
  const bonusUnlockAt = wallet?.signupBonusUnlockAt ?? null;
  const bonusHasAcceptance = wallet?.signupBonusHasAcceptance ?? false;
  // La date de déblocage n'est atteinte que si elle est passée.
  const bonusDateReached = bonusUnlockAt ? new Date(bonusUnlockAt) <= new Date() : false;
  const bonusUnlockLabel = bonusUnlockAt
    ? new Date(bonusUnlockAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
```

- [ ] **Step 2 : Insérer la carte sous la grille des soldes**

Juste après la fermeture `</div>` de la grille des trois `BalanceCard` (celle ouverte ligne 2809 avec `gridTemplateColumns: '1.2fr 1fr 1fr'`), insérer :

```jsx
      {bonusLocked && (
        <FounderBonusLockCard
          amount={fmt(bonusPendingEur)}
          dateLabel={bonusUnlockLabel}
          dateReached={bonusDateReached}
          hasAcceptance={bonusHasAcceptance}
        />
      )}
```

- [ ] **Step 3 : Écrire le composant**

Juste avant la définition de `BalanceCard` (autour de la ligne 3180), ajouter :

```jsx
// Bonus fondateur provisionné mais pas encore débloqué. Les deux conditions
// sont affichées avec leur état : une condition remplie passe en vert coché.
function FounderBonusLockCard({ amount, dateLabel, dateReached, hasAcceptance }) {
  const Condition = ({ done, children }) => (
    <div className="row center" style={{ gap: 8, fontSize: 13, color: done ? 'var(--good)' : 'var(--ink-4)' }}>
      <span style={{
        width: 18, height: 18, borderRadius: 999, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: done ? 'color-mix(in oklab, var(--good) 16%, transparent)' : 'var(--ivory-2)',
        color: done ? 'var(--good)' : 'var(--ink-5)',
      }}>
        {done ? <Icon name="check" size={11}/> : <span style={{ fontSize: 11 }}>○</span>}
      </span>
      <span>{children}</span>
    </div>
  );

  return (
    <div className="card" style={{ padding: 20, borderStyle: 'dashed' }}>
      <div className="row between center" style={{ marginBottom: 12, gap: 12 }}>
        <div className="row center" style={{ gap: 10 }}>
          <Icon name="gift" size={16}/>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>
              Bonus fondateur — {amount} €
            </div>
            <div className="mono caps" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--ink-5)', marginTop: 2 }}>
              En attente de déblocage
            </div>
          </div>
        </div>
        <span className="chip chip-warn">Verrouillé</span>
      </div>
      <div className="col" style={{ gap: 8 }}>
        <Condition done={dateReached}>
          {dateReached ? 'Compte de plus de 3 mois' : `Débloqué le ${dateLabel}`}
        </Condition>
        <Condition done={hasAcceptance}>
          Au moins une sollicitation acceptée
        </Condition>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 12 }}>
        Ces deux conditions réunies, les {amount} € rejoignent votre solde disponible et deviennent retirables.
      </div>
    </div>
  );
}
```

L'icône `check` et la classe `chip-warn` existent déjà (`Shell.jsx:62` pour `Icon`, `styles.css:960` pour le chip) — rien à créer.

- [ ] **Step 4 : Adapter l'historique**

La colonne **Statut** ne demande aucun travail : elle rend déjà `chip-{m.statusChip}` + `m.statusLabel` de façon générique (lignes 3000-3004), donc la Task 2 lui suffit à afficher « En attente de déblocage » en orange.

Seules la teinte de ligne et la pastille d'origine sont à corriger. Ligne 2944, le fond vert est appliqué à tout `signup_bonus` ; le restreindre au bonus débloqué. On se fie à `statusChip` plutôt qu'au libellé affiché, pour ne pas coupler l'UI à une chaîne de caractères :

```jsx
                const isSignupBonus = m.kind === 'signup_bonus';
                const isSignupBonusLocked = isSignupBonus && m.statusChip === 'warn';
```

Puis, ligne ~2959, remplacer la règle de fond :

```jsx
                      ...(isSignupBonus && !isSignupBonusLocked
                        ? { background: 'color-mix(in oklab, var(--good) 8%, var(--paper))' }
                        : null),
```

Et ligne ~2970, adapter la classe du chip :

```jsx
                        <span className={isSignupBonusLocked ? 'chip chip-warn' : 'chip chip-good'} style={{ fontWeight: 600 }}>
                          <Icon name="gift" size={12}/> Bonus fondateur
                        </span>
```

- [ ] **Step 5 : Vérifier visuellement**

Run: `rm -rf .next && npm run dev`
Ouvrir `/prospect?tab=portefeuille` avec un compte fondateur dont le bonus est `pending`.
Expected: la carte « Bonus fondateur — 5,00 € » apparaît sous les trois soldes, avec les deux conditions et leur état ; la carte « Disponible » n'affiche PAS « dont 5,00 € de bonus fondateur » ; la ligne d'historique porte un chip orange.

- [ ] **Step 6 : Commit**

```bash
git add public/prototype/components/Prospect.jsx
git commit -m "feat(prospect/portefeuille): carte du bonus fondateur verrouillé et ses conditions"
```

---

## Déploiement

Après validation de toutes les tâches :

1. Appliquer `20260724120000_founder_bonus_unlock_conditions.sql` en prod **via le SQL Editor Supabase**, puis `npx supabase migration repair --status applied 20260724120000`. Ne **jamais** lancer `db push`.
2. **Contrôler la règle de déblocage** dans le SQL Editor, juste après l'application. La matrice des conditions vit en SQL et n'est couverte par aucun test Vitest (cf. spec §7) : cette requête est sa seule validation. Elle est en lecture seule.

```sql
select p.id,
       p.created_at,
       s.unlock_at,
       s.has_acceptance,
       s.met,
       exists (
         select 1 from relations r
          where r.prospect_id = p.id and r.status in ('accepted','settled')
       ) as controle_acceptation,
       (now() >= p.created_at + interval '3 months') as controle_trois_mois
  from prospects p
  cross join lateral public.founder_bonus_unlock_state(p.id) s
 where p.is_founder
 order by p.created_at
 limit 50;
```

Attendu : `has_acceptance = controle_acceptation` sur toutes les lignes ; `met = true` **uniquement** là où `controle_acceptation` et `controle_trois_mois` valent tous deux `true` **et** où `launch_at` est dépassé ; `unlock_at` jamais antérieur à `created_at + 3 mois`. Toute divergence bloque le déploiement du code.

3. La migration passe **avant** le déploiement du code : le wrapper déprécié `apply_founder_signup_bonus` garantit que le code encore en place continue de fonctionner dans l'intervalle.
4. Pousser sur `main` (déploiement Vercel automatique).
5. Vérifier après le premier passage du cron : aucun bonus `completed` préexistant n'a bougé, les nouveaux fondateurs ont bien une ligne `pending`.
6. Répliquer l'UI sur le worktree `worktree-mobile-app`, puis build EAS. Aucune régression d'ici là : le mobile lit `signupBonusCents`, qui vaut 0 tant que le bonus est verrouillé.
