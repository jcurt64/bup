# Espace Pro — Lot A : retraits & restylages UI rapides — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer 4 modifications UI à faible risque dans l'espace Pro (retrait Export CSV, retrait bouton LinkedIn, encart « Politique d'usage » en alerte rouge clair, retrait carte « Renouvellement »).

**Architecture:** Édition chirurgicale du seul fichier `public/prototype/components/Pro.jsx` (UI du prototype transpilé en navigateur). Aucune route `/api/*`, aucun schéma Supabase, aucune logique métier. Web-only, aucun impact mobile fonctionnel.

**Tech Stack:** JSX (prototype Babel-in-browser), Next.js 16, ESLint, Vitest (couvre `lib/` uniquement — pas le prototype).

**Note sur la vérification (TDD adapté) :** le prototype `Pro.jsx` n'a **aucune couverture de test automatisée** (Vitest n'importe que `lib/`, et le JSX est transpilé navigateur). Le red/green TDD classique est donc inapplicable ici. À la place, chaque tâche utilise des **assertions `grep` avant/après** comme harnais de vérification déterministe, plus `tsc`/`eslint`/`vitest` en non-régression globale, et une validation visuelle finale.

**Référence spec :** `docs/superpowers/specs/2026-05-19-pro-lot-a-ui-rapides-design.md`

---

## File Structure

- Modify uniquement : `public/prototype/components/Pro.jsx`
  - Section « Contacts obtenus » du détail campagne (~ligne 6962) → A1
  - `REVEAL_INTENTS` (~ligne 4807) + tableau `buttons` de `ContactActionButtons` (~lignes 4874-4881) → A2
  - Carte « Politique d'usage » (~lignes 4751-4758) → A3
  - Cartes KPI Facturation + grille (~lignes 6015 et 6024) → A4

Aucun fichier créé. Aucun test créé (pas de harnais prototype).

---

## Task 1: A2 — Pré-vérification des références `linkedin`

Objectif : confirmer que l'intent `'linkedin'` n'est référencé QUE dans `REVEAL_INTENTS` et le tableau `buttons` avant de le retirer (sinon adapter le plan).

**Files:**
- Inspect: `public/prototype/components/Pro.jsx`

- [ ] **Step 1: Lister toutes les occurrences de `linkedin`**

Run:
```bash
grep -n "linkedin\|LinkedIn" public/prototype/components/Pro.jsx
```
Expected : uniquement (a) la clé `linkedin:` de `REVEAL_INTENTS` (~4807), (b) l'objet `{ key: 'linkedin', channel: 'linkedin', … }` du tableau `buttons` (~4874-4881), et éventuellement des libellés humains (`'Rechercher sur LinkedIn'`, `title: 'Trouver sur LinkedIn —'`) internes à ces deux blocs.

- [ ] **Step 2: Vérifier l'absence de référence externe**

**Résultat constaté (résolu par le contrôleur) :** `grep` renvoie 5 lignes : 4807 (`REVEAL_INTENTS.linkedin`), 4875-4879 (objet `buttons`), **et la ligne 1382** :
`{id:'linkedin', name:'LinkedIn Matched Audiences', desc:'Audience B2B pour LinkedIn Ads', cost:0.30}`.

La ligne 1382 est une **fonctionnalité sans rapport** : une audience publicitaire (objectifs de campagne « Publicité digitale », aux côtés de Meta/Google/TikTok/Snap/X). Elle **NE doit PAS être retirée** — hors périmètre du Lot A (le spec A2 vise le bouton de révélation de contact « Mes contacts » uniquement).

Décision : procéder au retrait de l'intent de révélation seulement (Task 2). La ligne 1382 reste intacte. Les vérifications `grep linkedin` post-retrait doivent donc montrer **uniquement la ligne 1382** (et non « zéro occurrence »).

Aucun commit (tâche d'inspection).

---

## Task 2: A2 — Retrait du bouton LinkedIn

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (`REVEAL_INTENTS` ~4807 ; tableau `buttons` ~4874-4881)

- [ ] **Step 1: Supprimer l'entrée `linkedin` de `REVEAL_INTENTS`**

Old (ligne ~4807, dernière entrée de l'objet `REVEAL_INTENTS`) :
```jsx
  facebook: { field: 'name',      icon: 'facebook', title: 'Trouver sur Facebook —',     cta: 'Rechercher sur Facebook',      build: v => `https://www.facebook.com/search/top/?q=${encodeURIComponent(v).replace(/%20/g, '+')}`,        valuePresentation: 'serif' },
  linkedin: { field: 'name',      icon: 'linkedin', title: 'Trouver sur LinkedIn —',     cta: 'Rechercher sur LinkedIn',      build: v => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(v)}`,         valuePresentation: 'serif' },
};
```
New :
```jsx
  facebook: { field: 'name',      icon: 'facebook', title: 'Trouver sur Facebook —',     cta: 'Rechercher sur Facebook',      build: v => `https://www.facebook.com/search/top/?q=${encodeURIComponent(v).replace(/%20/g, '+')}`,        valuePresentation: 'serif' },
};
```

- [ ] **Step 2: Supprimer l'objet `linkedin` du tableau `buttons`**

Old (lignes ~4866-4882, fin du tableau `buttons` dans `ContactActionButtons`) :
```jsx
    {
      key: 'facebook', channel: 'facebook',
      enabled: channelAllowed('facebook'),
      disabledReason: null,
      icon: 'facebook', color: '#1877F2',
      title: 'Rechercher sur Facebook',
      missingDataMsg: '',
    },
    {
      key: 'linkedin', channel: 'linkedin',
      enabled: channelAllowed('linkedin'),
      disabledReason: null,
      icon: 'linkedin', color: '#0A66C2',
      title: 'Rechercher sur LinkedIn',
      missingDataMsg: '',
    },
  ];
```
New :
```jsx
    {
      key: 'facebook', channel: 'facebook',
      enabled: channelAllowed('facebook'),
      disabledReason: null,
      icon: 'facebook', color: '#1877F2',
      title: 'Rechercher sur Facebook',
      missingDataMsg: '',
    },
  ];
```

- [ ] **Step 3: Vérifier le retrait**

Run:
```bash
grep -n "linkedin\|LinkedIn" public/prototype/components/Pro.jsx
```
Expected : **exactement une** ligne restante, la 1382 (`{id:'linkedin', name:'LinkedIn Matched Audiences', …}`) — fonctionnalité publicitaire hors périmètre, volontairement conservée. Plus aucune occurrence aux lignes ~4807 et ~4875-4879 (intent de révélation + objet `buttons` retirés).

- [ ] **Step 4: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro): retrait du bouton LinkedIn (Mes contacts)"
```

---

## Task 3: A3 — « Politique d'usage » en encart d'alerte rouge clair

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (carte « Politique d'usage » ~4751-4758)

- [ ] **Step 1: Restyler la carte en encart d'alerte**

Old (lignes ~4751-4758) :
```jsx
      <div className="card" style={{ padding: 16, background: 'var(--ivory-2)', borderStyle: 'dashed' }}>
        <div className="row center gap-3">
          <Icon name="shield" size={16}/>
          <div style={{ fontSize: 13 }}>
            <strong>Politique d'usage.</strong> <span className="muted">Les coordonnées sont watermarquées individuellement. Toute diffusion hors périmètre de la campagne déclenchera une enquête automatique et peut entraîner la résiliation du compte.</span>
          </div>
        </div>
      </div>
```
New :
```jsx
      <div className="card" style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', borderLeft: '4px solid #B91C1C' }}>
        <div className="row center gap-3">
          <Icon name="shield" size={16} color="#B91C1C"/>
          <div style={{ fontSize: 13 }}>
            <strong style={{ color: '#B91C1C' }}>Politique d'usage.</strong> <span style={{ color: 'rgba(185,28,28,.75)' }}>Les coordonnées sont watermarquées individuellement. Toute diffusion hors périmètre de la campagne déclenchera une enquête automatique et peut entraîner la résiliation du compte.</span>
          </div>
        </div>
      </div>
```

Note : `<Icon>` accepte une prop `color` (vérifier sa signature dans `Shell.jsx` / définition de `Icon` ; si la prop n'existe pas, envelopper l'icône dans `<span style={{ color: '#B91C1C' }}>…</span>` à la place — l'icône hérite alors de `currentColor`).

- [ ] **Step 2: Vérifier le restylage**

Run:
```bash
grep -n "Politique d'usage" public/prototype/components/Pro.jsx
grep -n "background: '#FEF2F2', border: '1px solid #FCA5A5'" public/prototype/components/Pro.jsx
```
Expected : le texte « Politique d'usage » toujours présent (message inchangé) ; la 2ᵉ commande renvoie la ligne du nouveau conteneur ; `grep -n "var(--ivory-2)', borderStyle: 'dashed'" ` sur cette carte ne renvoie plus rien.

- [ ] **Step 3: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro): politique d'usage en encart d'alerte rouge clair"
```

---

## Task 4: A1 — Retrait du bouton « Exporter CSV » (détail campagne)

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (section « Contacts obtenus » ~6961-6962)

- [ ] **Step 1: Supprimer le bouton Exporter CSV**

Old (lignes ~6960-6963) :
```jsx
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm"><Icon name="filter" size={12}/> Filtrer</button>
              <button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Exporter CSV</button>
            </div>
```
New :
```jsx
            <div className="row gap-2">
              <button className="btn btn-ghost btn-sm"><Icon name="filter" size={12}/> Filtrer</button>
            </div>
```

- [ ] **Step 2: Vérifier le retrait**

Run:
```bash
grep -n "Exporter CSV" public/prototype/components/Pro.jsx
```
Expected : **aucune** occurrence (le bouton « Filtrer » reste, vérifiable via `grep -n "> Filtrer<" public/prototype/components/Pro.jsx`).

- [ ] **Step 3: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro): retrait du bouton Exporter CSV (détail campagne)"
```

---

## Task 5: A4 — Retrait de la carte « Renouvellement » (Facturation)

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (grille KPI ~6015 ; tableau cartes ~6024)

- [ ] **Step 1: Supprimer l'entrée « Renouvellement » et passer la grille à 2 colonnes**

Old (lignes ~6015-6025) :
```jsx
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          [
            'Abonnement actuel',
            planInfo ? planInfo.label : '…',
            planInfo
              ? `${Number(planInfo.monthlyEur).toFixed(0)} € / ${planInfo.maxCampaigns ?? (planInfo.plan === 'pro' ? 10 : 2)} campagnes`
              : '—',
          ],
          ['Renouvellement', '02 mai 2026', 'Prélèvement auto.'],
          ['Carte enregistrée', 'Visa ••4521', 'Expire 08/28'],
        ].map((r, i) => (
```
New :
```jsx
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {[
          [
            'Abonnement actuel',
            planInfo ? planInfo.label : '…',
            planInfo
              ? `${Number(planInfo.monthlyEur).toFixed(0)} € / ${planInfo.maxCampaigns ?? (planInfo.plan === 'pro' ? 10 : 2)} campagnes`
              : '—',
          ],
          ['Carte enregistrée', 'Visa ••4521', 'Expire 08/28'],
        ].map((r, i) => (
```

- [ ] **Step 2: Vérifier le retrait**

Run:
```bash
grep -n "'Renouvellement'\|Prélèvement auto" public/prototype/components/Pro.jsx
grep -n "gridTemplateColumns: 'repeat(2, 1fr)', gap: 16" public/prototype/components/Pro.jsx
```
Expected : 1ʳᵉ commande → aucune occurrence ; 2ᵉ commande → renvoie la ligne de la grille Facturation. Les libellés « Abonnement actuel » et « Carte enregistrée » restent présents (inchangés).

- [ ] **Step 3: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro): retrait de la carte Renouvellement (Facturation)"
```

---

## Task 6: Vérification globale & non-régression

**Files:** aucun (vérification seule)

- [ ] **Step 1: Typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected : exit 0, aucune erreur.

- [ ] **Step 2: Lint**

Run:
```bash
npx eslint public/prototype/components/Pro.jsx
```
Expected : exit 0 (ou pré-existants non liés à Lot A uniquement — ne PAS introduire de nouvelle erreur). Note : `Pro.jsx` est sous `public/` ; si ESLint ne le lint pas par config, exécuter à la place une vérification de parenthèses/accolades via `node --check` n'étant pas applicable au JSX — dans ce cas se reposer sur Step 4 (validation visuelle) qui révèle toute JSX cassée.

- [ ] **Step 3: Tests (non-régression)**

Run:
```bash
npx vitest run
```
Expected : tous les tests passent (suite inchangée, 51 tests attendus verts ; aucun ne couvre le prototype mais on confirme l'absence de régression projet).

- [ ] **Step 4: Validation visuelle**

Run:
```bash
npm run dev
```
Puis, connecté en pro, vérifier manuellement :
- Détail d'une campagne → « Contacts obtenus » : bouton « Filtrer » présent, **aucun** bouton « Exporter CSV ».
- « Mes contacts » : barre d'actions de contact **sans** bouton LinkedIn (Facebook + autres canaux présents) ; carte « Politique d'usage » en **rouge clair** (fond/bordure/texte), message identique.
- « Facturation » : **2 cartes** équilibrées (« Abonnement actuel », « Carte enregistrée »), **aucune** carte « Renouvellement ».

Rappel : en local `PROTOTYPE_VERSION` est figé au démarrage de `next` ; si les `.jsx` modifiés ne se rafraîchissent pas dans le navigateur, redémarrer `npm run dev` (cf. [[prototype-cache-contract]] / `docs/...`).

- [ ] **Step 5: Commit final éventuel**

Aucun changement de code à cette étape (vérification seule). Si Step 1/2/3 a nécessité une correction, la committer :
```bash
git add -A && git commit -m "fix(pro): corrections post-vérification Lot A"
```

---

## Self-Review (effectuée)

- **Couverture spec :** A1 (Task 4), A2 (Tasks 1+2), A3 (Task 3), A4 (Task 5), vérification (Task 6) — les 4 changements + la vérif du spec sont couverts.
- **Placeholders :** aucun « TBD/TODO » ; tout le code old/new est explicite.
- **Cohérence types/noms :** noms de fichiers, props (`Icon` `color`/fallback `currentColor`), libellés cohérents entre tâches ; tokens couleur identiques au spec (`#FEF2F2`, `#FCA5A5`, `#B91C1C`).
- **Ordre :** la pré-vérification LinkedIn (Task 1) précède son retrait (Task 2) ; les autres tâches sont indépendantes.
