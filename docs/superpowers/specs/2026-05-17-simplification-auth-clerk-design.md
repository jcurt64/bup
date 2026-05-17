# Simplification du flux d'inscription / connexion Clerk — Design

Date : 2026-05-17
Statut : approuvé (design), prêt pour planification d'implémentation

## Contexte

Le flux actuel insère une page d'aiguillage `/inscription` (2 cartes
« particulier » / « professionnel ») entre les CTA de la home et les
formulaires Clerk. Cette étape supplémentaire alourdit le parcours.
Par ailleurs le routage post-auth (`/auth/post-login`) route par **rôle
DB** : un utilisateur arrivant via un bouton « pro » mais dont le compte
existant est « prospect » peut être routé vers l'espace prospect (avec
un toast sur la home), ce qui contredit l'intention exprimée par le
bouton.

## Principe directeur

**L'intention du bouton fait foi, jamais le rôle DB.** Chaque point
d'entrée porte un `intent` explicite (`prospect` ou `pro`). Le routage
post-auth route **toujours** vers l'espace de l'intent. Si le compte
existant contredit l'intent, on **n'atterrit jamais** sur l'espace
opposé : l'utilisateur est renvoyé sur la fenêtre Clerk correspondante
avec une bannière de conflit.

Corollaire vérifiable : une personne provenant d'un bouton `prospect`
ne peut jamais atterrir sur `/pro`, et inversement.

## Décisions de conception (validées)

1. Le message « adresse déjà utilisée pour un compte pro/prospect »
   est rendu via une **bannière au-dessus du widget Clerk** (Clerk ne
   connaît pas nos rôles ; injection inline impossible sans réécriture
   headless fragile).
2. Boutons hero « Je suis prospect/pro » → fenêtre Clerk **connexion** ;
   « adresse déjà utilisée » = **conflit de rôle**.
3. « Ouvrir un compte pro » → **inscription Clerk pro** puis `/pro`.
4. Entrées génériques orphelines (Pricing, flash-deal anonyme) →
   inscription Clerk contextuelle (Pricing → pro ; flash-deal → prospect).
5. Conflit d'un utilisateur **déjà connecté** via bouton hero → on
   conserve le `RoleSwitchModal` existant (déconnexion/reconnexion).
   La bannière Clerk ne s'applique qu'aux flux anonyme → auth.
6. La bannière est rendue **au-dessus** de la carte Clerk (même
   largeur / ombre / rayon), pas comme une erreur de champ interne.
   C'est le sens retenu de « dans la fenêtre Clerk ».

## Changements

### Suppression de `/inscription`

- Supprimer `app/inscription/page.tsx` (aiguillage 2 cartes).
- Conserver `app/inscription/_clerkAppearance.ts` et les sous-pages
  `app/inscription/prospect/[[...sign-up]]/page.tsx` et
  `app/inscription/pro/[[...sign-up]]/page.tsx`.
- Recâbler toutes les références à `/inscription` nu :
  - `<SignIn signUpUrl>` → `/inscription/${intent}` (fallback
    `/inscription/prospect` si pas d'intent).
  - Pricing (`goToProOrSignup`, CTA tarifaires) anonyme → `/inscription/pro`.
  - Modale flash-deal (`goAuth`, visiteur anonyme) →
    `/inscription/prospect?redirect_url=…`.
  - `useRoleGuard` : 3ᵉ argument `anonymousHref` toujours fourni et
    explicite sur tous les appels.

### Header — 2 boutons (desktop nav + drawer mobile)

`app/_components/HomeClient.tsx` : remplacer le bouton unique
« Démarrer » par deux boutons :

- « S'inscrire en tant que prospect » → `/inscription/prospect`
- « S'inscrire en tant que pro » → `/inscription/pro`

État connecté inchangé (« Se déconnecter »). Après inscription :
atterrissage `/prospect` ou `/pro` selon le bouton, jamais l'autre.

### Hero — « Je suis prospect / pro » → connexion

- `guard("prospect", "/prospect", "/connexion?intent=prospect&mode=signin")`
  et symétrique pour `pro`.
- Anonyme → fenêtre Clerk `<SignIn>` (pas sign-up), avec intent.
- Connecté + rôle compatible → `/prospect` (resp. `/pro`).
- Connecté + rôle incompatible → `RoleSwitchModal` existant (conservé).

### « Ouvrir un compte pro » (section pros + FinalCTA) + Pricing

- `guard("pro", "/pro", "/inscription/pro")` ; anonyme → `/inscription/pro`
  puis `/pro`. Jamais `/prospect`.
- « Créer mon profil prospect » (FinalCTA) → `/inscription/prospect`
  → `/prospect`.

### Routage post-auth — `app/auth/post-login/page.tsx`

Devient intent-authoritative. Logique de décision extraite dans une
fonction pure testable `resolvePostAuth({ intent, role })` :

1. `intent` lu via query `?intent=` puis fallback cookie
   `bupp_auth_intent` (mécanisme existant conservé). `mode`
   (`signin` | `signup`) propagé pour le rebond en cas de conflit.
2. `role = getCurrentRole(userId)`.
3. `role` absent → `ensureRole(userId, email, intent)` puis
   `redirect('/' + intent)`. Si `ensureRole` lève
   `RoleConflictError` → cas 4.
4. `role` existe et ≠ `intent` → redirect vers la page Clerk de
   l'intent avec `?conflict=<roleExistant>` :
   - `mode=signup` → `/inscription/${intent}?conflict=${role}`
   - `mode=signin` → `/connexion?intent=${intent}&conflict=${role}`
   - **Jamais** de redirection vers `/${role}`.
5. `role` == `intent` → `redirect('/' + intent)`.

`redirect_url` explicite (flash deal) reste prioritaire via
`safeRedirect`.

### Bannière de conflit — `<AuthConflictBanner>`

- Nouveau composant rendu par
  `app/connexion/[[...sign-in]]/page.tsx` et
  `app/inscription/{prospect,pro}/[[...sign-up]]/page.tsx` quand
  `searchParams.conflict` est présent.
- Positionné juste au-dessus de la carte Clerk, même largeur / ombre /
  rayon → perçu comme faisant partie de la fenêtre.
- Texte : « Cette adresse e-mail est déjà associée à un compte
  **{professionnel | particulier}**. Connectez-vous à votre espace
  {pro | prospect}. » + lien vers `/connexion?intent=<roleExistant>`.
- Limite Clerk assumée : en signup avec email déjà pris, Clerk affiche
  d'abord sa propre erreur générique ; l'utilisateur poursuit en
  connexion (lien `signInUrl` portant l'intent) et la bannière
  enrichie s'affiche après résolution serveur.

### Backend / sécurité — inchangé, vérifié

- `proxy.ts` : cookie d'intent conservé ; garde de rôle middleware
  reste un filet de sécurité pour les accès URL directs sans intent
  (toast home acceptable dans ce cas hors parcours bouton).
- Trigger Postgres d'exclusivité de rôle, `ensureRole`, webhook Clerk :
  inchangés.
- `safeRedirect` : inchangé (anti-open-redirect).

## Vérification

- `npm run build` + typecheck propre.
- Tests unitaires sur `resolvePostAuth` (fonction pure) : matrice
  intent × role × présence de row.
- Tests manuels matriciels : {prospect, pro} × {bouton signup,
  bouton signin} × {nouvel email, email même rôle, email rôle opposé}.
  Critère : on n'atterrit jamais sur l'espace opposé ; la bannière
  s'affiche au-dessus de la bonne carte Clerk.

## Hors périmètre

- Réécriture headless Clerk Elements.
- Modification du trigger Postgres ou du webhook.
- Refonte du `RoleSwitchModal` (conservé tel quel).
- Toute refonte visuelle des espaces `/prospect` et `/pro`.
