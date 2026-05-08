# Exclusivité des rôles prospect / pro & nav adaptative

**Date** : 2026-05-08
**Branche cible** : `feat/founders-program` (ou nouvelle branche `feat/role-exclusivity`)

## Contexte

Aujourd'hui, l'architecture du site permet à un même utilisateur Clerk d'avoir
simultanément un profil `prospects` ET un profil `pro_accounts` (commentaire
explicite dans `app/api/me/route.ts:49` — *"on accepte qu'un même userId ait
les deux profils"*). La barre de navigation du bas (`app/_components/RouteNav.tsx`)
affiche en permanence les 5 onglets `[Accueil, Liste d'attente, Prospect, Pro,
Connexion]`, qu'on soit connecté ou non, prospect ou pro.

Le besoin produit est de :
1. Faire de la nav du bas une nav contextuelle (publique / prospect / pro).
2. Imposer une exclusivité stricte entre les deux rôles : une adresse mail =
   un seul compte (prospect XOR pro).

Comme tous les comptes existants seront purgés avant la mise en prod de cette
fonctionnalité, aucune migration de données n'est nécessaire.

## Invariant central

**Un utilisateur Clerk possède exactement zéro ou un rôle (`prospect` XOR `pro`).**

L'invariant est tenu à trois niveaux, du plus fort au plus laxiste :

| Niveau | Mécanisme | Quand ça déclenche |
|---|---|---|
| BDD | trigger `BEFORE INSERT` sur `prospects` et `pro_accounts` | Toute insertion, y compris SQL direct |
| Serveur | helper `ensureRole(userId, role)` (vérifie + insère + propage `publicMetadata.role`) | Sur la 1ère visite de `/prospect` ou `/pro` post-signup |
| Client | `RouteNav` adaptatif + middleware sur `/prospect` et `/pro` | Affichage / accès aux espaces |

Source de vérité du rôle :
- **DB** : la présence d'une row dans `prospects` ou `pro_accounts` (faisant foi).
- **Cache** : `Clerk.publicMetadata.role` (pour éviter un round-trip DB sur
  chaque rendu côté client).

## Règles de la nav du bas

| État | Onglets affichés |
|---|---|
| Non connecté | `[Accueil, Liste d'attente, Connexion]` |
| Connecté prospect | `[Accueil, Liste d'attente, Prospect, Déconnexion]` |
| Connecté pro | `[Accueil, Liste d'attente, Pro, Déconnexion]` |

L'onglet **Connexion** (publique) est remplacé par **Déconnexion** une fois
connecté, à la même position visuelle. La nav reste masquée sur `/connexion`
et sur tous les paths `/inscription/*`.

## Flux d'inscription

```
Page d'accueil (publique)
    ├── "Je suis prospect"  → /inscription/prospect (SignUp Clerk)
    │                              ↓ forceRedirectUrl
    │                        /prospect → ensureRole("prospect") → écran prospect
    └── "Je suis pro"       → /inscription/pro (SignUp Clerk)
                                   ↓ forceRedirectUrl
                              /pro → ensureRole("pro") → écran pro
```

## Backend

### Migration SQL — `20260508140000_role_exclusivity.sql`

```sql
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

Le code SQL `23505` (`unique_violation`) permet à la couche app de catcher
proprement et de renvoyer un `409 role_conflict`.

### Helper `lib/sync/ensureRole.ts` (nouveau)

Wrapper unique au-dessus de `ensureProspect` / `ensureProAccount`, à appeler
depuis les pages serveur `/prospect` et `/pro` :

```ts
import { ensureProspect } from "./prospects";
import { ensureProAccount } from "./pro-accounts";
import { clerkClient } from "@/lib/clerk/server";

export type Role = "prospect" | "pro";

export class RoleConflictError extends Error {
  constructor(public existingRole: Role) {
    super(`role_conflict:${existingRole}`);
  }
}

export async function ensureRole(
  userId: string,
  email: string | null,
  role: Role,
  identity?: {
    prenom?: string | null;
    nom?: string | null;
    raisonSociale?: string | null;
  }
): Promise<void> {
  try {
    if (role === "prospect") {
      await ensureProspect({
        clerkUserId: userId,
        email,
        prenom: identity?.prenom,
        nom: identity?.nom,
      });
    } else {
      await ensureProAccount({
        clerkUserId: userId,
        email,
        raisonSociale: identity?.raisonSociale,
      });
    }
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      const existing: Role = role === "prospect" ? "pro" : "prospect";
      throw new RoleConflictError(existing);
    }
    throw err;
  }

  // Cache rapide côté Clerk pour éviter un round-trip Supabase à chaque
  // rendu de RouteNav. La DB fait foi : si la propagation Clerk échoue,
  // on log mais on ne throw pas (publicMetadata sera resyncé au prochain
  // /api/me).
  try {
    const client = await clerkClient();
    await client.users.updateUser(userId, { publicMetadata: { role } });
  } catch (err) {
    console.error("[ensureRole] failed to update Clerk metadata", err);
  }
}
```

`isPgUniqueViolation` détecte un erreur Supabase/Postgres avec `code === "23505"`.

### Webhook Clerk — `app/api/clerk/webhook/route.ts`

Le case `user.created` **ne fait plus** d'`ensureProspect`. La création est
repoussée à la 1ère visite de `/prospect` (côté `ensureRole`).

Cas `user.updated` et `user.deleted` inchangés : `deleteProspect` reste
idempotent et efface les deux tables si nécessaire.

Raison : si on auto-crée un prospect sur `user.created`, et que la personne
s'était inscrite via `/inscription/pro`, le trigger refuse l'insertion
suivante côté pro → conflit dès l'arrivée sur `/pro`. Mieux vaut laisser
l'app décider du rôle.

### `/api/me` GET — simplification

Suppression du commentaire et de la logique tolérant le double rôle :

```ts
const role: Role | null = proRow ? "pro" : prospectRow ? "prospect" : null;
// hasProspectProfile / hasProProfile retirés du payload (mutuellement exclusifs)
```

Si `role === null` (cas signup interrompu avant `ensureRole`), le client
redirige vers `/inscription` (page d'aiguillage).

### Pages serveur `/prospect/page.tsx` et `/pro/page.tsx`

Avant le rendu de `<PrototypeFrame>`, appel server-side à `ensureRole`. En cas
de `RoleConflictError` :
- Pose un cookie flash `role_conflict=<existing-role>` (httpOnly, 60s).
- `redirect("/")`.
- La home (`app/page.tsx`) lit ce cookie et rend un toast d'avertissement.

## Frontend

### Structure `/inscription`

```
app/inscription/
  [[...sign-up]]/page.tsx               ← aiguillage "Vous êtes prospect ou pro ?"
  prospect/[[...sign-up]]/page.tsx      ← <SignUp> Clerk, forceRedirectUrl=/prospect
  pro/[[...sign-up]]/page.tsx           ← <SignUp> Clerk, forceRedirectUrl=/pro
```

- **`/inscription/[[...sign-up]]`** : page minimale avec deux gros boutons
  "Je suis prospect" / "Je suis pro". Sert de fallback pour qui arrive ici
  sans CTA explicite.
- **`/inscription/prospect/[[...sign-up]]`** : copie de la page actuelle, avec
  `path="/inscription/prospect"`, `forceRedirectUrl="/prospect"`.
- **`/inscription/pro/[[...sign-up]]`** : symétrique côté pro.

Le `safeRedirect(redirect_url)` côté query param est conservé sur les deux
sous-pages (utile pour les flash deals qui linkent vers
`/inscription/prospect?redirect_url=…`). Quand un `redirect_url` valide est
fourni, il prime sur le `forceRedirectUrl=/prospect|/pro`.

### `/connexion` — redirection post-login intelligente

Une seule page de connexion. Après login :

```ts
<SignIn fallbackRedirectUrl="/auth/post-login" ... />
```

`/auth/post-login` est une route serveur qui lit `publicMetadata.role` (avec
fallback DB si absent) et redirige :
- `role === "prospect"` → `/prospect`
- `role === "pro"` → `/pro`
- `role` absent → `/inscription` (aiguillage)

### `RouteNav.tsx` — version adaptative

Devient un client component qui lit `useUser()` et `useClerk()` de
`@clerk/nextjs`. Source de vérité (côté client) : `user.publicMetadata.role`.

```ts
"use client";
import { useUser, useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

const PUBLIC_TABS = ["accueil", "liste-attente", "connexion"];
const PROSPECT_TABS = ["accueil", "liste-attente", "prospect", "deconnexion"];
const PRO_TABS = ["accueil", "liste-attente", "pro", "deconnexion"];

export default function RouteNav() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  if (pathname === "/connexion" || pathname.startsWith("/inscription")) return null;
  if (!isLoaded) return null; // évite le flash 3-tabs → 4-tabs

  const role = isSignedIn ? (user?.publicMetadata?.role as Role | undefined) : null;
  const visible =
    role === "pro" ? PRO_TABS : role === "prospect" ? PROSPECT_TABS : PUBLIC_TABS;

  // rendu : map sur visible. L'item "deconnexion" est un <button> qui appelle
  // signOut({ redirectUrl: "/" }) ; les autres restent des <Link>.
}
```

Points d'attention :
- **Pas de flash** : on attend `isLoaded === true` avant de rendre. Compromis
  acceptable ; alternative future si gênant : déplacer la lecture du rôle
  dans `layout.tsx` server-side via `auth()` et passer en props.
- **Onglet Déconnexion** : rendu comme `<button>`, styles identiques aux
  autres pour cohérence visuelle.
- **Cache du rôle** : `publicMetadata.role` est dans le JWT Clerk → lecture
  instantanée côté client, pas de round-trip réseau.

### CTAs sur la home — `Landing.jsx`

Lignes 224 et 228, les boutons "Je suis prospect" / "Je suis professionnel"
pointent aujourd'hui vers `go('prospect')` (interne au prototype). Ils deviennent :

- **Non connecté** → liens vers `/inscription/prospect` ou `/inscription/pro`.
- **Connecté avec rôle** → le CTA correspondant au rôle de l'utilisateur
  route vers son espace (`/prospect` ou `/pro`). Le CTA de l'autre rôle est
  **masqué** (un user pro connecté ne voit plus "Je suis prospect" et
  inversement) puisque le rôle est exclusif et figé.

### Toast `role_conflict`

Quand `/prospect` ou `/pro` redirige vers `/` à cause d'un conflit (cas
théorique post-purge, mais on garde le filet), un cookie `role_conflict=<role>`
est posé. La home (`app/page.tsx`) le lit, le supprime (Set-Cookie expiré),
et rend un `<RoleConflictToast role={existing}>` côté client : *"Cet email est
déjà associé à un compte {prospect|pro}. Connectez-vous avec ce compte."*

## Fichiers touchés (résumé)

| Fichier | Action |
|---|---|
| `supabase/migrations/20260508140000_role_exclusivity.sql` | **Nouveau** (migration + trigger) |
| `lib/sync/ensureRole.ts` | **Nouveau** (helper unifié) |
| `app/api/clerk/webhook/route.ts` | `user.created` → no-op |
| `app/api/me/route.ts` | Suppression du double-rôle, role mutuellement exclusif |
| `app/api/me/is-pro/route.ts` | Aucune modif (reste correct) |
| `app/inscription/[[...sign-up]]/page.tsx` | Refactor → aiguillage minimal |
| `app/inscription/prospect/[[...sign-up]]/page.tsx` | **Nouveau** |
| `app/inscription/pro/[[...sign-up]]/page.tsx` | **Nouveau** |
| `app/connexion/[[...sign-in]]/page.tsx` | `fallbackRedirectUrl` → `/auth/post-login` |
| `app/auth/post-login/page.tsx` | **Nouveau** (server, redirect selon rôle) |
| `app/prospect/page.tsx` | Ajout `ensureRole("prospect")` server-side avec gestion conflict |
| `app/pro/page.tsx` | Ajout `ensureRole("pro")` server-side avec gestion conflict |
| `app/_components/RouteNav.tsx` | Devient client component + role-aware + signOut |
| `app/_components/RoleConflictToast.tsx` | **Nouveau** (client, lit cookie flash) |
| `app/page.tsx` | Lit cookie `role_conflict`, rend toast |
| `public/prototype/components/Landing.jsx` | CTAs prospect/pro routent vers `/inscription/{role}` ou espace si connecté |

## Edge cases & error handling

| Cas | Layer qui catche | Comportement |
|---|---|---|
| User s'inscrit `/inscription/pro` mais a déjà rôle prospect | `ensureRole` côté `/pro` | `RoleConflictError` → cookie `role_conflict=prospect`, redirect `/` + toast |
| Race condition entre 2 onglets, double INSERT | trigger BDD `23505` | `ensureRole` catche, idem ci-dessus |
| User clique "Je suis prospect" sur la home alors qu'il est déjà pro connecté | `Landing.jsx` CTA | Détecte `isSignedIn + role` et route vers `/pro`, pas `/inscription/prospect` |
| User signed-in mais sans rôle | `/auth/post-login` | Fallback DB, sinon redirect `/inscription` (aiguillage) |
| Webhook `user.deleted` arrive | `deleteProspect` | Inchangé : idempotent, trigger pas concerné par DELETE |
| `publicMetadata.role` désynchronisé de la DB | `/api/me` | DB fait foi, on remet à jour `publicMetadata` au passage |
| `clerkClient.users.updateUser` échoue après INSERT | `ensureRole` | Log mais ne throw pas : la row existe, le rôle sera relu via `/api/me` |
| Script SQL direct insérant un doublon | trigger BDD | Refus avec `23505` (filet de sécurité dur) |
| User non connecté tape `/prospect` directement | middleware Clerk (`proxy.ts`) | Redirige vers `/connexion?redirect_url=/prospect` (déjà en place) |

## Plan de tests

### Tests d'intégration (priorité haute)

1. **`role_exclusivity_trigger`** : `INSERT prospects` puis `INSERT pro_accounts`
   même `clerk_user_id` → erreur `23505`. Et inverse.
2. **`ensureRole_prospect_happy`** : appel `ensureRole(userId, "prospect")` →
   row prospect existe, `publicMetadata.role === "prospect"`.
3. **`ensureRole_conflict`** : seed une row `pro_accounts`, appel
   `ensureRole(userId, "prospect")` → throw `RoleConflictError`, aucune row
   prospect créée.
4. **`ensureRole_idempotent`** : appel deux fois de suite avec le même rôle →
   pas d'erreur, pas de doublon.

### Tests E2E (Playwright si dispo, sinon manuel)

5. Inscription via `/inscription/prospect` → atterrit sur `/prospect`,
   RouteNav montre `[Accueil, Liste, Prospect, Déconnexion]`.
6. Inscription via `/inscription/pro` → atterrit sur `/pro`, RouteNav montre
   `[Accueil, Liste, Pro, Déconnexion]`.
7. Page d'accueil non connecté → RouteNav montre `[Accueil, Liste, Connexion]`.
8. Logout depuis le bouton "Déconnexion" → retour `/`, RouteNav repasse à 3 onglets.
9. Reload de `/prospect` → toujours 4 bons onglets (pas de flash 3→4).

### Smoke manuel (avant merge)

10. CTA "Je suis prospect" sur `/` non-connecté → `/inscription/prospect` ;
    connecté pro → `/pro` direct.
11. `/connexion` avec compte prospect → redirige `/prospect`. Avec compte pro
    → redirige `/pro`.

## Hors-scope explicite (YAGNI)

- Pas de page `/auth/role-choice` (purge des comptes existants → inutile).
- Pas de migration des données existantes (purge).
- Pas d'UI de "switch de rôle" pour passer prospect→pro (un user = un rôle,
  point. Si besoin futur, ce sera un nouveau spec).
- Pas de test du webhook Clerk (`user.created` devient no-op, déjà couvert).
