# Role Exclusivity & Adaptive Bottom Nav — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire respecter l'invariant "un user Clerk = un seul rôle (prospect XOR pro)" à 3 niveaux (BDD, serveur, client) et rendre la nav du bas contextuelle (publique / prospect / pro).

**Architecture:** Trigger Postgres `BEFORE INSERT` sur `prospects` et `pro_accounts` qui refuse l'autre rôle (filet dur). Helper serveur `ensureRole` appelé depuis `/prospect` et `/pro` qui catche le `23505` et redirige vers `/` avec un toast. Pages d'inscription splittées en `/inscription/prospect` et `/inscription/pro`. `RouteNav` devient client component qui lit `useUser().publicMetadata.role`.

**Tech Stack:** Next.js 16, Clerk 7, Supabase (Postgres), TypeScript strict, React 19. Pas de framework de test dans le projet — vérification SQL directe + smoke manuel.

**Spec:** `docs/superpowers/specs/2026-05-08-role-exclusivity-design.md`

---

## File map

| File | Action | Owner task |
|---|---|---|
| `supabase/migrations/20260508140000_role_exclusivity.sql` | Create | Task 1 |
| `lib/sync/ensureRole.ts` | Create | Task 2 |
| `app/api/clerk/webhook/route.ts` | Modify (user.created → no-op) | Task 3 |
| `app/api/me/route.ts` | Modify (role mutually exclusive, resync metadata) | Task 4 |
| `app/prospect/page.tsx` | Modify (`ensureRole("prospect")` + conflict handler) | Task 5 |
| `app/pro/page.tsx` | Create or modify (`ensureRole("pro")` + conflict handler) | Task 5 |
| `app/inscription/[[...sign-up]]/page.tsx` | Delete | Task 6 |
| `app/inscription/page.tsx` | Create (aiguillage) | Task 6 |
| `app/inscription/prospect/[[...sign-up]]/page.tsx` | Create | Task 6 |
| `app/inscription/pro/[[...sign-up]]/page.tsx` | Create | Task 6 |
| `app/connexion/[[...sign-in]]/page.tsx` | Modify (`fallbackRedirectUrl=/auth/post-login`) | Task 7 |
| `app/auth/post-login/page.tsx` | Create | Task 7 |
| `app/_components/RouteNav.tsx` | Rewrite (client adaptive) | Task 8 |
| `app/_components/RoleConflictToast.tsx` | Create | Task 9 |
| `app/page.tsx` | Modify (read flash cookie, render toast) | Task 9 |
| `app/_components/PrototypeFrame.tsx` | Modify (intercept goto pour CTAs Landing) | Task 10 |

---

## Task 1 — Migration SQL : trigger d'exclusivité de rôle

**Files:**
- Create: `supabase/migrations/20260508140000_role_exclusivity.sql`

- [ ] **Step 1.1: Écrire la migration**

Créer `supabase/migrations/20260508140000_role_exclusivity.sql` :

```sql
-- Trigger commun qui refuse une INSERT sur prospects ou pro_accounts
-- si l'utilisateur Clerk existe déjà dans l'autre table de rôle.
-- Code SQL 23505 (unique_violation) → catché côté app pour 409.

create or replace function public.assert_role_exclusivity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_table text;
  v_exists boolean;
begin
  if tg_table_name = 'prospects' then
    other_table := 'pro_accounts';
  elsif tg_table_name = 'pro_accounts' then
    other_table := 'prospects';
  else
    return new;
  end if;

  execute format(
    'select exists (select 1 from public.%I where clerk_user_id = $1)',
    other_table
  ) into v_exists using new.clerk_user_id;

  if v_exists then
    raise exception 'role_conflict: user % already has a % profile',
      new.clerk_user_id, other_table
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger prospects_role_exclusivity
  before insert on public.prospects
  for each row execute function public.assert_role_exclusivity();

create trigger pro_accounts_role_exclusivity
  before insert on public.pro_accounts
  for each row execute function public.assert_role_exclusivity();
```

- [ ] **Step 1.2: Appliquer la migration en local**

```bash
npx supabase db reset
# ou si la base locale est saine et qu'on veut juste appliquer :
npx supabase migration up
```

Expected: aucun warning, message "Applied migration 20260508140000_role_exclusivity".

- [ ] **Step 1.3: Vérifier le trigger via SQL**

Exécuter (via Studio Supabase local OU `psql` direct) :

```sql
-- Cas A : doit échouer (insert prospect puis insert pro même user)
insert into prospects (clerk_user_id) values ('test_user_role_excl_1');
insert into pro_accounts (clerk_user_id, raison_sociale)
  values ('test_user_role_excl_1', 'Test Co');
-- Doit lever : ERROR  role_conflict: user test_user_role_excl_1 already has a prospects profile (SQLSTATE 23505)

-- Cas B : symétrique
insert into pro_accounts (clerk_user_id, raison_sociale)
  values ('test_user_role_excl_2', 'Test Co 2');
insert into prospects (clerk_user_id) values ('test_user_role_excl_2');
-- Doit lever : 23505 sur prospects

-- Cleanup
delete from prospects where clerk_user_id like 'test_user_role_excl_%';
delete from pro_accounts where clerk_user_id like 'test_user_role_excl_%';
```

Expected: les deuxièmes INSERT remontent `ERROR: role_conflict ... SQLSTATE 23505`. Les autres INSERT passent. Le cleanup réussit.

- [ ] **Step 1.4: Régénérer les types Supabase si nécessaire**

```bash
npx supabase gen types typescript --local > lib/supabase/types.ts
```

Expected: pas de diff structurel sur les tables (le trigger n'ajoute pas de colonne). Le fichier reste identique sur le contenu — si jamais il y a un diff non-significatif (ordre, etc.), le commiter avec.

- [ ] **Step 1.5: Commit**

```bash
git add supabase/migrations/20260508140000_role_exclusivity.sql lib/supabase/types.ts
git commit -m "feat(db): trigger d'exclusivité de rôle prospect XOR pro"
```

---

## Task 2 — Helper serveur `ensureRole`

**Files:**
- Create: `lib/sync/ensureRole.ts`

- [ ] **Step 2.1: Repérer la signature exacte de `ensureProspect` et `ensureProAccount`**

Lire pour confirmer :
- `lib/sync/prospects.ts` — `ensureProspect({ clerkUserId, email?, prenom?, nom? }) → Promise<string>`
- `lib/sync/pro-accounts.ts` — `ensureProAccount({ clerkUserId, email?, raisonSociale? }) → Promise<string>`

Confirmé dans Task 0 (recherche initiale). Pas d'action.

- [ ] **Step 2.2: Créer le helper**

Écrire `lib/sync/ensureRole.ts` :

```ts
/**
 * Helper unifié de création / vérification de rôle. Mirroir des deux
 * helpers existants (`ensureProspect`, `ensureProAccount`) avec :
 *   - un seul point d'entrée pour l'app (UI / pages serveur).
 *   - une détection du conflit côté trigger Postgres (code 23505) qu'on
 *     traduit en `RoleConflictError` typé.
 *   - propagation de `publicMetadata.role` côté Clerk (cache de lecture).
 *
 * La DB fait foi : si la propagation Clerk échoue, on log mais on ne
 * throw pas (le rôle sera resyncé par /api/me au prochain accès).
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { clerkClient } from "@/lib/clerk/server";
import { ensureProspect } from "./prospects";
import { ensureProAccount } from "./pro-accounts";

export type Role = "prospect" | "pro";

export class RoleConflictError extends Error {
  readonly existingRole: Role;
  constructor(existingRole: Role) {
    super(`role_conflict:${existingRole}`);
    this.name = "RoleConflictError";
    this.existingRole = existingRole;
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  // Erreurs Supabase exposent un code SQLSTATE dans `code` (PostgrestError)
  // ou via `message` (raw pg). 23505 = unique_violation, levé par notre trigger.
  if (!err || typeof err !== "object") return false;
  const e = err as Partial<PostgrestError> & { message?: string };
  if (e.code === "23505") return true;
  return typeof e.message === "string" && e.message.includes("role_conflict");
}

export type EnsureRoleIdentity = {
  prenom?: string | null;
  nom?: string | null;
  raisonSociale?: string | null;
};

export async function ensureRole(
  userId: string,
  email: string | null,
  role: Role,
  identity?: EnsureRoleIdentity,
): Promise<void> {
  try {
    if (role === "prospect") {
      await ensureProspect({
        clerkUserId: userId,
        email,
        prenom: identity?.prenom ?? null,
        nom: identity?.nom ?? null,
      });
    } else {
      await ensureProAccount({
        clerkUserId: userId,
        email,
        raisonSociale: identity?.raisonSociale ?? null,
      });
    }
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      const existing: Role = role === "prospect" ? "pro" : "prospect";
      throw new RoleConflictError(existing);
    }
    throw err;
  }

  try {
    const client = await clerkClient();
    await client.users.updateUser(userId, { publicMetadata: { role } });
  } catch (err) {
    // Volontairement non-bloquant — la DB fait foi.
    console.error("[ensureRole] failed to update Clerk publicMetadata", err);
  }
}
```

- [ ] **Step 2.3: Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur.

- [ ] **Step 2.4: Commit**

```bash
git add lib/sync/ensureRole.ts
git commit -m "feat(sync): ensureRole helper avec RoleConflictError"
```

---

## Task 3 — Webhook Clerk : neutraliser `user.created`

**Files:**
- Modify: `app/api/clerk/webhook/route.ts`

- [ ] **Step 3.1: Modifier le case `user.created`**

Remplacer le bloc `case "user.created"` (lignes 60-72 actuelles) par :

```ts
    case "user.created": {
      // No-op intentionnel : la création de la row prospect/pro est
      // désormais déclenchée à la 1ère visite de /prospect ou /pro via
      // ensureRole(). Auto-créer un prospect ici aurait pour effet
      // d'empêcher l'inscription en /inscription/pro (le trigger
      // d'exclusivité de rôle refuserait l'INSERT pro_accounts qui suit).
      break;
    }
```

- [ ] **Step 3.2: Nettoyer l'import `ensureProspect` du webhook s'il devient inutile**

Vérifier après modification : si `ensureProspect` n'est plus référencé dans le fichier, supprimer l'import. Si `deleteProspect` l'est encore (case `user.deleted`), garder seulement cet import.

```bash
grep -n "ensureProspect\|deleteProspect" app/api/clerk/webhook/route.ts
```

Expected: seul `deleteProspect` reste utilisé. Adapter l'import :

```ts
import { deleteProspect } from "@/lib/sync/prospects";
```

- [ ] **Step 3.3: Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur.

- [ ] **Step 3.4: Commit**

```bash
git add app/api/clerk/webhook/route.ts
git commit -m "refactor(clerk-webhook): user.created devient no-op (ensureRole gère la création)"
```

---

## Task 4 — `/api/me` : rôle mutuellement exclusif + resync metadata

**Files:**
- Modify: `app/api/me/route.ts`

- [ ] **Step 4.1: Adapter la lecture du rôle**

Dans `app/api/me/route.ts`, remplacer :

```ts
const role: "pro" | "prospect" = proRow ? "pro" : "prospect";
```

par :

```ts
// Mutuellement exclusif depuis la migration 20260508140000.
// `role === null` = utilisateur Clerk valide mais qui n'a pas encore
// finalisé son inscription (tab fermé entre signup et /prospect|/pro).
const role: "pro" | "prospect" | null =
  proRow ? "pro" : prospectRow ? "prospect" : null;
```

- [ ] **Step 4.2: Adapter le payload retourné**

Remplacer la construction du payload (autour des lignes 81-104 actuelles) par :

```ts
let displayName: string;
let initials: string;

if (role === "pro" && proRow?.raison_sociale) {
  displayName = proRow.raison_sociale;
  const parts = proRow.raison_sociale.split(/\s+/).filter(Boolean);
  initials = makeInitials(parts[0] ?? null, parts[1] ?? null, proRow.raison_sociale);
} else {
  displayName = `${prenom ?? ""} ${nom ?? ""}`.trim() || email || "Utilisateur";
  initials = makeInitials(prenom, nom, email ?? displayName);
}

return NextResponse.json({
  prenom,
  nom,
  email,
  initials,
  role,
  displayName,
  // hasProspectProfile / hasProProfile retirés — mutuellement exclusifs
  // désormais. Les consommateurs lisent `role` directement.
});
```

- [ ] **Step 4.3: Resyncer `publicMetadata.role` si désynchronisé**

Juste avant le `return NextResponse.json(...)`, ajouter :

```ts
// Resync défensif du cache Clerk : si la DB a un rôle mais que Clerk
// ne le sait pas (ou vice versa), on aligne sur la DB (source de vérité).
const cachedRole = (user?.publicMetadata as { role?: "prospect" | "pro" } | undefined)?.role;
if (role !== null && cachedRole !== role) {
  try {
    const client = await clerkClient();
    await client.users.updateUser(userId, { publicMetadata: { role } });
  } catch (err) {
    console.error("[/api/me] failed to resync Clerk publicMetadata", err);
  }
}
```

- [ ] **Step 4.4: Vérifier qu'aucun consommateur du payload ne lit `hasProspectProfile`/`hasProProfile`**

```bash
grep -rn "hasProspectProfile\|hasProProfile" app/ public/prototype/ lib/
```

Expected: aucun résultat (sinon, adapter le consommateur pour lire `role` à la place).

- [ ] **Step 4.5: Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur.

- [ ] **Step 4.6: Commit**

```bash
git add app/api/me/route.ts
git commit -m "refactor(api/me): role mutuellement exclusif + resync publicMetadata"
```

---

## Task 5 — Pages serveur `/prospect` et `/pro` : `ensureRole` + handler de conflit

**Files:**
- Modify: `app/prospect/page.tsx`
- Modify: `app/pro/page.tsx`

- [ ] **Step 5.1: Réécrire `app/prospect/page.tsx`**

Contenu complet :

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureRole, RoleConflictError } from "@/lib/sync/ensureRole";
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

  try {
    await ensureRole(userId, primary?.emailAddress ?? null, "prospect", {
      prenom: user?.firstName ?? null,
      nom: user?.lastName ?? null,
    });
  } catch (err) {
    if (err instanceof RoleConflictError) {
      // Pose le cookie flash lu par app/page.tsx pour afficher un toast.
      // 60s suffisent largement pour une redirection immédiate.
      const c = await cookies();
      c.set("role_conflict", err.existingRole, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60,
        path: "/",
      });
      redirect("/");
    }
    throw err;
  }

  const supabase = await createSupabaseServerClient();
  const { data: prospect, error } = await supabase
    .from("prospects")
    .select("id, bupp_score, verification, created_at")
    .single();
  if (error) {
    console.error("[/prospect] Lecture RLS échouée :", error);
  } else {
    console.log("[/prospect] Pont Clerk↔Supabase OK → prospect", prospect.id);
  }

  const sp = await props.searchParams;
  const tab = sp.tab && VALID_TABS.has(sp.tab) ? sp.tab : null;

  return <PrototypeFrame route="prospect" tab={tab} />;
}
```

- [ ] **Step 5.2: Réécrire `app/pro/page.tsx`**

Contenu complet :

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@/lib/clerk/server";
import { ensureRole, RoleConflictError } from "@/lib/sync/ensureRole";
import PrototypeFrame from "../_components/PrototypeFrame";
import TopupReconciler from "../_components/TopupReconciler";

export const metadata = {
  title: "BUUPP — Espace Pro",
};

export default async function ProPage() {
  const { userId } = await auth();
  if (!userId) throw new Error("Auth required");

  const user = await currentUser();
  const primary = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId,
  );

  try {
    await ensureRole(userId, primary?.emailAddress ?? null, "pro");
  } catch (err) {
    if (err instanceof RoleConflictError) {
      const c = await cookies();
      c.set("role_conflict", err.existingRole, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60,
        path: "/",
      });
      redirect("/");
    }
    throw err;
  }

  return (
    <>
      <TopupReconciler />
      <PrototypeFrame route="pro" />
    </>
  );
}
```

- [ ] **Step 5.3: Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur.

- [ ] **Step 5.4: Commit**

```bash
git add app/prospect/page.tsx app/pro/page.tsx
git commit -m "feat(role): ensureRole côté pages /prospect et /pro avec gestion conflit"
```

---

## Task 6 — Split de `/inscription` en aiguillage + 2 sous-pages

**Files:**
- Delete: `app/inscription/[[...sign-up]]/page.tsx`
- Create: `app/inscription/page.tsx` (aiguillage)
- Create: `app/inscription/prospect/[[...sign-up]]/page.tsx`
- Create: `app/inscription/pro/[[...sign-up]]/page.tsx`

- [ ] **Step 6.1: Supprimer la page d'inscription monolithique**

```bash
rm -rf app/inscription/[[...sign-up]]
```

- [ ] **Step 6.2: Créer la page d'aiguillage `app/inscription/page.tsx`**

```tsx
import Link from "next/link";

export const metadata = {
  title: "BUUPP — Inscription",
};

const cardStyle: React.CSSProperties = {
  display: "block",
  background: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: 16,
  padding: "28px 24px",
  boxShadow: "0 18px 48px -16px rgba(15, 22, 41, .12)",
  textDecoration: "none",
  color: "var(--ink)",
  transition: "transform .15s ease, box-shadow .15s ease",
};

export default function InscriptionAiguillagePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px 96px",
        background: "var(--ivory)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <h1
          style={{
            fontFamily: "var(--font-fraunces, serif)",
            fontSize: 32,
            lineHeight: 1.15,
            marginBottom: 8,
          }}
        >
          Bienvenue sur BUUPP
        </h1>
        <p
          style={{
            color: "var(--ink-4, #5b6478)",
            marginBottom: 28,
          }}
        >
          Quel type de compte souhaitez-vous créer&nbsp;?
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <Link href="/inscription/prospect" style={cardStyle}>
            <div style={{ fontFamily: "var(--font-fraunces, serif)", fontSize: 20, marginBottom: 6 }}>
              Je suis un particulier
            </div>
            <div style={{ color: "var(--ink-4, #5b6478)", fontSize: 14 }}>
              Soyez payé pour partager vos données — vous gardez le contrôle.
            </div>
          </Link>

          <Link href="/inscription/pro" style={cardStyle}>
            <div style={{ fontFamily: "var(--font-fraunces, serif)", fontSize: 20, marginBottom: 6 }}>
              Je suis un professionnel
            </div>
            <div style={{ color: "var(--ink-4, #5b6478)", fontSize: 14 }}>
              Ciblez des prospects qui ont accepté votre offre.
            </div>
          </Link>
        </div>

        <p
          style={{
            marginTop: 24,
            fontSize: 13,
            color: "var(--ink-4, #5b6478)",
            textAlign: "center",
          }}
        >
          Déjà un compte ? <Link href="/connexion" style={{ color: "var(--ink)", textDecoration: "underline" }}>Se connecter</Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 6.3: Créer `app/inscription/prospect/[[...sign-up]]/page.tsx`**

```tsx
import { SignUp } from "@clerk/nextjs";

export const metadata = {
  title: "BUUPP — Inscription prospect",
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

function safeRedirect(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return undefined;
  if (!v.startsWith("/") || v.startsWith("//")) return undefined;
  return v;
}

export default async function InscriptionProspectPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px 96px",
        background: "var(--ivory)",
      }}
    >
      <SignUp
        path="/inscription/prospect"
        routing="path"
        signInUrl="/connexion"
        {...(target
          ? { forceRedirectUrl: target }
          : { fallbackRedirectUrl: "/prospect" })}
        appearance={{
          elements: {
            rootBox: { width: "100%", maxWidth: 440 },
            card: {
              background: "var(--paper)",
              borderRadius: 16,
              boxShadow: "0 18px 48px -16px rgba(15, 22, 41, .18)",
              border: "1px solid var(--line)",
            },
            headerTitle: { fontFamily: "var(--font-fraunces, serif)" },
            formButtonPrimary: {
              background: "var(--ink)",
              "&:hover, &:focus, &:active": { background: "#1a2342" },
            },
            socialButtonsBlockButton: {
              border: "1px solid var(--line)",
              borderRadius: 10,
              "&:hover, &:focus": {
                background: "var(--ivory-2, #efe9da)",
                borderColor: "var(--ink-4, #5b6478)",
              },
            },
            socialButtonsBlockButtonText: {
              fontWeight: 500,
            },
            dividerLine: { background: "var(--line)" },
            dividerText: { color: "var(--ink-4, #5b6478)" },
          },
          variables: {
            colorPrimary: "#0F1629",
            colorText: "#0F1629",
            colorTextSecondary: "#5b6478",
            borderRadius: "10px",
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          },
        }}
      />
    </main>
  );
}
```

- [ ] **Step 6.4: Créer `app/inscription/pro/[[...sign-up]]/page.tsx`**

Identique à 6.3 sauf :
- `metadata.title` → `"BUUPP — Inscription pro"`
- `path` → `"/inscription/pro"`
- `fallbackRedirectUrl` → `"/pro"`

```tsx
import { SignUp } from "@clerk/nextjs";

export const metadata = {
  title: "BUUPP — Inscription pro",
};

type SearchParams = Promise<{ redirect_url?: string | string[] }>;

function safeRedirect(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return undefined;
  if (!v.startsWith("/") || v.startsWith("//")) return undefined;
  return v;
}

export default async function InscriptionProPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px 96px",
        background: "var(--ivory)",
      }}
    >
      <SignUp
        path="/inscription/pro"
        routing="path"
        signInUrl="/connexion"
        {...(target
          ? { forceRedirectUrl: target }
          : { fallbackRedirectUrl: "/pro" })}
        appearance={{
          elements: {
            rootBox: { width: "100%", maxWidth: 440 },
            card: {
              background: "var(--paper)",
              borderRadius: 16,
              boxShadow: "0 18px 48px -16px rgba(15, 22, 41, .18)",
              border: "1px solid var(--line)",
            },
            headerTitle: { fontFamily: "var(--font-fraunces, serif)" },
            formButtonPrimary: {
              background: "var(--ink)",
              "&:hover, &:focus, &:active": { background: "#1a2342" },
            },
            socialButtonsBlockButton: {
              border: "1px solid var(--line)",
              borderRadius: 10,
              "&:hover, &:focus": {
                background: "var(--ivory-2, #efe9da)",
                borderColor: "var(--ink-4, #5b6478)",
              },
            },
            socialButtonsBlockButtonText: {
              fontWeight: 500,
            },
            dividerLine: { background: "var(--line)" },
            dividerText: { color: "var(--ink-4, #5b6478)" },
          },
          variables: {
            colorPrimary: "#0F1629",
            colorText: "#0F1629",
            colorTextSecondary: "#5b6478",
            borderRadius: "10px",
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          },
        }}
      />
    </main>
  );
}
```

- [ ] **Step 6.5: Vérifier la compilation**

```bash
npx tsc --noEmit && npx next build 2>&1 | tail -60
```

Expected: pas d'erreur, pas de conflit de routes Next.js. La build énumère les routes — vérifier que `/inscription`, `/inscription/prospect/[[...sign-up]]`, `/inscription/pro/[[...sign-up]]` apparaissent et qu'aucune route `/inscription/[[...sign-up]]` ne subsiste.

- [ ] **Step 6.6: Commit**

```bash
git add app/inscription/
git commit -m "feat(inscription): split en aiguillage + 2 sous-pages prospect/pro"
```

---

## Task 7 — `/auth/post-login` : redirection post-login intelligente

**Files:**
- Modify: `app/connexion/[[...sign-in]]/page.tsx`
- Create: `app/auth/post-login/page.tsx`

- [ ] **Step 7.1: Créer la route serveur `/auth/post-login`**

`app/auth/post-login/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { auth, clerkClient, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Role = "prospect" | "pro";

export default async function PostLoginPage() {
  const { userId } = await auth();
  if (!userId) redirect("/connexion");

  const user = await currentUser();
  const cached = (user?.publicMetadata as { role?: Role } | undefined)?.role;

  if (cached === "prospect") redirect("/prospect");
  if (cached === "pro") redirect("/pro");

  // Fallback DB : signup interrompu avant ensureRole, ou metadata pas
  // encore propagée par Clerk. On lit la vérité côté Supabase.
  const admin = createSupabaseAdminClient();
  const [{ data: proRow }, { data: prospectRow }] = await Promise.all([
    admin.from("pro_accounts").select("id").eq("clerk_user_id", userId).maybeSingle(),
    admin.from("prospects").select("id").eq("clerk_user_id", userId).maybeSingle(),
  ]);

  const dbRole: Role | null = proRow ? "pro" : prospectRow ? "prospect" : null;

  if (dbRole) {
    // Resync Clerk metadata avant la redirection (le client lira correctement
    // au prochain render).
    try {
      const client = await clerkClient();
      await client.users.updateUser(userId, { publicMetadata: { role: dbRole } });
    } catch (err) {
      console.error("[/auth/post-login] failed to resync publicMetadata", err);
    }
    redirect(dbRole === "pro" ? "/pro" : "/prospect");
  }

  // User Clerk valide mais sans rôle (rare : tab fermé entre signup et
  // /prospect|/pro). On l'envoie sur l'aiguillage pour qu'il choisisse.
  redirect("/inscription");
}
```

- [ ] **Step 7.2: Mettre à jour `/connexion`**

Dans `app/connexion/[[...sign-in]]/page.tsx`, ligne avec `fallbackRedirectUrl: "/prospect"` :

Remplacer :
```ts
        {...(target
          ? { forceRedirectUrl: target }
          : { fallbackRedirectUrl: "/prospect" })}
```

par :
```ts
        {...(target
          ? { forceRedirectUrl: target }
          : { fallbackRedirectUrl: "/auth/post-login" })}
```

Le `signUpUrl="/inscription"` reste tel quel — il pointe désormais vers la page d'aiguillage créée en Task 6.

- [ ] **Step 7.3: Mettre `/auth/(.*)` en route publique dans `proxy.ts`**

Dans `proxy.ts`, ajouter `"/auth/(.*)"` à `isPublicRoute` ? **NON** — `/auth/post-login` doit être protégé (auth Clerk requise pour lire `userId`). Le middleware Clerk doit donc le couvrir. Vérifier :

```bash
grep -n "/auth" proxy.ts
```

Expected: pas de résultat. Bonne nouvelle — la route est par défaut **protégée** (toute route non whitelistée passe par `auth.protect()`). Pas de modif nécessaire.

- [ ] **Step 7.4: Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur.

- [ ] **Step 7.5: Commit**

```bash
git add app/auth/ app/connexion/
git commit -m "feat(auth): /auth/post-login redirige selon le rôle (cache Clerk + fallback DB)"
```

---

## Task 8 — `RouteNav` : client component adaptatif

**Files:**
- Rewrite: `app/_components/RouteNav.tsx`

- [ ] **Step 8.1: Réécrire intégralement `RouteNav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import type { CSSProperties, ReactNode } from "react";

type Role = "prospect" | "pro";

type TabId = "accueil" | "liste-attente" | "prospect" | "pro" | "connexion" | "deconnexion";

type Tab = {
  id: TabId;
  href?: string; // absent = bouton (deconnexion)
  label: string;
  icon: ReactNode;
};

const Svg = ({ children }: { children: ReactNode }) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

const TAB_DEFS: Record<TabId, Tab> = {
  accueil: {
    id: "accueil",
    href: "/",
    label: "Accueil",
    icon: (
      <Svg>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </Svg>
    ),
  },
  "liste-attente": {
    id: "liste-attente",
    href: "/liste-attente",
    label: "Liste d'attente",
    icon: (
      <Svg>
        <path d="M6 2h12" />
        <path d="M6 22h12" />
        <path d="M6 2v4l6 6-6 6v4" />
        <path d="M18 2v4l-6 6 6 6v4" />
      </Svg>
    ),
  },
  prospect: {
    id: "prospect",
    href: "/prospect",
    label: "Prospect",
    icon: (
      <Svg>
        <circle cx={12} cy={8} r={4} />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </Svg>
    ),
  },
  pro: {
    id: "pro",
    href: "/pro",
    label: "Pro",
    icon: (
      <Svg>
        <rect x={3} y={7} width={18} height={13} rx={2} />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        <path d="M3 13h18" />
      </Svg>
    ),
  },
  connexion: {
    id: "connexion",
    href: "/connexion",
    label: "Connexion",
    icon: (
      <Svg>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
      </Svg>
    ),
  },
  deconnexion: {
    id: "deconnexion",
    label: "Déconnexion",
    icon: (
      <Svg>
        <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
        <path d="M14 17l5-5-5-5" />
        <path d="M19 12H7" />
      </Svg>
    ),
  },
};

const PUBLIC_TABS: TabId[] = ["accueil", "liste-attente", "connexion"];
const PROSPECT_TABS: TabId[] = ["accueil", "liste-attente", "prospect", "deconnexion"];
const PRO_TABS: TabId[] = ["accueil", "liste-attente", "pro", "deconnexion"];

const containerStyle: CSSProperties = {
  position: "fixed",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(15, 23, 42, 0.92)",
  color: "#FBF9F3",
  padding: "6px 6px",
  borderRadius: 999,
  zIndex: 90,
  backdropFilter: "blur(10px)",
  boxShadow: "0 10px 30px -10px rgba(0,0,0,.4)",
  display: "flex",
  gap: 2,
  fontSize: 12,
  whiteSpace: "nowrap",
};

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 999,
    background: active ? "#FBF9F3" : "transparent",
    color: active ? "#0F172A" : "rgba(255,255,255,.7)",
    fontWeight: active ? 500 : 400,
    transition: "all .15s",
    fontFamily: "var(--mono)",
    letterSpacing: ".04em",
    textTransform: "uppercase",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
    border: 0,
  };
}

export default function RouteNav() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  // Masquer la nav sur les pages d'auth (full-screen Clerk).
  if (pathname === "/connexion" || pathname.startsWith("/inscription")) return null;
  // Évite le flash 3-tabs → 4-tabs pendant l'hydratation Clerk.
  if (!isLoaded) return null;

  const role = isSignedIn
    ? ((user?.publicMetadata as { role?: Role } | undefined)?.role ?? null)
    : null;

  const visibleIds: TabId[] =
    role === "pro" ? PRO_TABS : role === "prospect" ? PROSPECT_TABS : PUBLIC_TABS;

  return (
    <div className="route-nav" style={containerStyle}>
      {visibleIds.map((id) => {
        const t = TAB_DEFS[id];
        const active = t.href ? pathname === t.href : false;

        if (id === "deconnexion") {
          return (
            <button
              key={id}
              type="button"
              className="route-nav-tab"
              aria-label={t.label}
              title={t.label}
              onClick={() => signOut({ redirectUrl: "/" })}
              style={{ ...tabStyle(false), background: "transparent" }}
            >
              <span className="route-nav-icon" aria-hidden>{t.icon}</span>
              <span className="route-nav-label">{t.label}</span>
            </button>
          );
        }

        return (
          <Link
            key={id}
            href={t.href!}
            className="route-nav-tab"
            aria-label={t.label}
            title={t.label}
            style={tabStyle(active)}
          >
            <span className="route-nav-icon" aria-hidden>{t.icon}</span>
            <span className="route-nav-label">{t.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 8.2: Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur.

- [ ] **Step 8.3: Commit**

```bash
git add app/_components/RouteNav.tsx
git commit -m "feat(nav): RouteNav adaptatif selon auth/rôle (publique/prospect/pro)"
```

---

## Task 9 — Toast `role_conflict` côté `/`

**Files:**
- Create: `app/_components/RoleConflictToast.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 9.1: Repérer la structure de `app/page.tsx`**

Lire le fichier pour savoir où injecter le toast (en début de retour JSX).

```bash
head -30 app/page.tsx
```

- [ ] **Step 9.2: Créer le composant client `RoleConflictToast`**

`app/_components/RoleConflictToast.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";

type Role = "prospect" | "pro";

const COPY: Record<Role, string> = {
  prospect:
    "Cette adresse email est déjà associée à un compte prospect. Connectez-vous avec ce compte ou utilisez une autre adresse pour créer un compte pro.",
  pro:
    "Cette adresse email est déjà associée à un compte professionnel. Connectez-vous avec ce compte ou utilisez une autre adresse pour créer un compte prospect.",
};

export default function RoleConflictToast({ existingRole }: { existingRole: Role }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        background: "#0F1629",
        color: "#FBF9F3",
        padding: "14px 18px",
        borderRadius: 12,
        boxShadow: "0 18px 48px -12px rgba(0,0,0,.35)",
        maxWidth: 520,
        fontSize: 14,
        lineHeight: 1.45,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <span style={{ flex: 1 }}>{COPY[existingRole]}</span>
      <button
        onClick={() => setOpen(false)}
        aria-label="Fermer"
        style={{
          background: "transparent",
          border: 0,
          color: "rgba(255,255,255,.7)",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 9.3: Modifier `app/page.tsx` pour lire et consommer le cookie**

Au sommet du fichier `app/page.tsx`, ajouter les imports :

```ts
import { cookies } from "next/headers";
import RoleConflictToast from "./_components/RoleConflictToast";
```

Au début de la fonction (qu'elle soit `default async function HomePage()` ou similaire), avant le `return` :

```ts
const c = await cookies();
const conflictCookie = c.get("role_conflict");
const conflictRole: "prospect" | "pro" | null =
  conflictCookie?.value === "prospect" || conflictCookie?.value === "pro"
    ? conflictCookie.value
    : null;

// Cookie flash : on supprime après lecture pour qu'il ne réapparaisse pas
// au prochain reload. `cookies().delete()` peut être appelé en server
// component depuis Next 15+.
if (conflictRole) {
  c.delete("role_conflict");
}
```

Puis, dans le JSX retourné, **en tout premier enfant** du fragment racine :

```tsx
{conflictRole && <RoleConflictToast existingRole={conflictRole} />}
```

Si `app/page.tsx` n'est pas async, le marquer async (signature : `export default async function HomePage()`).

- [ ] **Step 9.4: Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur.

- [ ] **Step 9.5: Commit**

```bash
git add app/_components/RoleConflictToast.tsx app/page.tsx
git commit -m "feat(home): toast d'avertissement quand un user atterrit avec role_conflict"
```

---

## Task 10 — `PrototypeFrame` : intercepter les CTAs Landing selon l'auth

**Files:**
- Modify: `app/_components/PrototypeFrame.tsx`

**Contexte** : `Landing.jsx` (dans l'iframe `/prototype/shell.html`) envoie un postMessage `{ bupp: "goto", route: "prospect" }` ou `route: "pro"` quand l'utilisateur clique "Je suis prospect" / "Je suis professionnel". Aujourd'hui, ces routes sont mappées vers `/prospect` et `/pro` directement — ce qui pour un utilisateur **non connecté** déclenche une redirection middleware vers `/connexion`. On veut plutôt l'envoyer sur la bonne page d'inscription.

- [ ] **Step 10.1: Modifier `PrototypeFrame.tsx` pour ajouter une logique conditionnelle**

Remplacer le contenu du fichier par :

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";

type Role = "prospect" | "pro";

const STATIC_ROUTES: Record<string, string> = {
  landing: "/",
  waitlist: "/liste-attente",
  auth: "/connexion",
};

// `prospect` et `pro` sont dynamiques : si l'utilisateur n'est pas connecté
// (ou n'a pas le bon rôle), on l'envoie sur la page d'inscription dédiée.
function resolveRoleRoute(
  intent: "prospect" | "pro",
  isSignedIn: boolean,
  role: Role | null,
): string {
  if (!isSignedIn) {
    return intent === "prospect" ? "/inscription/prospect" : "/inscription/pro";
  }
  // Si l'utilisateur connecté clique le CTA correspondant à son rôle, on
  // l'envoie sur son espace. S'il clique l'autre rôle (cas théorique :
  // CTA pas masqué), on l'envoie quand même vers /{role} et le trigger
  // BDD déclenchera un RoleConflictError → redirect / + toast.
  if (role === intent) return intent === "prospect" ? "/prospect" : "/pro";
  return intent === "prospect" ? "/prospect" : "/pro";
}

export default function PrototypeFrame({
  route,
  tab,
}: {
  route: "auth" | "prospect" | "pro" | "waitlist";
  tab?: string | null;
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn, user } = useUser();

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
        const r = data.route;
        if (!r) return;

        if (r === "prospect" || r === "pro") {
          const role = ((user?.publicMetadata as { role?: Role } | undefined)?.role) ?? null;
          const target = resolveRoleRoute(r, !!isSignedIn, role);
          router.push(target);
          return;
        }

        const staticTarget = STATIC_ROUTES[r];
        if (!staticTarget) return;
        if (staticTarget === "/liste-attente") {
          try { sessionStorage.setItem("bupp:waitlist-ok", "1"); } catch {}
        }
        router.push(staticTarget);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router, signOut, isSignedIn, user]);

  const hash = tab ? `${route}?tab=${encodeURIComponent(tab)}` : route;
  const [cacheBust, setCacheBust] = useState<number | null>(null);
  useEffect(() => {
    setCacheBust(Date.now());
  }, []);

  const baseSrc = `/prototype/shell.html#${hash}`;
  const src = cacheBust ? `/prototype/shell.html?v=${cacheBust}#${hash}` : baseSrc;

  return (
    <iframe
      key={cacheBust ?? "ssr"}
      src={src}
      title={`BUUPP — ${route}`}
      style={{
        position: "fixed", inset: 0, width: "100%", height: "100%",
        border: 0, display: "block", background: "#F7F4EC",
      }}
    />
  );
}
```

- [ ] **Step 10.2: Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur.

- [ ] **Step 10.3: Commit**

```bash
git add app/_components/PrototypeFrame.tsx
git commit -m "feat(prototype-frame): CTAs Landing routent vers /inscription/{role} si non connecté"
```

---

## Task 11 — Smoke tests manuels & vérification finale

**Files:** Aucun (vérification produit).

- [ ] **Step 11.1: Démarrer le dev server**

```bash
npm run dev
```

Attendre que la home charge à `http://localhost:3000`.

- [ ] **Step 11.2: Smoke test "non connecté"**

1. Ouvrir `http://localhost:3000` en navigation privée (pas de session Clerk).
2. Vérifier la nav du bas : `[Accueil, Liste d'attente, Connexion]`. Pas de Prospect ni Pro.
3. Aller sur `/liste-attente` directement (URL) → la nav doit montrer les mêmes 3 onglets, "Liste d'attente" actif.
4. Cliquer "Je suis prospect" sur la home (Landing CTA) → doit arriver sur `/inscription/prospect`.
5. Faire back, cliquer "Je suis professionnel" → doit arriver sur `/inscription/pro`.
6. `/inscription` (URL directe) → doit montrer la page d'aiguillage avec deux cartes.

Expected: tous les checks passent.

- [ ] **Step 11.3: Smoke test "inscription prospect"**

1. Sur `/inscription/prospect`, créer un compte avec un email jetable (ex. `prospect.test+1@buupp.local`).
2. Compléter la vérification email (Clerk dev mode → code dans la console serveur).
3. Doit atterrir sur `/prospect`.
4. Vérifier la nav : `[Accueil, Liste d'attente, Prospect, Déconnexion]`.
5. Vérifier en SQL : `select clerk_user_id from prospects order by created_at desc limit 1;` → ligne présente. `select count(*) from pro_accounts where clerk_user_id = '<ce userId>';` → 0.
6. Vérifier dans le dashboard Clerk : `publicMetadata.role === "prospect"`.

Expected: tous les checks passent.

- [ ] **Step 11.4: Smoke test "inscription pro"**

1. Logout via le bouton "Déconnexion" → retour `/`, nav repasse à 3 onglets.
2. `/inscription/pro`, créer un compte avec un email différent (ex. `pro.test+1@buupp.local`).
3. Compléter la vérification email.
4. Doit atterrir sur `/pro`.
5. Vérifier la nav : `[Accueil, Liste d'attente, Pro, Déconnexion]`.
6. Vérifier en SQL : ligne dans `pro_accounts`, rien dans `prospects` pour ce userId.
7. Vérifier dans le dashboard Clerk : `publicMetadata.role === "pro"`.

Expected: tous les checks passent.

- [ ] **Step 11.5: Smoke test "conflit de rôle simulé"**

Pour reproduire un conflit (post-purge ce cas n'existera plus, mais on teste le filet) :

1. Connecté comme le prospect créé au step 11.3, ouvrir directement l'URL `/pro`.
2. Doit déclencher : `ensureRole("pro")` → trigger 23505 → `RoleConflictError` → cookie `role_conflict=prospect` → redirect `/`.
3. Sur `/`, le toast d'avertissement doit s'afficher : *"Cette adresse email est déjà associée à un compte prospect..."*.
4. Reload `/` → le toast ne doit pas réapparaître (cookie consommé).

Expected: tous les checks passent.

- [ ] **Step 11.6: Smoke test "connexion existante"**

1. Logout. Aller sur `/connexion`.
2. Se connecter avec le compte prospect.test → doit redirect vers `/prospect`.
3. Logout. Se connecter avec pro.test → doit redirect vers `/pro`.

Expected: redirections correctes.

- [ ] **Step 11.7: Vérification finale build + lint**

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Expected: pas d'erreur, pas de warning bloquant. Les 3 nouvelles routes (`/inscription`, `/inscription/prospect`, `/inscription/pro`) apparaissent dans le résumé de build.

- [ ] **Step 11.8: Cleanup des comptes de test**

```sql
-- À adapter avec les vrais userId vus dans la DB
delete from prospects where clerk_user_id in (
  select clerk_user_id from prospect_identity
  where email in ('prospect.test+1@buupp.local')
);
delete from pro_accounts where clerk_user_id in (
  -- Récupérer manuellement le userId pro.test depuis le dashboard Clerk
  '<USER_ID_PRO_TEST>'
);
```

Et supprimer les users côté dashboard Clerk.

- [ ] **Step 11.9: Pas de commit nécessaire** — c'est une étape de validation manuelle. Si un bug est détecté, créer un commit de fix sur la tâche concernée.

---

## Self-review

**Spec coverage** :
- ✅ Trigger DB d'exclusivité → Task 1
- ✅ Helper `ensureRole` avec `RoleConflictError` → Task 2
- ✅ Webhook `user.created` no-op → Task 3
- ✅ `/api/me` simplification + resync → Task 4
- ✅ `ensureRole` dans /prospect et /pro pages → Task 5
- ✅ Split `/inscription` (aiguillage + prospect + pro) → Task 6
- ✅ `/auth/post-login` → Task 7
- ✅ `RouteNav` adaptatif client (publique / prospect / pro) → Task 8
- ✅ Toast `role_conflict` sur la home → Task 9
- ✅ CTAs Landing routent selon auth → Task 10
- ✅ Smoke tests E2E (steps 11.2 → 11.6) → Task 11
- ✅ Vérification migration SQL via cas A/B → Step 1.3

**Hors-scope conservé** : pas de `/auth/role-choice` (purge planifiée), pas de framework de test (aligné sur le projet), pas de masquage du CTA opposé sur la home (drop volontaire — le filet conflict-toast suffit).

**Type consistency** : `Role`, `RoleConflictError`, `TabId` cohérents entre tasks 2/4/5/7/8/10. Cookie name `role_conflict` cohérent entre tasks 5 et 9. `publicMetadata.role` cohérent partout.
