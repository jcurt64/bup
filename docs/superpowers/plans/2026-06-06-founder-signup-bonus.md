# Bonus fondateur 5 € à l'inscription — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créditer un bonus fictif de 5 € « Bonus fondateur » sur le portefeuille des prospects issus de la liste d'attente (`is_founder = true`), le mettre en valeur web + mobile, et notifier chaque bénéficiaire (cloche in-app ciblée + email).

**Architecture:** Une RPC Postgres idempotente écrit le crédit (`transactions.type = 'signup_bonus'`). Les routes `wallet` et `movements` comptent et formatent ce nouveau type via un petit module partagé `lib/prospect/transactions.ts`. Un endpoint admin one-time orchestre le backfill : RPC → broadcast ciblé (`admin_broadcasts.target_clerk_user_id`) → email Brevo. Le mobile lit le même backend ; seul son écran portefeuille reçoit le highlight (Phase 2, worktree isolé).

**Tech Stack:** Next.js (App Router, route handlers `runtime="nodejs"`), Supabase (Postgres + service_role), Clerk (auth), Brevo (email via `lib/email/transport`), Vitest (tests), prototype iframe `.jsx` (UI prospect web).

**Branche de travail :** `feat/founder-signup-bonus` (déjà créée, spec committé dessus).

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `supabase/migrations/<ts>_founder_signup_bonus.sql` | Enum `signup_bonus`, colonne flag, RPC `apply_founder_signup_bonus` | Créer |
| `lib/supabase/types.ts` | Types générés : ajouter `signup_bonus` à l'enum `transaction_type` | Modifier |
| `lib/prospect/transactions.ts` | Contrat d'affichage partagé : `GAIN_TRANSACTION_TYPES`, `SIGNUP_BONUS_ORIGIN`, `statusLabel`, `statusChip` | Créer |
| `tests/lib/prospect/transactions.test.ts` | Tests unitaires du module ci-dessus | Créer |
| `app/api/prospect/wallet/route.ts` | Compter `signup_bonus` dans les gains (via constante partagée) | Modifier |
| `app/api/prospect/movements/route.ts` | Utiliser le module partagé + libellé/kind du bonus | Modifier |
| `lib/email/founder-bonus.ts` | `renderFounderBonusEmail` (pur) + `sendFounderBonusEmail` | Créer |
| `tests/lib/email/founder-bonus.test.ts` | Test du rendu email | Créer |
| `lib/founder-bonus/distribute.ts` | Orchestration backfill (éligibles → RPC → broadcast → email) | Créer |
| `tests/lib/founder-bonus/distribute.test.ts` | Tests dry-run / confirm / idempotence | Créer |
| `app/api/admin/founder-bonus/distribute/route.ts` | Endpoint admin fin (garde + délégation lib) | Créer |
| `tests/api/admin/founder-bonus-distribute.test.ts` | Test garde + forme réponse | Créer |
| `public/prototype/components/Prospect.jsx` | Highlight ligne historique « Bonus fondateur » (web) | Modifier |
| `<écran portefeuille mobile>` (worktree `worktree-mobile-app`) | Highlight équivalent (Phase 2) | Modifier |

---

## Task 1 : Module partagé `lib/prospect/transactions.ts` (contrat d'affichage)

**Pourquoi :** `statusLabel`/`statusChip` sont aujourd'hui inline et non testables dans `movements/route.ts`, et la liste des types « gain » est dupliquée en dur dans `wallet/route.ts`. On extrait un module pur, testable, importé par les deux routes (DRY). On y ajoute le cas `signup_bonus`.

**Files:**
- Create: `lib/prospect/transactions.ts`
- Test: `tests/lib/prospect/transactions.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// tests/lib/prospect/transactions.test.ts
import { describe, expect, it } from "vitest";
import {
  GAIN_TRANSACTION_TYPES,
  SIGNUP_BONUS_ORIGIN,
  statusLabel,
  statusChip,
} from "@/lib/prospect/transactions";

describe("transactions display contract", () => {
  it("inclut signup_bonus dans les types de gain", () => {
    expect(GAIN_TRANSACTION_TYPES).toContain("credit");
    expect(GAIN_TRANSACTION_TYPES).toContain("referral_bonus");
    expect(GAIN_TRANSACTION_TYPES).toContain("signup_bonus");
  });

  it("statusLabel : signup_bonus completed → Crédité", () => {
    expect(statusLabel("signup_bonus", "completed")).toBe("Crédité");
    expect(statusLabel("credit", "completed")).toBe("Crédité");
    expect(statusLabel("escrow", "pending")).toBe("En séquestre");
    expect(statusLabel("withdrawal", "completed")).toBe("Exécuté");
  });

  it("statusChip : signup_bonus completed → good", () => {
    expect(statusChip("signup_bonus", "completed")).toBe("good");
    expect(statusChip("escrow", "pending")).toBe("warn");
    expect(statusChip("refund", "completed")).toBe("");
  });

  it("expose le libellé canonique du bonus", () => {
    expect(SIGNUP_BONUS_ORIGIN).toBe("Bonus fondateur 🎁");
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npx vitest run tests/lib/prospect/transactions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/prospect/transactions'`.

- [ ] **Step 3 : Implémenter le module**

```ts
// lib/prospect/transactions.ts
/**
 * Contrat d'affichage des transactions prospect, partagé par
 * /api/prospect/wallet (agrégats de gains) et /api/prospect/movements
 * (libellés de l'historique). Centralisé ici pour rester DRY et testable.
 */

/** Types de transaction comptés comme "gain" du prospect (mois + cumul +
 *  disponible). `signup_bonus` = bonus fondateur 5 € crédité à l'inscription,
 *  pleinement retirable au même titre qu'un credit/referral_bonus. */
export const GAIN_TRANSACTION_TYPES = [
  "credit",
  "referral_bonus",
  "signup_bonus",
] as const;

/** Libellé d'origine canonique d'une ligne de bonus fondateur dans
 *  l'historique des mouvements (transaction hors-relation). */
export const SIGNUP_BONUS_ORIGIN = "Bonus fondateur 🎁";

export function statusLabel(type: string, status: string): string {
  if (type === "withdrawal") return status === "completed" ? "Exécuté" : "En cours";
  if (type === "escrow")
    return status === "pending" ? "En séquestre"
      : status === "completed" ? "Crédité"
      : status === "canceled" ? "Annulé" : status;
  if (type === "credit") return status === "completed" ? "Crédité" : status;
  if (type === "referral_bonus") return status === "completed" ? "Crédité" : status;
  if (type === "signup_bonus") return status === "completed" ? "Crédité" : status;
  if (type === "refund") return "Remboursé";
  return status;
}

// `chip-good` (vert), `chip-warn` (orange), ou "" (neutre) — aligné avec les
// classes CSS de la table de l'onglet Portefeuille.
export function statusChip(type: string, status: string): "good" | "warn" | "" {
  if (type === "escrow" && status === "pending") return "warn";
  if (
    (type === "credit" || type === "referral_bonus" || type === "signup_bonus") &&
    status === "completed"
  ) {
    return "good";
  }
  if (type === "escrow" && status === "completed") return "good";
  return "";
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npx vitest run tests/lib/prospect/transactions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/prospect/transactions.ts tests/lib/prospect/transactions.test.ts
git commit -m "feat(prospect): contrat d'affichage transactions partagé + signup_bonus"
```

---

## Task 2 : Brancher `movements` sur le module + libellé/kind du bonus

**Files:**
- Modify: `app/api/prospect/movements/route.ts`

- [ ] **Step 1 : Remplacer les helpers inline par l'import partagé**

Supprimer les définitions locales `statusLabel` (≈ lignes 97-107) et `statusChip` (≈ lignes 109-116), puis ajouter en haut du fichier (après les imports existants) :

```ts
import {
  statusLabel,
  statusChip,
  SIGNUP_BONUS_ORIGIN,
} from "@/lib/prospect/transactions";
```

- [ ] **Step 2 : Cas `signup_bonus` dans `originLabel`**

Dans `originLabel(row)` (≈ ligne 118), ajouter en toute première ligne du corps :

```ts
  if (row.type === "signup_bonus") return SIGNUP_BONUS_ORIGIN;
```

(Le bonus est une transaction hors-relation : on force le libellé canonique au lieu de retomber sur `description`.)

- [ ] **Step 3 : Exposer `kind` dans le payload du mouvement**

Dans le `.map` final (objet retourné ≈ ligne 294-307), ajouter le champ :

```ts
      kind: r.type,
```

(Permet à l'UI de cibler la ligne `kind === 'signup_bonus'` sans dépendre du texte.)

- [ ] **Step 4 : Vérifier que rien d'autre ne casse (typecheck + suite)**

Run: `npx vitest run` puis `npx tsc --noEmit`
Expected: tests verts ; **`tsc` peut signaler** que `'signup_bonus'` n'appartient pas à l'enum `transaction_type` tant que Task 4 (types.ts) n'est pas faite — c'est attendu. Les comparaisons `row.type === "signup_bonus"` portent sur `string`, donc OK ; le typecheck dur passe après Task 4.

- [ ] **Step 5 : Commit**

```bash
git add app/api/prospect/movements/route.ts
git commit -m "feat(prospect/movements): libellé + kind du bonus fondateur"
```

---

## Task 3 : `wallet` compte le bonus (via la constante partagée)

**Files:**
- Modify: `app/api/prospect/wallet/route.ts`

- [ ] **Step 1 : Importer la constante partagée**

Ajouter après les imports existants :

```ts
import { GAIN_TRANSACTION_TYPES } from "@/lib/prospect/transactions";
```

- [ ] **Step 2 : Utiliser la constante dans les deux requêtes de gains**

Dans `gainsLifetime` (≈ ligne 83) et `gainsMonth` (≈ ligne 90), remplacer :

```ts
.in("type", ["credit", "referral_bonus"])
```

par :

```ts
.in("type", [...GAIN_TRANSACTION_TYPES])
```

- [ ] **Step 3 : Mettre à jour le commentaire de tête**

Dans le bloc JSDoc en tête (« Définition d'une transaction "gain" », ≈ ligne 19-23), remplacer la ligne :

```
 *   - type ∈ {'credit', 'referral_bonus'}
```

par :

```
 *   - type ∈ {'credit', 'referral_bonus', 'signup_bonus'}
```

- [ ] **Step 4 : Vérifier**

Run: `npx vitest run`
Expected: PASS (aucun test ne régresse).

- [ ] **Step 5 : Commit**

```bash
git add app/api/prospect/wallet/route.ts
git commit -m "feat(prospect/wallet): compter le bonus fondateur (retirable)"
```

---

## Task 4 : Migration DB (enum + colonne + RPC) et types générés

**Files:**
- Create: `supabase/migrations/<ts>_founder_signup_bonus.sql`
- Modify: `lib/supabase/types.ts`

> ⚠️ Procédure projet (mémoire) : **ne pas faire `db push`**. Exécuter le SQL dans le **SQL Editor** du dashboard Supabase (remote), committer le fichier de migration, puis `supabase migration repair --status applied <ts>`.

- [ ] **Step 1 : Créer le fichier de migration**

Nom : `supabase/migrations/20260606120000_founder_signup_bonus.sql` (ajuster le timestamp pour qu'il soit postérieur à la dernière migration existante).

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Bonus fondateur 5 € à l'inscription
-- ════════════════════════════════════════════════════════════════════
-- Crédite 5,00 € (500 cents) sur le portefeuille des prospects fondateurs
-- (is_founder = true, càd email présent en waitlist). Versement fictif :
-- pas de mouvement Stripe réel. Idempotent via prospects.founder_signup_bonus_applied.
-- ════════════════════════════════════════════════════════════════════

-- 1. Nouvelle valeur d'enum. `add value` ne peut pas être utilisée dans la
--    même transaction que son premier usage : on l'isole ici (à exécuter
--    en premier dans le SQL Editor).
alter type public.transaction_type add value if not exists 'signup_bonus';

-- 2. Drapeau d'idempotence sur le prospect.
alter table public.prospects
  add column if not exists founder_signup_bonus_applied boolean not null default false;

-- 3. RPC idempotente. SECURITY DEFINER : appelée depuis le backend
--    service_role, écrit la transaction + pose le flag de façon atomique.
create or replace function public.apply_founder_signup_bonus(p_prospect_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_founder boolean;
  v_applied boolean;
begin
  select is_founder, founder_signup_bonus_applied
    into v_is_founder, v_applied
    from public.prospects
   where id = p_prospect_id
   for update;

  -- Pas trouvé, non fondateur, ou déjà crédité → no-op.
  if not found or v_is_founder is not true or v_applied is true then
    return false;
  end if;

  insert into public.transactions
    (account_id, account_kind, type, status, amount_cents, description)
  values
    (p_prospect_id, 'prospect', 'signup_bonus', 'completed', 500,
     'Bonus fondateur à l''inscription');

  update public.prospects
     set founder_signup_bonus_applied = true
   where id = p_prospect_id;

  return true;
end;
$$;

revoke all on function public.apply_founder_signup_bonus(uuid) from public, anon, authenticated;
```

- [ ] **Step 2 : Exécuter sur le remote (SQL Editor)**

Coller le contenu dans le SQL Editor Supabase et exécuter. Si Postgres refuse `add value` + usage dans le même run, exécuter d'abord **uniquement** la ligne `alter type ... add value`, valider, puis exécuter le reste.

- [ ] **Step 3 : Vérifier la RPC sur le remote (SQL Editor)**

```sql
-- Doit renvoyer le nombre de prospects fondateurs encore non crédités.
select count(*) from public.prospects
 where is_founder = true and founder_signup_bonus_applied = false;
```

Expected: un entier ≥ 0 (à noter pour le dry-run de Task 7).

- [ ] **Step 4 : Repair de l'historique de migration**

Run: `supabase migration repair --status applied 20260606120000`
Expected: confirmation que la migration est marquée appliquée.

- [ ] **Step 5 : Mettre à jour les types générés `lib/supabase/types.ts`**

Dans l'**union** `transaction_type` (≈ ligne 1607-1614), ajouter une ligne après `| "buupp_commission"` :

```ts
        | "signup_bonus"
```

Dans le **tableau** `Constants … transaction_type` (≈ ligne 1771-1780), ajouter après `"buupp_commission",` :

```ts
        "signup_bonus",
```

- [ ] **Step 6 : Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (le warning attendu de Task 2/3 disparaît).

- [ ] **Step 7 : Commit**

```bash
git add supabase/migrations/20260606120000_founder_signup_bonus.sql lib/supabase/types.ts
git commit -m "feat(db): enum signup_bonus + RPC apply_founder_signup_bonus (idempotente)"
```

---

## Task 5 : Email « bonus fondateur »

**Files:**
- Create: `lib/email/founder-bonus.ts`
- Test: `tests/lib/email/founder-bonus.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// tests/lib/email/founder-bonus.test.ts
import { describe, expect, it } from "vitest";
import { renderFounderBonusEmail } from "@/lib/email/founder-bonus";

describe("renderFounderBonusEmail", () => {
  it("personnalise et mentionne le montant", () => {
    const { subject, text, html } = renderFounderBonusEmail({ prenom: "Léa" });
    expect(subject).toContain("bonus fondateur");
    expect(text).toContain("Léa");
    expect(text).toContain("5,00 €");
    expect(html).toContain("5,00 €");
  });

  it("gère un prénom absent", () => {
    const { text } = renderFounderBonusEmail({ prenom: null });
    expect(text).toContain("Bonjour");
    expect(text).not.toContain("null");
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npx vitest run tests/lib/email/founder-bonus.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implémenter le module**

```ts
// lib/email/founder-bonus.ts
/**
 * Email de confirmation du bonus fondateur 5 € (calqué sur
 * lib/email/waitlist.ts). `renderFounderBonusEmail` est pur et testable ;
 * `sendFounderBonusEmail` passe par safeSendMail (ne lève jamais).
 */
import {
  safeSendMail,
  getFromAddress,
  getReplyToAddress,
} from "@/lib/email/transport";

export type FounderBonusParams = { prenom: string | null };

export function renderFounderBonusEmail(params: FounderBonusParams): {
  subject: string;
  text: string;
  html: string;
} {
  const prenom = (params.prenom ?? "").trim();
  const hello = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const subject = "Votre bonus fondateur est arrivé 🎁";

  const text = [
    hello,
    "",
    "Merci d'avoir rejoint BUUPP dès la liste d'attente !",
    "Pour vous remercier, nous venons de créditer 5,00 € de bonus fondateur",
    "sur votre portefeuille. Il est dès maintenant disponible et retirable.",
    "",
    "Bienvenue parmi les tout premiers membres.",
    "L'équipe BUUPP",
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5;">
    <p>${hello}</p>
    <p>Merci d'avoir rejoint BUUPP dès la liste d'attente !</p>
    <p>Pour vous remercier, nous venons de créditer
       <strong>5,00 €&nbsp;de bonus fondateur</strong> sur votre portefeuille.
       Il est dès maintenant disponible et retirable.</p>
    <p>Bienvenue parmi les tout premiers membres.<br/>— L'équipe BUUPP</p>
  </body></html>`;

  return { subject, text, html };
}

export async function sendFounderBonusEmail(
  email: string,
  params: FounderBonusParams,
): Promise<void> {
  const { subject, text, html } = renderFounderBonusEmail(params);
  await safeSendMail({
    to: email,
    from: getFromAddress(),
    replyTo: getReplyToAddress(),
    subject,
    text,
    html,
  });
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npx vitest run tests/lib/email/founder-bonus.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/email/founder-bonus.ts tests/lib/email/founder-bonus.test.ts
git commit -m "feat(email): template bonus fondateur"
```

---

## Task 6 : Orchestration du backfill `lib/founder-bonus/distribute.ts`

**Comportement :** sélectionne les prospects `is_founder = true` ET `founder_signup_bonus_applied = false` (avec email via `prospect_identity`). En `confirm`, pour chacun : RPC `apply_founder_signup_bonus` → si crédité, insert broadcast ciblé + envoi email. Dry-run : compte seulement, n'écrit rien.

**Files:**
- Create: `lib/founder-bonus/distribute.ts`
- Test: `tests/lib/founder-bonus/distribute.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// tests/lib/founder-bonus/distribute.test.ts
import { describe, expect, it, vi } from "vitest";
import { distributeFounderBonus } from "@/lib/founder-bonus/distribute";

// Faux client admin Supabase : éligibles fixés, rpc + insert espionnés.
function makeAdmin(rows: { id: string; clerk_user_id: string; prenom: string; email: string }[]) {
  const insertSpy = vi.fn().mockResolvedValue({ error: null });
  const rpcSpy = vi.fn().mockResolvedValue({ data: true, error: null });
  const eligibleRows = rows.map((r) => ({
    id: r.id,
    clerk_user_id: r.clerk_user_id,
    prospect_identity: { email: r.email, prenom: r.prenom },
  }));
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "prospects") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: eligibleRows, error: null }),
            }),
          }),
        };
      }
      if (table === "admin_broadcasts") {
        return { insert: insertSpy };
      }
      throw new Error("table inattendue: " + table);
    }),
    rpc: rpcSpy,
  };
  return { admin, insertSpy, rpcSpy };
}

const sample = [
  { id: "p1", clerk_user_id: "c1", prenom: "Léa", email: "lea@ex.com" },
  { id: "p2", clerk_user_id: "c2", prenom: "Tom", email: "tom@ex.com" },
];

describe("distributeFounderBonus", () => {
  it("dry-run : compte les éligibles sans rien écrire", async () => {
    const { admin, insertSpy, rpcSpy } = makeAdmin(sample);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonus(admin as any, { confirm: false, sendEmail });
    expect(res.eligible).toBe(2);
    expect(res.credited).toBe(0);
    expect(rpcSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("confirm : crédite + broadcast + email par bénéficiaire", async () => {
    const { admin, insertSpy, rpcSpy } = makeAdmin(sample);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonus(admin as any, { confirm: true, sendEmail });
    expect(res.eligible).toBe(2);
    expect(res.credited).toBe(2);
    expect(res.emailed).toBe(2);
    expect(rpcSpy).toHaveBeenCalledTimes(2);
    expect(rpcSpy).toHaveBeenCalledWith("apply_founder_signup_bonus", { p_prospect_id: "p1" });
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledWith("lea@ex.com", { prenom: "Léa" });
  });

  it("confirm : RPC renvoyant false (déjà crédité) → pas de broadcast/email", async () => {
    const { admin, insertSpy, rpcSpy } = makeAdmin(sample);
    rpcSpy.mockResolvedValue({ data: false, error: null });
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await distributeFounderBonus(admin as any, { confirm: true, sendEmail });
    expect(res.credited).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npx vitest run tests/lib/founder-bonus/distribute.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implémenter l'orchestration**

```ts
// lib/founder-bonus/distribute.ts
/**
 * Backfill one-time du bonus fondateur. Idempotent : la RPC
 * apply_founder_signup_bonus garantit qu'un prospect déjà crédité est
 * ignoré (renvoie false) → ni broadcast ni email en double.
 *
 * Le broadcast est CIBLÉ (target_clerk_user_id) → seul le bénéficiaire le
 * voit dans sa cloche (cf. /api/me/notifications), conformément au choix
 * "uniquement les prospects qui ont reçu le bonus".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  sendFounderBonusEmail,
  type FounderBonusParams,
} from "@/lib/email/founder-bonus";

type Admin = SupabaseClient<Database>;

export type DistributeOptions = {
  confirm: boolean;
  /** Injection pour les tests ; par défaut l'email réel via Brevo. */
  sendEmail?: (email: string, params: FounderBonusParams) => Promise<void>;
};

export type DistributeResult = {
  eligible: number;
  credited: number;
  broadcasted: number;
  emailed: number;
  errors: number;
};

const BROADCAST = {
  title: "Votre bonus fondateur est arrivé 🎁",
  body:
    "Merci d'avoir rejoint BUUPP dès la liste d'attente ! Pour vous remercier, " +
    "nous venons de créditer 5,00 € de bonus fondateur sur votre portefeuille. " +
    "Il est dès maintenant disponible et retirable. Bienvenue parmi les tout " +
    "premiers membres.\n\nL'équipe BUUPP",
};

type EligibleRow = {
  id: string;
  clerk_user_id: string | null;
  prospect_identity: { email: string | null; prenom: string | null } | null;
};

export async function distributeFounderBonus(
  admin: Admin,
  opts: DistributeOptions,
): Promise<DistributeResult> {
  const sendEmail = opts.sendEmail ?? sendFounderBonusEmail;
  const result: DistributeResult = {
    eligible: 0,
    credited: 0,
    broadcasted: 0,
    emailed: 0,
    errors: 0,
  };

  // Éligibles : fondateurs pas encore crédités, avec email + clerk id.
  const { data, error } = await admin
    .from("prospects")
    .select("id, clerk_user_id, prospect_identity(email, prenom)")
    .eq("is_founder", true)
    .eq("founder_signup_bonus_applied", false);
  if (error) {
    console.error("[founder-bonus] éligibles read failed", error.message);
    return result;
  }
  const rows = (data ?? []) as unknown as EligibleRow[];
  result.eligible = rows.length;

  if (!opts.confirm) return result; // dry-run : on s'arrête après le compte.

  for (const row of rows) {
    const email = row.prospect_identity?.email ?? null;
    const clerkId = row.clerk_user_id;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: applied, error: rpcErr } = await (admin as any).rpc(
        "apply_founder_signup_bonus",
        { p_prospect_id: row.id },
      );
      if (rpcErr) {
        console.error("[founder-bonus] rpc failed", row.id, rpcErr.message);
        result.errors += 1;
        continue;
      }
      if (applied !== true) continue; // déjà crédité / non éligible → skip.
      result.credited += 1;

      if (clerkId) {
        const { error: bErr } = await admin.from("admin_broadcasts").insert({
          title: BROADCAST.title,
          body: BROADCAST.body,
          audience: "prospects",
          created_by_admin_id: "system:founder-bonus",
          target_clerk_user_id: clerkId,
        });
        if (bErr) {
          console.error("[founder-bonus] broadcast insert failed", row.id, bErr.message);
          result.errors += 1;
        } else {
          result.broadcasted += 1;
        }
      }

      if (email) {
        await sendEmail(email, { prenom: row.prospect_identity?.prenom ?? null });
        result.emailed += 1;
      }
    } catch (err) {
      console.error("[founder-bonus] unexpected error", row.id, err);
      result.errors += 1;
    }
  }

  return result;
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npx vitest run tests/lib/founder-bonus/distribute.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add lib/founder-bonus/distribute.ts tests/lib/founder-bonus/distribute.test.ts
git commit -m "feat(founder-bonus): orchestration backfill idempotente (dry-run + confirm)"
```

---

## Task 7 : Endpoint admin `POST /api/admin/founder-bonus/distribute`

**Files:**
- Create: `app/api/admin/founder-bonus/distribute/route.ts`
- Test: `tests/api/admin/founder-bonus-distribute.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// tests/api/admin/founder-bonus-distribute.test.ts
import { describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
vi.mock("@/lib/admin/access", () => ({
  requireAdminRequest: (req: Request) => requireAdminMock(req),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({}),
}));
const distributeMock = vi.fn();
vi.mock("@/lib/founder-bonus/distribute", () => ({
  distributeFounderBonus: (...a: unknown[]) => distributeMock(...a),
}));

describe("POST /api/admin/founder-bonus/distribute", () => {
  it("renvoie la réponse de la garde admin si refusée", async () => {
    requireAdminMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute", { method: "POST" }));
    expect(res.status).toBe(404);
    expect(distributeMock).not.toHaveBeenCalled();
  });

  it("dry-run par défaut (confirm=false)", async () => {
    requireAdminMock.mockResolvedValueOnce(null);
    distributeMock.mockResolvedValueOnce({ eligible: 7, credited: 0, broadcasted: 0, emailed: 0, errors: 0 });
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute", { method: "POST" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.dryRun).toBe(true);
    expect(json.eligible).toBe(7);
    expect(distributeMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirm: false }));
  });

  it("confirm=1 → distribution réelle", async () => {
    requireAdminMock.mockResolvedValueOnce(null);
    distributeMock.mockResolvedValueOnce({ eligible: 7, credited: 7, broadcasted: 7, emailed: 7, errors: 0 });
    const { POST } = await import("@/app/api/admin/founder-bonus/distribute/route");
    const res = await POST(new Request("http://x/api/admin/founder-bonus/distribute?confirm=1", { method: "POST" }));
    const json = await res.json();
    expect(json.dryRun).toBe(false);
    expect(json.credited).toBe(7);
    expect(distributeMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirm: true }));
  });
});
```

- [ ] **Step 2 : Lancer le test (doit échouer)**

Run: `npx vitest run tests/api/admin/founder-bonus-distribute.test.ts`
Expected: FAIL — route introuvable.

- [ ] **Step 3 : Implémenter la route fine**

```ts
// app/api/admin/founder-bonus/distribute/route.ts
/**
 * POST /api/admin/founder-bonus/distribute — verse le bonus fondateur 5 €
 * aux prospects éligibles (is_founder, non encore crédités).
 *
 *   ?confirm=1 → distribution RÉELLE (crédits + broadcasts ciblés + emails).
 *   sinon       → dry-run : renvoie seulement { eligible } sans rien écrire.
 *
 * Garde : admin (session Clerk allowlistée OU x-admin-secret), via
 * requireAdminRequest. Idempotent : re-jouer ne double-crédite personne.
 */
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { distributeFounderBonus } from "@/lib/founder-bonus/distribute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const confirm = new URL(req.url).searchParams.get("confirm") === "1";
  const admin = createSupabaseAdminClient();
  const result = await distributeFounderBonus(admin, { confirm });

  return NextResponse.json({ dryRun: !confirm, ...result });
}
```

- [ ] **Step 4 : Lancer le test (doit passer)**

Run: `npx vitest run tests/api/admin/founder-bonus-distribute.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add app/api/admin/founder-bonus/distribute/route.ts tests/api/admin/founder-bonus-distribute.test.ts
git commit -m "feat(admin): endpoint distribution bonus fondateur (dry-run + confirm)"
```

---

## Task 8 : Mise en valeur UI — Web (`Prospect.jsx`)

**Files:**
- Modify: `public/prototype/components/Prospect.jsx` (composant `Portefeuille`, rendu de ligne ≈ 2542-2576)

> Pas de test automatisé (prototype iframe rendu visuellement). Le cache iframe est busté automatiquement au déploiement (`PROTOTYPE_VERSION` ⟵ `VERCEL_DEPLOYMENT_ID`). En local : redémarrer `next dev` pour rafraîchir.

- [ ] **Step 1 : Détecter la ligne bonus et la styliser**

Dans le `.map` des mouvements (le `return (<tr …>` ≈ ligne 2542), ajouter avant le `return` une détection :

```jsx
                const isSignupBonus = m.kind === 'signup_bonus';
```

Puis sur le `<tr>`, fusionner un fond accentué léger quand c'est le bonus (réutiliser les variables de thème, pas de couleur en dur) :

```jsx
                    style={{
                      ...(clickable ? { cursor: 'pointer' } : null),
                      ...(isSignupBonus ? { background: 'color-mix(in srgb, var(--good) 8%, transparent)' } : null),
                    }}
```

(Remplace l'ancien `style={clickable ? { cursor: 'pointer' } : undefined}`.)

- [ ] **Step 2 : Pastille « Bonus fondateur » dans la colonne Origine**

Remplacer la cellule Origine `<td>{m.origin}</td>` (≈ ligne 2557) par :

```jsx
                    <td>
                      {isSignupBonus ? (
                        <span className="chip chip-good" style={{ fontWeight: 600 }}>
                          <Icon name="gift" size={12}/> Bonus fondateur
                        </span>
                      ) : (
                        m.origin
                      )}
                    </td>
```

- [ ] **Step 3 : Vérifier que l'icône `gift` existe ; sinon repli**

Chercher la définition des icônes du prototype :

Run: `grep -n "gift\|case 'wallet'\|function Icon" public/prototype/components/Prospect.jsx public/prototype/components/Shell.jsx`
- Si `gift` n'existe pas dans le composant `Icon`, utiliser une icône déjà présente (ex. `'wallet'` ou `'star'`) à la place de `name="gift"`, OU retirer l'`<Icon>` et garder uniquement le texte « 🎁 Bonus fondateur ». Ne pas inventer un nom d'icône non défini.

- [ ] **Step 4 : Vérification visuelle locale**

Run: `npm run dev` puis ouvrir `/prospect?tab=portefeuille` avec un compte fondateur ayant reçu le bonus (après distribution Task 9, ou un crédit `signup_bonus` inséré manuellement en dev). Confirmer : ligne « Bonus fondateur » sur fond accentué, montant `+5,00 €` en vert, statut « Crédité », et que les 3 cartes du haut comptent bien le bonus (Disponible ≥ 5 €).

- [ ] **Step 5 : Commit**

```bash
git add public/prototype/components/Prospect.jsx
git commit -m "feat(prospect/web): mise en valeur du bonus fondateur dans l'historique"
```

---

## Task 9 (Phase 1 — finalisation) : suite complète + push + distribution

- [ ] **Step 1 : Suite complète + typecheck + lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint`
Expected: tout vert.

- [ ] **Step 2 : Push de la branche**

```bash
git push -u origin feat/founder-signup-bonus
```

(Le déploiement Vercel preview/prod buste le cache prototype via `PROTOTYPE_VERSION`.)

- [ ] **Step 3 : Dry-run de la distribution (AUCUNE écriture)**

> Pré-requis : Task 4 appliquée sur le remote, code déployé là où l'endpoint est joignable, env `ADMIN_EMAILS` ou `BUUPP_ADMIN_SECRET` configurée.

Run (exemple via secret machine) :
```bash
curl -s -X POST "https://<host>/api/admin/founder-bonus/distribute" -H "x-admin-secret: $BUUPP_ADMIN_SECRET" | jq
```
Expected: `{ "dryRun": true, "eligible": <N>, "credited": 0, ... }`. **Vérifier que `eligible` correspond au compte SQL de Task 4 Step 3.**

- [ ] **Step 4 : ⛔ GATE — feu vert utilisateur avant l'envoi réel**

Ne PAS lancer le `confirm=1` sans accord explicite : c'est une action sortante (crédits réels + emails Brevo réels). Présenter le `eligible` du dry-run à l'utilisateur et attendre son go.

- [ ] **Step 5 : Distribution réelle (après go)**

```bash
curl -s -X POST "https://<host>/api/admin/founder-bonus/distribute?confirm=1" -H "x-admin-secret: $BUUPP_ADMIN_SECRET" | jq
```
Expected: `{ "dryRun": false, "eligible": N, "credited": N, "broadcasted": N, "emailed": N, "errors": 0 }`.
Vérifier ensuite côté SQL que `count(... founder_signup_bonus_applied = false)` est tombé à 0, et qu'un re-run renvoie `credited: 0` (idempotence).

---

## Task 10 (Phase 2) : Mise en valeur UI — Mobile (worktree isolé)

> Branche `worktree-mobile-app` (worktree `.claude/worktrees/mobile-app`). Le mobile lit le même backend → wallet/movements servent déjà `kind: 'signup_bonus'`. Seul l'écran portefeuille mobile doit afficher le highlight, en respectant dark mode (`lib/theme`) + police Fraunces.

- [ ] **Step 1 : Localiser l'écran portefeuille mobile**

Dans le worktree mobile :
Run: `grep -rln "movements\|monthGainsEur\|Disponible\|séquestre" <racine-app-mobile>/ --include=*.tsx`
Identifier le composant qui rend la liste des mouvements (équivalent RN de `Portefeuille`).

- [ ] **Step 2 : Highlight de la ligne bonus**

Dans le rendu d'une ligne de mouvement, détecter `item.kind === 'signup_bonus'` et :
- afficher un badge « 🎁 Bonus fondateur » (couleur succès du thème via `useTheme().c`) ;
- fond de ligne légèrement accentué (variable de thème, pas de couleur en dur) ;
- conserver le montant `+5,00 €` en couleur positive.
Suivre le pattern de badges/chips déjà présent dans l'écran (réutiliser, ne pas réinventer).

- [ ] **Step 3 : Vérification visuelle (clair + sombre)**

Lancer l'app mobile (Expo) avec un compte fondateur crédité ; confirmer le rendu du badge en thème clair ET sombre.

- [ ] **Step 4 : Commit (sur la branche mobile)**

```bash
git add <fichier-écran-portefeuille-mobile>
git commit -m "feat(mobile/wallet): mise en valeur du bonus fondateur"
```

---

## Self-Review (couverture spec)

- Spec §A (migration enum + colonne + RPC) → Task 4. ✔
- Spec §B (wallet compte le bonus, retirable) → Task 3 (+ constante Task 1). ✔
- Spec §C (movements : libellé + chip + kind) → Tasks 1 & 2. ✔
- Spec §D (highlight web) → Task 8. ✔
- Spec §E (highlight mobile) → Task 10. ✔
- Spec §F (endpoint distribute : dry-run, confirm, broadcast ciblé, email, idempotence) → Tasks 5, 6, 7, 9. ✔
- Spec §G (Stripe hors périmètre) → aucun code Stripe touché. ✔
- Spec §H (tests) → Tasks 1, 5, 6, 7 (vitest) ; SQL/visual documentés là où le runtime ne permet pas de test unitaire. ✔
- Garde-fou action sortante (dry-run + gate) → Task 9 Steps 3-5. ✔

Cohérence des types : `kind` ajouté en Task 2 et consommé en Tasks 8/10 ; `GAIN_TRANSACTION_TYPES`/`statusLabel`/`statusChip`/`SIGNUP_BONUS_ORIGIN` définis Task 1, consommés Tasks 2/3 ; `distributeFounderBonus(admin, {confirm, sendEmail})` et `DistributeResult` définis Task 6, consommés Task 7 ; `renderFounderBonusEmail`/`sendFounderBonusEmail`/`FounderBonusParams` définis Task 5, consommés Task 6. Noms alignés.
