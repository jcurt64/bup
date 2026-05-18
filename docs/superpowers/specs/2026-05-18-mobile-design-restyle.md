# Mobile — refonte design (parité visuelle a.png/b.png/tab.png + onboarding)

Date : 2026-05-18
Branche : `worktree-mobile-app`
Périmètre : **app mobile prospect uniquement** (RN/Expo SDK 54). Aucun
changement backend `/api/*`. La couche données/parité déjà livrée reste
intacte — on ne touche QUE la présentation/navigation.

Références (repo web, lecture seule) :
`public/prototype/a.png`, `b.png`, `tab.png`,
`public/prototype/buupp-onboarding/1.png` … `8.png` (notamment `4.png` =
écran auth). Source de vérité visuelle pour l'onboarding/auth = ces PNG.

## 1. Système de design (primitives partagées)

Fond **ivoire** conservé partout (`bg-ivory` `#F7F4EC`). On centralise le
style dans des primitives ; les écrans composent.

Nouvelle dépendance : `expo-linear-gradient` (via `npx expo install`,
SDK 54). Aucune autre.

Nouveaux tokens couleur (Tailwind `tailwind.config.js`, en plus de
l'existant ink/paper/ivory/line/violet/navy/good/bad) — accents « badge »
inspirés de b.png, usage parcimonieux :
- `coral` `#FF7A6B`, `teal` `#2FB8A6`, `amber` `#F2B65A`, `sky` `#5B8DEF`
(+ variantes `*-soft` claires pour les fonds de badge).

Primitives (dans `components/`) :
- **`BrandLogo`** (`components/ui.tsx`) : pill « buupp » en dégradé
  navy→bleu (`#13235B → #2F44C0`), texte serif blanc, ombre douce
  (cf. `1.png`/`4.png`). Remplace l'actuel `BrandPill`.
- **`GradientHero`** (`components/screen.tsx`) : carte d'en-tête plein
  largeur, coins `rounded-3xl`, dégradé violet→navy
  (`#7C5CFC → #13235B`), texte clair, ombre. Props : `title`,
  `eyebrow?`, `children` (ex. gros chiffre), `left?` (bouton menu/retour),
  `right?`. C'est ce qui REMPLACE le header natif (cf. §2).
- **`Card`** (existant, étendu) : carte claire `paper`, `rounded-3xl`,
  ombre douce ; nouvelle prop optionnelle `badge?: { icon; tone }` →
  pastille circulaire colorée (coral/teal/amber/sky/violet) en tête de
  carte (cf. cartes « Weekly Expense » b.png). `dark` conservé.
- **`PillButton`** (`components/ui.tsx`, refonte de `PrimaryButton`) :
  pill `rounded-full`. `variant`: `primary` (navy `ink`), `secondary`
  (paper bordé), `ghost`. Tailles `md|lg`.
- **`FloatingTabBar`** (`components/floating-tab-bar.tsx`, nouveau) :
  composant passé à `<Tabs tabBar={...}>`. Barre `rounded-full`
  flottante, détachée (marges + ombre), fond `paper`, 5 items
  circulaires ; item actif = cercle dégradé violet→navy, icône blanche ;
  inactif = cercle discret, icône `ink-4` (cf. `tab.png`). Respecte
  l'inset bas (safe area via `react-native-safe-area-context` déjà dép).
- **`LeftDrawer`** (`components/drawer-panel.tsx`, refonte) : panneau
  qui glisse depuis la GAUCHE (`Animated.View` translateX), scrim à
  droite, fermeture tap-scrim/sélection. Contenu (nav + Suivez-nous +
  Déconnexion + Supprimer le compte) inchangé fonctionnellement.

Typo conservée : serif gros chiffres/titres, mot accent violet italique,
micro-labels mono majuscules espacées.

## 2. `headerShown: false` partout

- `app/(prospect)/_layout.tsx` (`Tabs`) : `screenOptions.headerShown:
  false` ; suppression du `headerLeft`. La tab bar passe par
  `tabBar={props => <FloatingTabBar {...props} />}`.
- `app/_layout.tsx` (Stack racine) : déjà `headerShown:false` — vérifier
  que la route `drawer` le reste.
- `app/(auth)/_layout.tsx`, `app/(onboarding)/_layout.tsx` : `headerShown:
  false`.
- Conséquence : chaque écran rend SON header via `GradientHero` :
  - **Portefeuille** : `GradientHero` avec bouton **menu** (ouvre le
    drawer) en `left`.
  - Écrans drawer (verification, score, parrainage, fiscal,
    suggestions) : `GradientHero` avec **flèche retour** (`router.back()`)
    en `left`.
  - Onglets donnees/relations/messages/preferences : `GradientHero`
    titre (pas de bouton, pas de back — ce sont des onglets racine).

## 3. Tab bar flottante (`tab.png`)

`FloatingTabBar` : conteneur `position:absolute` bas, marges latérales,
`rounded-full`, `bg-paper`, ombre portée ; 5 cercles (Portefeuille / Mes
données / Mise en relation / Messages / Préférences) ; actif = pastille
dégradé violet→navy + icône blanche ; libellé court optionnel sous
l'icône active uniquement (libellé court sous la pastille active
seulement ; les inactifs = icône seule, fidèle à `tab.png`).
Les écrans ajoutent un padding bas pour ne pas être masqués.

## 4. Onboarding & Auth — éléments manquants (cf. `buupp-onboarding`)

`app/(onboarding)/index.tsx` : utiliser `BrandLogo` (pill dégradé),
titres serif + mot violet italique, dots de pagination foncés — aligné
sur `1.png`/`2.png`/`3.png`.

`app/(auth)/sign-in.tsx` + `role-select.tsx` (cf. `4.png`) — AJOUTER ce
qui manque, sans casser le flux réel **passwordless email-code** Clerk
(la maquette montre un champ mot de passe + « mot de passe oublié » : on
NE les ajoute PAS, l'instance Clerk web est sans mot de passe ; on garde
le flux code e-mail existant, on aligne seulement l'habillage) :
- `BrandLogo` en dégradé.
- Titre « Bon retour, *buupper*. » / sous-titre, style maquette.
- Toggle **Connexion / Inscription** en pill (actif = navy).
- Cartes rôle **Buupper / Professionnel** (sélection = teinte violette,
  bord violet) — style maquette.
- **3 boutons de connexion sociale** : Apple, Google, Facebook — cartes
  blanches en ligne, précédées d'un séparateur « OU ». Implémentation :
  via Clerk OAuth (`useOAuth` / stratégies `oauth_apple`,
  `oauth_google`, `oauth_facebook`) si configurées ; sinon les boutons
  sont rendus mais déclenchent un message « Bientôt disponible » (ne pas
  bloquer le design ; brancher l'OAuth réel est conditionné à la config
  Clerk — à vérifier au plan). Logos via `@expo/vector-icons`
  (`logo-apple`, `logo-google`, `logo-facebook`).
- **Footer légal** : « En continuant, vous acceptez nos Conditions,
  notre Politique de confidentialité et la conformité RGPD. Mentions
  légales · Cookies » (texte statique, liens vers les pages web via
  `Linking` si URLs connues, sinon texte simple).

## 5. Drawer depuis la gauche

`components/drawer-panel.tsx` : remplacer le layout `flex-row` (panneau à
gauche + scrim) statique par une **animation d'entrée par la gauche**
(`Animated`/`react-native-reanimated` déjà dép : translateX de
`-width` → 0 à l'ouverture, inverse à la fermeture ; scrim opacity 0→1).
La route reste `app/drawer.tsx` en `presentation:"transparentModal"`
(Stack racine) — seul le sens d'apparition change (gauche, pas bas).
Fermeture : tap scrim, geste, sélection d'une entrée → animation inverse
puis `router.back()`.

## 6. Critères d'acceptation

- Fond ivoire conservé sur tous les écrans.
- Chaque écran a une carte héro en dégradé (violet→navy) tenant lieu de
  header ; aucun header natif visible nulle part (`headerShown:false`).
- Cartes de contenu claires avec badges colorés là où pertinent ;
  dégradés présents (héro, logo, tab active).
- Tab bar = pilule flottante détachée, item actif en pastille dégradée
  (rendu fidèle à `tab.png`), 5 onglets, n'occulte pas le contenu
  (padding bas), respecte la safe area.
- Onboarding/Auth : logo dégradé, toggle, cartes rôle, **3 boutons
  sociaux Apple/Google/Facebook**, footer légal — présents et stylés
  comme `4.png` ; le flux passwordless e-mail-code reste fonctionnel
  (auth non régressée).
- Drawer s'ouvre/ferme **par la gauche** avec animation + scrim.
- `tsc --noEmit` 0 erreur, `expo lint` 0, `expo export -p web` OK.
- Aucune modification de `app/api/*`, `app/(pro)/*`, ni du backend ;
  la logique données/parité (hooks, refetch-on-focus, parité web)
  inchangée — uniquement présentation/navigation.

## 7. Hors périmètre

- Tout l'espace **pro**.
- OAuth social réellement fonctionnel si Clerk ne le fournit pas (boutons
  présents, branchement réel conditionné à la config Clerk — sinon
  placeholder « bientôt »).
- Graphes SVG, refontes data, nouveaux endpoints.
- Mode sombre.
