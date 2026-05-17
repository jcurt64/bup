# Simplification Auth Clerk — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer la page d'aiguillage `/inscription`, exposer des points d'entrée auth porteurs d'un `intent` explicite, et rendre le routage post-auth intent-authoritative avec une bannière de conflit affichée dans la fenêtre Clerk.

**Architecture :** Une fonction pure de décision (`lib/auth/postAuth.ts`) testée unitairement pilote `/auth/post-login`. Les pages Clerk (`/connexion`, `/inscription/{prospect,pro}`) lisent un param `conflict` et affichent `<AuthConflictBanner>` au lieu du widget quand l'utilisateur est déjà authentifié sur le mauvais rôle. La home porte des `intent` explicites sur chaque CTA.

**Tech Stack :** Next.js 16 (App Router, `proxy.ts`), Clerk v7, Supabase, Vitest.

---

## File Structure

- **Create** `lib/auth/postAuth.ts` — logique pure : `resolvePostAuth`, `buildConflictUrl`, `parseRole`, `parseMode`.
- **Create** `tests/lib/auth/postAuth.test.ts` — tests unitaires de la logique pure.
- **Create** `app/_components/AuthConflictBanner.tsx` — bannière de conflit (client, `useClerk` pour signOut).
- **Modify** `app/auth/post-login/page.tsx` — réécriture intent-authoritative.
- **Modify** `app/connexion/[[...sign-in]]/page.tsx` — param `conflict`, `mode=signin`, `signUpUrl` rôle-aware.
- **Modify** `app/inscription/prospect/[[...sign-up]]/page.tsx` — param `conflict`, `mode=signup`.
- **Modify** `app/inscription/pro/[[...sign-up]]/page.tsx` — param `conflict`, `mode=signup`.
- **Delete** `app/inscription/page.tsx` — aiguillage 2 cartes supprimé.
- **Modify** `app/_components/HomeClient.tsx` — header 2 boutons, hero → connexion, Pricing + flash-deal recâblés.
- **Modify** `.env.example` et `.env.local` — `NEXT_PUBLIC_CLERK_SIGN_UP_URL` ne doit plus pointer la page supprimée.

---

### Task 1 : Logique pure post-auth + tests

**Files:**
- Create: `lib/auth/postAuth.ts`
- Test: `tests/lib/auth/postAuth.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Fichier `tests/lib/auth/postAuth.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  resolvePostAuth,
  buildConflictUrl,
  parseRole,
  parseMode,
} from "@/lib/auth/postAuth";

describe("resolvePostAuth", () => {
  it("role null → ensure (création différée)", () => {
    expect(resolvePostAuth({ intent: "pro", role: null })).toEqual({
      kind: "ensure",
      intent: "pro",
    });
  });

  it("role == intent → go", () => {
    expect(resolvePostAuth({ intent: "prospect", role: "prospect" })).toEqual({
      kind: "go",
      intent: "prospect",
    });
  });

  it("role != intent → conflict avec le rôle existant", () => {
    expect(resolvePostAuth({ intent: "pro", role: "prospect" })).toEqual({
      kind: "conflict",
      intent: "pro",
      existingRole: "prospect",
    });
  });
});

describe("buildConflictUrl", () => {
  it("signup → page d'inscription de l'intent + ?conflict", () => {
    expect(
      buildConflictUrl({ intent: "pro", mode: "signup", existingRole: "prospect" }),
    ).toBe("/inscription/pro?conflict=prospect");
  });

  it("signin → /connexion avec intent + conflict", () => {
    expect(
      buildConflictUrl({ intent: "prospect", mode: "signin", existingRole: "pro" }),
    ).toBe("/connexion?intent=prospect&conflict=pro");
  });
});

describe("parseRole", () => {
  it("accepte prospect / pro", () => {
    expect(parseRole("pro")).toBe("pro");
    expect(parseRole("prospect")).toBe("prospect");
  });
  it("prend le 1er élément d'un tableau", () => {
    expect(parseRole(["prospect", "pro"])).toBe("prospect");
  });
  it("rejette le reste → null", () => {
    expect(parseRole("admin")).toBeNull();
    expect(parseRole(undefined)).toBeNull();
  });
});

describe("parseMode", () => {
  it("signup explicite", () => {
    expect(parseMode("signup")).toBe("signup");
  });
  it("défaut = signin (filet sûr → renvoie vers connexion)", () => {
    expect(parseMode(undefined)).toBe("signin");
    expect(parseMode("nimporte")).toBe("signin");
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npx vitest run tests/lib/auth/postAuth.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth/postAuth'`.

- [ ] **Step 3 : Implémenter le module**

Fichier `lib/auth/postAuth.ts` :

```ts
/**
 * Logique pure du routage post-authentification. Aucune I/O ici :
 * `/auth/post-login` orchestre les effets (auth, DB, ensureRole) et
 * délègue la DÉCISION à `resolvePostAuth`. L'intention du bouton fait
 * foi — jamais le rôle DB.
 */
import type { Role } from "@/lib/sync/ensureRole";

export type AuthMode = "signin" | "signup";

export type PostAuthDecision =
  | { kind: "go"; intent: Role }
  | { kind: "ensure"; intent: Role }
  | { kind: "conflict"; intent: Role; existingRole: Role };

export function resolvePostAuth(args: {
  intent: Role;
  role: Role | null;
}): PostAuthDecision {
  const { intent, role } = args;
  if (role === null) return { kind: "ensure", intent };
  if (role === intent) return { kind: "go", intent };
  return { kind: "conflict", intent, existingRole: role };
}

export function buildConflictUrl(args: {
  intent: Role;
  mode: AuthMode;
  existingRole: Role;
}): string {
  const { intent, mode, existingRole } = args;
  if (mode === "signup") {
    return `/inscription/${intent}?conflict=${existingRole}`;
  }
  return `/connexion?intent=${intent}&conflict=${existingRole}`;
}

export function parseRole(
  raw: string | string[] | undefined,
): Role | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "prospect" || v === "pro") return v;
  return null;
}

export function parseMode(raw: string | string[] | undefined): AuthMode {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "signup" ? "signup" : "signin";
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npx vitest run tests/lib/auth/postAuth.test.ts`
Expected: PASS (13 assertions).

- [ ] **Step 5 : Commit**

```bash
git add lib/auth/postAuth.ts tests/lib/auth/postAuth.test.ts
git commit -m "feat(auth): logique pure de routage post-auth intent-authoritative

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2 : Réécriture de `/auth/post-login`

**Files:**
- Modify: `app/auth/post-login/page.tsx` (remplacement intégral du corps)

- [ ] **Step 1 : Remplacer le contenu du fichier**

Remplacer **tout** le contenu de `app/auth/post-login/page.tsx` par :

```tsx
/**
 * Aiguillage post-authentification — INTENT-AUTHORITATIVE.
 *
 * L'intention du bouton (query `?intent=` puis fallback cookie
 * `bupp_auth_intent`) fait foi. On ne route JAMAIS vers l'espace
 * opposé : si le compte existant contredit l'intent, on renvoie sur
 * la fenêtre Clerk correspondante avec `?conflict=<roleExistant>`
 * pour afficher la bannière.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth, currentUser } from "@/lib/clerk/server";
import { getCurrentRole } from "@/lib/sync/currentRole";
import { ensureRole, RoleConflictError } from "@/lib/sync/ensureRole";
import type { Role } from "@/lib/sync/ensureRole";
import { safeRedirect } from "@/lib/auth/safeRedirect";
import {
  resolvePostAuth,
  buildConflictUrl,
  parseRole,
  parseMode,
} from "@/lib/auth/postAuth";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: "noindex",
  title: "BUUPP — Redirection",
};

type SearchParams = Promise<{
  intent?: string | string[];
  mode?: string | string[];
  redirect_url?: string | string[];
}>;

export default async function PostLoginPage(props: {
  searchParams: SearchParams;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/connexion");

  const sp = await props.searchParams;
  const explicitTarget = safeRedirect(sp.redirect_url);
  const mode = parseMode(sp.mode);
  const intent: Role | null =
    parseRole(sp.intent) ??
    parseRole((await cookies()).get("bupp_auth_intent")?.value);

  // Pas d'intent exploitable (hors parcours bouton — ne devrait pas
  // arriver via l'UI). On lit le rôle DB et on route au mieux.
  if (!intent) {
    let fallbackRole: Role | null = null;
    try {
      fallbackRole = await getCurrentRole(userId);
    } catch (err) {
      console.error("[/auth/post-login] getCurrentRole failed", err);
    }
    if (fallbackRole === "pro") redirect("/pro");
    if (fallbackRole === "prospect") redirect("/prospect");
    redirect("/connexion");
  }

  let role: Role | null = null;
  try {
    role = await getCurrentRole(userId);
  } catch (err) {
    console.error("[/auth/post-login] getCurrentRole failed", err);
    redirect(`/connexion?intent=${intent}`);
  }

  const decision = resolvePostAuth({ intent, role });

  if (decision.kind === "conflict") {
    redirect(
      buildConflictUrl({ intent, mode, existingRole: decision.existingRole }),
    );
  }

  if (decision.kind === "ensure") {
    const user = await currentUser();
    const primary = user?.emailAddresses?.find(
      (e) => e.id === user.primaryEmailAddressId,
    );
    try {
      await ensureRole(userId, primary?.emailAddress ?? null, intent, {
        prenom: user?.firstName ?? null,
        nom: user?.lastName ?? null,
      });
    } catch (err) {
      if (err instanceof RoleConflictError) {
        redirect(
          buildConflictUrl({ intent, mode, existingRole: err.existingRole }),
        );
      }
      throw err;
    }
  }

  redirect(explicitTarget ?? `/${intent}`);
}
```

- [ ] **Step 2 : Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur liée à `app/auth/post-login/page.tsx` (les `redirect()` ont le type `never`, donc `intent` est bien narrow en `Role` après le bloc `if (!intent)`).

- [ ] **Step 3 : Commit**

```bash
git add app/auth/post-login/page.tsx
git commit -m "feat(auth): post-login intent-authoritative + bannière de conflit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3 : Composant `AuthConflictBanner`

**Files:**
- Create: `app/_components/AuthConflictBanner.tsx`

- [ ] **Step 1 : Créer le composant**

Fichier `app/_components/AuthConflictBanner.tsx` :

```tsx
"use client";

/**
 * Bannière affichée à la place du widget Clerk quand l'utilisateur
 * vient de s'authentifier mais que son compte est d'un rôle opposé à
 * l'intent du bouton. Mêmes largeur / rayon / ombre que la carte
 * Clerk → perçue comme faisant partie de la fenêtre d'auth.
 *
 * L'utilisateur est ICI déjà authentifié (le conflit n'est
 * déterminable qu'après auth) : on ne ré-affiche pas de formulaire,
 * on propose deux issues — rejoindre son espace réel, ou se
 * déconnecter pour utiliser une autre adresse.
 */
import Link from "next/link";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import type { Role } from "@/lib/sync/ensureRole";

const LABEL: Record<Role, string> = {
  pro: "professionnel",
  prospect: "particulier",
};

export default function AuthConflictBanner({
  existingRole,
  intent,
}: {
  existingRole: Role;
  intent: Role;
}) {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);

  const useAnother = async () => {
    setBusy(true);
    try {
      await signOut({ redirectUrl: `/connexion?intent=${intent}` });
    } catch (err) {
      console.error("[AuthConflictBanner] signOut failed", err);
      setBusy(false);
    }
  };

  return (
    <div
      role="alert"
      style={{
        width: "100%",
        maxWidth: 440,
        background: "var(--paper, #FFFEF8)",
        color: "var(--ink, #0F1629)",
        border: "1px solid var(--line, #EAE3D0)",
        borderRadius: 16,
        boxShadow: "0 18px 48px -16px rgba(15, 22, 41, .18)",
        padding: "28px 26px 24px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#B45309",
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        Adresse déjà utilisée
      </div>
      <h2
        style={{
          fontSize: 21,
          lineHeight: 1.25,
          margin: "0 0 12px",
          fontWeight: 500,
          fontFamily: "var(--font-fraunces, Georgia, serif)",
        }}
      >
        Cette adresse e-mail est déjà associée à un compte{" "}
        <em style={{ color: "#7C3AED" }}>{LABEL[existingRole]}</em>.
      </h2>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: "#3A4150",
          margin: "0 0 22px",
        }}
      >
        Vous ne pouvez pas l&apos;utiliser pour un compte{" "}
        {LABEL[intent]}. Une adresse e-mail = un seul compte.
      </p>

      <Link
        href={`/${existingRole}`}
        style={{
          display: "block",
          textAlign: "center",
          background: "var(--ink, #0F1629)",
          color: "#fff",
          padding: "12px 16px",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        Accéder à mon espace {LABEL[existingRole]}
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={useAnother}
        style={{
          width: "100%",
          background: "transparent",
          color: "#5b6478",
          border: "1px solid var(--line, #EAE3D0)",
          padding: "11px 16px",
          borderRadius: 10,
          fontWeight: 500,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Déconnexion…" : "Utiliser une autre adresse"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2 : Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur liée à `AuthConflictBanner.tsx`.

- [ ] **Step 3 : Commit**

```bash
git add app/_components/AuthConflictBanner.tsx
git commit -m "feat(auth): composant AuthConflictBanner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 : Page `/connexion` — conflict + mode signin + signUpUrl rôle-aware

**Files:**
- Modify: `app/connexion/[[...sign-in]]/page.tsx`

- [ ] **Step 1 : Mettre à jour les imports**

Remplacer le bloc d'imports en tête de fichier :

```tsx
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { safeRedirect } from "@/lib/auth/safeRedirect";
import { auth } from "@/lib/clerk/server";
```

par :

```tsx
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { safeRedirect } from "@/lib/auth/safeRedirect";
import { auth } from "@/lib/clerk/server";
import { parseRole } from "@/lib/auth/postAuth";
import AuthConflictBanner from "@/app/_components/AuthConflictBanner";
```

- [ ] **Step 2 : Étendre le type `SearchParams`**

Remplacer :

```tsx
type SearchParams = Promise<{
  redirect_url?: string | string[];
  intent?: string | string[];
}>;
```

par :

```tsx
type SearchParams = Promise<{
  redirect_url?: string | string[];
  intent?: string | string[];
  conflict?: string | string[];
}>;
```

- [ ] **Step 3 : Recâbler la logique de la page**

Remplacer le corps actuel :

```tsx
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  const intent = parseIntent(sp.intent);
  const postLoginUrl = intent
    ? `/auth/post-login?intent=${intent}`
    : "/auth/post-login";

  const { userId } = await auth();
  if (userId) {
    redirect(target ?? postLoginUrl);
  }
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
      <SignIn
        path="/connexion"
        routing="path"
        signUpUrl="/inscription"
```

par :

```tsx
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  const intent = parseIntent(sp.intent);
  const conflict = parseRole(sp.conflict);
  const postLoginUrl = intent
    ? `/auth/post-login?intent=${intent}&mode=signin`
    : "/auth/post-login?mode=signin";

  const { userId } = await auth();
  // Conflit présent : l'utilisateur est déjà authentifié sur le
  // mauvais rôle → on NE redirige PAS vers post-login (boucle) et on
  // affiche la bannière à la place du widget.
  if (userId && !conflict) {
    redirect(target ?? postLoginUrl);
  }
  if (conflict) {
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
        <AuthConflictBanner
          existingRole={conflict}
          intent={intent ?? (conflict === "pro" ? "prospect" : "pro")}
        />
      </main>
    );
  }
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
      <SignIn
        path="/connexion"
        routing="path"
        signUpUrl={`/inscription/${intent ?? "prospect"}`}
```

- [ ] **Step 4 : Mettre à jour `forceRedirectUrl`**

Dans le même fichier, le commentaire et la prop restent ; aucune autre modification n'est nécessaire car `postLoginUrl` porte déjà `&mode=signin` (étape 3). Vérifier que la ligne reste :

```tsx
        forceRedirectUrl={target ?? postLoginUrl}
```

- [ ] **Step 5 : Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur liée à `app/connexion/[[...sign-in]]/page.tsx`.

- [ ] **Step 6 : Commit**

```bash
git add app/connexion/
git commit -m "feat(auth): /connexion gère conflict + mode=signin + signUpUrl rôle-aware

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : Pages `/inscription/{prospect,pro}` — conflict + mode signup

**Files:**
- Modify: `app/inscription/prospect/[[...sign-up]]/page.tsx`
- Modify: `app/inscription/pro/[[...sign-up]]/page.tsx`

- [ ] **Step 1 : `/inscription/prospect` — imports + type**

Après la ligne `import { auth } from "@/lib/clerk/server";`, ajouter :

```tsx
import { parseRole } from "@/lib/auth/postAuth";
import AuthConflictBanner from "@/app/_components/AuthConflictBanner";
```

Remplacer :

```tsx
type SearchParams = Promise<{ redirect_url?: string | string[] }>;
```

par :

```tsx
type SearchParams = Promise<{
  redirect_url?: string | string[];
  conflict?: string | string[];
}>;
```

- [ ] **Step 2 : `/inscription/prospect` — logique**

Remplacer :

```tsx
  const { userId } = await auth();
  if (userId) {
    redirect("/auth/post-login?intent=prospect");
  }

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
```

par :

```tsx
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  const conflict = parseRole(sp.conflict);

  const { userId } = await auth();
  if (userId && !conflict) {
    redirect("/auth/post-login?intent=prospect&mode=signup");
  }
  if (conflict) {
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
        <AuthConflictBanner existingRole={conflict} intent="prospect" />
      </main>
    );
  }
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
```

- [ ] **Step 3 : `/inscription/prospect` — forceRedirectUrl**

Remplacer :

```tsx
        forceRedirectUrl={target ?? "/auth/post-login?intent=prospect"}
```

par :

```tsx
        forceRedirectUrl={target ?? "/auth/post-login?intent=prospect&mode=signup"}
```

- [ ] **Step 4 : `/inscription/pro` — appliquer les mêmes 3 modifications**

Dans `app/inscription/pro/[[...sign-up]]/page.tsx` :

Ajouter après `import { auth } from "@/lib/clerk/server";` :

```tsx
import { parseRole } from "@/lib/auth/postAuth";
import AuthConflictBanner from "@/app/_components/AuthConflictBanner";
```

Remplacer `type SearchParams = Promise<{ redirect_url?: string | string[] }>;` par :

```tsx
type SearchParams = Promise<{
  redirect_url?: string | string[];
  conflict?: string | string[];
}>;
```

Remplacer :

```tsx
  const { userId } = await auth();
  if (userId) {
    redirect("/auth/post-login?intent=pro");
  }

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
```

par :

```tsx
  const sp = await props.searchParams;
  const target = safeRedirect(sp.redirect_url);
  const conflict = parseRole(sp.conflict);

  const { userId } = await auth();
  if (userId && !conflict) {
    redirect("/auth/post-login?intent=pro&mode=signup");
  }
  if (conflict) {
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
        <AuthConflictBanner existingRole={conflict} intent="pro" />
      </main>
    );
  }
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
```

Remplacer :

```tsx
        forceRedirectUrl={target ?? "/auth/post-login?intent=pro"}
```

par :

```tsx
        forceRedirectUrl={target ?? "/auth/post-login?intent=pro&mode=signup"}
```

- [ ] **Step 5 : Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur liée aux deux pages d'inscription.

- [ ] **Step 6 : Commit**

```bash
git add app/inscription/prospect/ app/inscription/pro/
git commit -m "feat(auth): /inscription/{prospect,pro} gèrent conflict + mode=signup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6 : Suppression de `/inscription` + recâblage des références

**Files:**
- Delete: `app/inscription/page.tsx`
- Modify: `app/_components/HomeClient.tsx` (Pricing + flash-deal)
- Modify: `.env.example`
- Modify: `.env.local`

- [ ] **Step 1 : Supprimer la page d'aiguillage**

```bash
git rm app/inscription/page.tsx
```

- [ ] **Step 2 : Recâbler `goToProOrSignup` (Pricing)**

Dans `app/_components/HomeClient.tsx`, dans la fonction `goToProOrSignup`, remplacer la ligne :

```tsx
    router.push("/inscription");
```

par :

```tsx
    router.push("/inscription/pro");
```

- [ ] **Step 3 : Recâbler `goAuth` (modale flash-deal)**

Dans `app/_components/HomeClient.tsx`, remplacer :

```tsx
            router.push(
              `/inscription?redirect_url=${encodeURIComponent(redirect)}`,
            );
```

par :

```tsx
            router.push(
              `/inscription/prospect?redirect_url=${encodeURIComponent(redirect)}`,
            );
```

- [ ] **Step 4 : Corriger l'env Clerk (page supprimée)**

Dans `.env.example` ET `.env.local`, remplacer la ligne :

```
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/inscription
```

par :

```
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/inscription/prospect
```

(La page `/inscription` n'existe plus ; ce défaut global Clerk doit pointer une route valide. Les CTA explicites portent leur propre intent, ce défaut ne sert que de filet.)

- [ ] **Step 5 : Vérifier qu'aucune référence à `/inscription` nu ne subsiste**

Run:
```bash
grep -rn '"/inscription"\|`/inscription?\|/inscription?redirect\|push("/inscription")\|go("/inscription")' app lib --include="*.tsx" --include="*.ts"
```
Expected: aucune ligne (toutes les occurrences pointent désormais `/inscription/prospect` ou `/inscription/pro`).

- [ ] **Step 6 : Build**

Run: `npm run build`
Expected: build OK, aucune route morte vers `/inscription`.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "feat(auth): suppression page /inscription + recâblage références

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7 : Header — deux boutons d'inscription

**Files:**
- Modify: `app/_components/HomeClient.tsx` (header desktop + drawer mobile)

- [ ] **Step 1 : Header desktop — remplacer le bouton unique**

Dans `app/_components/HomeClient.tsx`, remplacer le bloc :

```tsx
            ) : (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => router.push("/inscription")}
              >
                Démarrer <Icon name="arrow" size={14} />
              </button>
            )}
          </div>
```

par :

```tsx
            ) : (
              <>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => router.push("/inscription/prospect")}
                >
                  S&apos;inscrire en tant que prospect
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => router.push("/inscription/pro")}
                >
                  S&apos;inscrire en tant que pro{" "}
                  <Icon name="arrow" size={14} />
                </button>
              </>
            )}
          </div>
```

- [ ] **Step 2 : Drawer mobile — remplacer le bouton unique**

Dans le même fichier, remplacer le bloc :

```tsx
            ) : (
              <button
                className="btn btn-lg btn-primary"
                style={{ justifyContent: "center" }}
                onClick={() => go("/inscription")}
              >
                Démarrer <Icon name="arrow" size={14} />
              </button>
            )}
          </div>
```

par :

```tsx
            ) : (
              <>
                <button
                  className="btn btn-lg btn-ghost"
                  style={{ justifyContent: "center" }}
                  onClick={() => go("/inscription/prospect")}
                >
                  S&apos;inscrire en tant que prospect
                </button>
                <button
                  className="btn btn-lg btn-primary"
                  style={{ justifyContent: "center" }}
                  onClick={() => go("/inscription/pro")}
                >
                  S&apos;inscrire en tant que pro{" "}
                  <Icon name="arrow" size={14} />
                </button>
              </>
            )}
          </div>
```

- [ ] **Step 3 : Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4 : Commit**

```bash
git add app/_components/HomeClient.tsx
git commit -m "feat(home): header 2 boutons d'inscription prospect/pro

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8 : Hero — boutons « Je suis prospect/pro » → connexion

**Files:**
- Modify: `app/_components/HomeClient.tsx` (composant `Hero`)

- [ ] **Step 1 : Recâbler les deux boutons hero**

Dans `app/_components/HomeClient.tsx`, remplacer le bloc :

```tsx
            <button
              className="btn btn-lg btn-block-mobile"
              onClick={() => guard("prospect", "/prospect")}
              style={{ background: "var(--paper)", color: "var(--ink)" }}
            >
              Je suis prospect <Icon name="arrow" size={16} />
            </button>
            <button
              className="btn btn-lg btn-ghost btn-block-mobile"
              onClick={() => guard("pro", "/pro")}
              style={{
                color: "var(--paper)",
                borderColor: "rgba(255,255,255,.28)",
              }}
            >
              Je suis professionnel
            </button>
```

par :

```tsx
            <button
              className="btn btn-lg btn-block-mobile"
              onClick={() =>
                guard(
                  "prospect",
                  "/prospect",
                  "/connexion?intent=prospect&mode=signin",
                )
              }
              style={{ background: "var(--paper)", color: "var(--ink)" }}
            >
              Je suis prospect <Icon name="arrow" size={16} />
            </button>
            <button
              className="btn btn-lg btn-ghost btn-block-mobile"
              onClick={() =>
                guard("pro", "/pro", "/connexion?intent=pro&mode=signin")
              }
              style={{
                color: "var(--paper)",
                borderColor: "rgba(255,255,255,.28)",
              }}
            >
              Je suis professionnel
            </button>
```

(Rappel : `guard(targetRole, intendedHref, anonymousHref)` — anonyme → `anonymousHref` (fenêtre Clerk connexion avec intent) ; connecté + rôle compatible → `intendedHref` ; connecté + rôle incompatible → `RoleSwitchModal` conservé.)

- [ ] **Step 2 : Build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3 : Commit**

```bash
git add app/_components/HomeClient.tsx
git commit -m "feat(home): hero 'Je suis prospect/pro' → connexion Clerk avec intent

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9 : Vérification end-to-end

**Files:** aucun (vérification)

- [ ] **Step 1 : Suite de tests complète**

Run: `npm run test`
Expected: tous les tests passent, dont `tests/lib/auth/postAuth.test.ts`.

- [ ] **Step 2 : Build + lint**

Run: `npm run build && npm run lint`
Expected: build OK, lint sans erreur.

- [ ] **Step 3 : Vérification manuelle (matrice)**

Lancer `npm run dev`. Pour chaque combinaison, vérifier que **l'atterrissage ne tombe jamais sur l'espace opposé** et que la bannière s'affiche au bon endroit :

| Entrée | Email | Attendu |
|---|---|---|
| Header « S'inscrire prospect » | nouveau | inscription Clerk → `/prospect` |
| Header « S'inscrire pro » | nouveau | inscription Clerk → `/pro` |
| Header « S'inscrire pro » | email déjà compte prospect | après auth → `/inscription/pro?conflict=prospect`, bannière « déjà associée à un compte particulier », **jamais** `/prospect` |
| Hero « Je suis prospect » (anon) | compte prospect | connexion Clerk → `/prospect` |
| Hero « Je suis prospect » (anon) | compte pro | après auth → `/connexion?intent=prospect&conflict=pro`, bannière, **jamais** `/prospect`→pro |
| Hero « Je suis pro » (anon) | compte prospect | après auth → bannière conflit, **jamais** `/prospect` |
| « Ouvrir un compte pro » (anon) | nouveau | `/inscription/pro` → `/pro` |
| Pricing « Démarrer en Starter » (anon) | nouveau | `/inscription/pro` → `/pro` |
| Flash-deal (anon) | nouveau | `/inscription/prospect` → retour `/?deal=…` |
| Hero « Je suis pro », connecté en prospect | — | `RoleSwitchModal` (déconnexion/reconnexion), pas de navigation vers `/pro` |
| Lien bannière « Accéder à mon espace » | — | mène à l'espace réel du compte |
| Bouton bannière « Utiliser une autre adresse » | — | signOut → `/connexion?intent=…` |

- [ ] **Step 4 : Vérifier l'absence de boucle de redirection**

Sur le cas conflit (`/connexion?intent=prospect&conflict=pro` en étant connecté pro) : la page doit afficher la bannière **sans** rebondir vers `/auth/post-login` (pas de boucle réseau dans l'onglet Network).

- [ ] **Step 5 : Commit final éventuel**

Si des ajustements ont été nécessaires :

```bash
git add -A
git commit -m "fix(auth): ajustements post-vérification flux Clerk

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Notes d'implémentation

- **Pas de boucle de redirection** : le garde « signed-in → post-login » de `/connexion` et `/inscription/{role}` est désormais conditionné par `!conflict`. Quand `conflict` est présent l'utilisateur est déjà authentifié sur le mauvais rôle ; on rend la bannière au lieu de rediriger.
- **`proxy.ts` inchangé** : la garde de rôle middleware reste un filet pour les accès URL directs sans intent (le toast home y est acceptable, hors parcours bouton). Le cookie `bupp_auth_intent` continue d'être posé par les sous-pages d'inscription.
- **Trigger Postgres / webhook / `safeRedirect` / `RoleSwitchModal`** : non modifiés.
- **« Ouvrir un compte pro » et FinalCTA** : déjà câblés avec `anonymousHref` correct (`/inscription/pro`, `/inscription/prospect`) — aucune modification requise, leur routage post-auth est désormais intent-authoritative via Task 2.
