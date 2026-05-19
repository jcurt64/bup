# Spec — Header app mobile + bottom-sheets (sollicitations / compte)

Date : 2026-05-19 · Branche : `worktree-mobile-app` · Statut : approuvé

## Objectif

Refondre l'en-tête des écrans (prospect/pro) et ajouter deux bottom-sheets,
sans dépendance nouvelle, en réutilisant les hooks déjà synchronisés web⇄mobile.

## Décisions (validées avec l'utilisateur)

1. **Header sobre AU-DESSUS du `GradientHero`** (le bandeau dégradé est conservé).
2. **Cloche** → bottom-sheet listant **uniquement les demandes de sollicitations**
   (`useProspectRelations().pending`, fetch DB). Tap sur une ligne → modal détail
   avec **Accepter / Refuser** (`useDecideRelation`), **à l'identique du web**.
3. **Personne** → bottom-sheet « Mon compte » : **Mode sombre** (Switch
   désactivé + « bientôt », vrai dark mode = chantier ultérieur),
   **Déconnexion** (`useAuth().signOut` + `router.replace("/(auth)/sign-in")`),
   liens (Préférences, Aide).
4. **Cards colorées** : fond pastel teinté par `tone` (réutilise `TONE_BG`).
5. **Police** : règle `text-sm → text-lg` déjà centralisée
   (`GradientHero.desc`/`SectionTitle.desc`) ; aligner descriptions inline.

## Architecture (approche A — centralisée)

- `components/bottom-sheet.tsx` (nouveau) — wrapper réutilisable : `Modal` RN
  `transparent` + `animationType="slide"`, scrim cliquable, panneau arrondi
  haut, safe-area bas. Aucune dépendance ajoutée.
- `components/app-header.tsx` (nouveau) — barre : `☰` (fond pastel) →
  `router.push("/drawer")` ; `logo2` centré (`expo-image`, asset copié dans
  `assets/images/logo2.png`) ; groupe droite `🔔`+`👤` (fonds pastels) ;
  gère l'état d'ouverture des deux sheets ; gère son inset safe-area haut.
- `components/solicitations-sheet.tsx` (nouveau) — `BottomSheet` ; liste
  `useProspectRelations().pending` (pro, secteur, `eur(reward)`, palier,
  timer) ; tap → sous-modal détail (motif, brief, récompense) +
  Refuser/Accepter via `useDecideRelation` ({id, action}) ; état vide.
- `components/account-sheet.tsx` (nouveau) — `BottomSheet` ; Mode sombre
  (Switch `disabled`), Déconnexion, liens Préférences/Aide.
- `components/screen.tsx` — `ScrollScreen` rend `<AppHeader/>` au-dessus du
  `ScrollView` (donc au-dessus du `GradientHero`) → tous les écrans
  prospect/pro l'obtiennent via un seul point de modif. `Card` reçoit un
  prop optionnel `tone` qui teinte le fond (pastel `*-soft`), défaut paper.
- `app/(prospect)/portefeuille.tsx` — assigne un `tone` cohérent par bloc.

## Interfaces

- `BottomSheet`: `{ visible: boolean; onClose(): void; children }`.
- `AppHeader`: aucun prop (router + état interne).
- `SolicitationsSheet` / `AccountSheet`: `{ visible; onClose() }`.
- `Card`: prop ajouté `tone?: Tone` (réutilise type `Tone` existant).

## Hors périmètre 1ʳᵉ itération

- Vrai dark mode fonctionnel (toggle inactif).
- Header pro : appliqué automatiquement (même `ScrollScreen`) mais
  validation pro différée.

## Risques / validation

- Écrans prospect = authentifiés ; session simulateur perdue → rendu non
  vérifiable tant que l'utilisateur n'est pas reconnecté. Mitigation :
  `tsc --noEmit` vert + revue de code ; validation visuelle écran par écran
  à la reconnexion.
