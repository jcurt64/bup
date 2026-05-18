# Mobile prospect — tab bar, drawer & données réelles (parité web)

Date : 2026-05-18
Branche : `worktree-mobile-app`
Périmètre : **espace prospect mobile uniquement**. Aucune modification des
écrans `(pro)/*` ni du backend `/api/*` partagé. À faire **avant** le chantier pro.

## 1. Objectif

1. Réduire la tab bar prospect à 5 onglets : **Portefeuille, Mes données,
   Mise en relation, Messages, Préférences**.
2. Regrouper les autres entrées dans un **drawer** ouvert depuis le header
   de l'écran d'accueil (Portefeuille uniquement) : Paliers de vérification,
   BUUPP Score, Parrainage, Informations fiscales, Suivez-nous, Vos
   suggestions, Déconnexion, Supprimer mon compte.
3. Brancher **chaque écran** sur les données réelles via les endpoints
   `/api/*`, avec **parité fonctionnelle complète avec le web** (lecture
   *et* actions).
4. Fraîcheur : **refetch au focus** (pas de polling périodique).

Source de vérité du contenu/des champs/des endpoints web :
`public/prototype/components/Prospect.jsx` (web, branche `main`). Le mobile
doit afficher les **mêmes champs, mêmes valeurs, mêmes formats** que cette
UI web pour chaque section.

## 2. Architecture de navigation

### 2.1 Tab bar — `app/(prospect)/_layout.tsx`

Exactement 5 `Tabs.Screen`, dans cet ordre :

| Onglet | Fichier | Statut |
|---|---|---|
| Portefeuille | `app/(prospect)/portefeuille.tsx` | existe (header : bouton drawer à ajouter) |
| Mes données | `app/(prospect)/donnees.tsx` | existe |
| Mise en relation | `app/(prospect)/relations.tsx` | existe |
| Messages | `app/(prospect)/messages.tsx` | réécrire (stub 5 lignes) |
| Préférences | `app/(prospect)/preferences.tsx` | **nouveau** |

`score.tsx` n'est plus un onglet (devient écran drawer, voir 2.3).

### 2.2 Drawer

- **Déclencheur** : icône menu (header gauche) **présente uniquement sur
  Portefeuille** (`headerLeft` de l'onglet Portefeuille). Pas de drawer
  global.
- **Implémentation** : route modale expo-router custom (panneau slide-in),
  **pas** `@react-navigation/drawer` (le drawer ne doit pas être global et
  se nest mal avec les Tabs sous expo-router). Fichier
  `app/(prospect)/drawer.tsx` présenté en `presentation: "transparentModal"`
  / animation latérale.
- Fermeture : tap sur le scrim, geste, ou sélection d'une entrée.

### 2.3 Entrées du drawer

**Navigation (écrans empilés, nouveaux fichiers sous `app/(prospect)/`)** —
poussés via `router.push`, header avec retour :

| Entrée | Fichier | Endpoints |
|---|---|---|
| Paliers de vérification | `verification.tsx` | `GET /api/prospect/verification`, `GET /api/prospect/tier` |
| BUUPP Score | `score.tsx` (réutilisé, déplacé hors tab) | `GET /api/prospect/score`, `GET /api/prospect/score/history` |
| Parrainage | `parrainage.tsx` | `GET /api/prospect/parrainage` |
| Informations fiscales | `fiscal.tsx` | `GET /api/prospect/fiscal`, `GET /api/prospect/fiscal/[year]/recap`, `GET /api/prospect/fiscal/[year]/dgfip-receipt` |
| Vos suggestions | `suggestions.tsx` | `POST /api/me/suggestions` |

**Actions (pas d'écran dédié)** :

- **Suivez-nous** : 3 liens externes (Facebook, Instagram, X) via
  `expo-linking` / `Linking.openURL`. URLs reprises de `Prospect.jsx`.
- **Déconnexion** : modale de confirmation → `signOut()` Clerk → redirect
  `/(auth)/sign-in`.
- **Supprimer mon compte** : modale de confirmation (texte/garde-fous
  identiques au web) → `DELETE /api/me` → signOut → redirect.

## 3. Couche de données — `lib/queries.ts`

- React Query, **1 `queryKey` par endpoint**. Conserver le helper `useGet`.
- **Fraîcheur = refetch au focus** : `refetchOnReconnect: true`,
  `refetchOnWindowFocus: true`, refetch au focus d'écran via
  `useFocusEffect` + `query.refetch()`. **Aucun `refetchInterval`.**
- Mutations → `queryClient.invalidateQueries` ciblé sur les vues impactées
  (pattern existant `useDecideRelation`).
- Garde 401 : `QueryGate` existant (message « Session expirée »).
- Hooks à ajouter (lecture) : `useProspectMovements`,
  `useProspectDonnees`, `useProspectVerification`, `useProspectTier`,
  `useProspectScoreHistory`, `useProspectFiscal`,
  `useProspectFiscalRecap(year)`. `useNotifications` existe déjà.
- Hooks à ajouter (mutations) : `useMarkNotificationRead`,
  `useUpdateDonnees`/`useTogglePref`, `usePhoneStart`, `usePhoneVerify`,
  `useSaveRib`, `usePayoutOnboarding`, `usePayoutWithdraw`,
  `useEmailTrackingOptOut`, `useSendSuggestion`, `useDeleteAccount`.
- Téléchargements (reçu DGFiP, récap fiscal) : ouverture via
  `Linking`/`WebBrowser` avec le token Clerk, ou téléchargement
  `expo-file-system` + partage — choix tranché au plan d'implémentation.

## 4. Mapping écran → endpoints (parité web)

| Écran | GET (lecture) | Actions (mutations) |
|---|---|---|
| Portefeuille | `/api/prospect/wallet`, `/api/prospect/movements` | (retrait via Préférences/Fiscal selon web) |
| Mes données | `/api/prospect/donnees` | édition champs `PATCH/POST /api/prospect/donnees` (selon route web) |
| Mise en relation | `/api/prospect/relations` | `POST /api/prospect/relations/[id]/decision` (accept/refuse/undo) |
| Messages | `/api/me/notifications` | `POST /api/me/notifications/[id]/read`, ouverture `/[id]/attachment` |
| Préférences | `/api/prospect/donnees` (flags), `/api/prospect/phone`, `/api/prospect/rib`, `/api/prospect/payout/status` | `/api/prospect/phone/start`, `/api/prospect/phone/verify`, `/api/prospect/rib`, `/api/prospect/payout/onboarding`, `/api/prospect/payout/withdraw`, `/api/me/email-tracking` |
| Vérification | `/api/prospect/verification`, `/api/prospect/tier` | — |
| BUUPP Score | `/api/prospect/score`, `/api/prospect/score/history` | — |
| Parrainage | `/api/prospect/parrainage` | — (partage code via `Share` natif) |
| Fiscal | `/api/prospect/fiscal`, `/api/prospect/fiscal/[year]/recap` | téléchargement `dgfip-receipt` / `recap` |
| Suggestions | — | `POST /api/me/suggestions` |
| Supprimer compte | — | `DELETE /api/me` |

Les **champs exacts et formats** de chaque écran sont calqués section par
section sur `Prospect.jsx` (composants `Portefeuille`, `MesDonnees`,
`Relations`, `Prefs`, `ScorePanel`, `Parrainage`, `Fiscal`, `Verif`,
`SuggestionsPanel`, modale suppression). Le plan d'implémentation détaillera
la shape par endpoint en lisant la route web correspondante + le rendu JSX.

## 5. Critères d'acceptation

- Tab bar = exactement les 5 onglets listés, dans l'ordre.
- Drawer accessible **uniquement** depuis le header de Portefeuille,
  contenant les 8 entrées ; navigation et actions fonctionnelles.
- Pour chaque écran : toute donnée affichée par le web pour ce prospect
  est affichée sur mobile avec la **même valeur et le même format**
  (montants €, dates fr-FR, libellés, badges).
- Aucune donnée codée en dur / mock : 100 % via `/api/*` + token Clerk.
- Refetch au focus vérifié (revenir sur un écran rafraîchit ; pas de
  polling en arrière-plan).
- Actions de mutation reflètent le résultat (invalidation → UI à jour)
  comme sur le web.
- `tsc --noEmit` OK ; `expo export` web OK ; testé sur simulateur/Expo Go.
- Aucune modification de `(pro)/*` ni du backend partagé.

## 6. Hors périmètre

- Tout l'espace **pro** (chantier suivant, explicitement après).
- Messagerie conversationnelle pro↔prospect (n'existe pas côté backend ;
  « Messages » = boîte de notifications).
- Realtime websocket/Supabase (choix : refetch au focus).
- Push notifications, EAS Build, deep-links SSO (itérations ultérieures).
