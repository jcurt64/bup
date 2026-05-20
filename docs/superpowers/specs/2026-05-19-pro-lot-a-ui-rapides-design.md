# Espace Pro — Lot A : retraits & restylages UI rapides — Design

Date : 2026-05-19
Statut : approuvé (design), prêt pour planification d'implémentation

## Contexte

Demande utilisateur portant sur ~10 changements hétérogènes de l'espace
Pro. Après audit et décomposition, le périmètre a été scindé en 5 lots
indépendants (A → E). Ce spec couvre **uniquement le Lot A** : trois
modifications UI à faible risque, sans logique métier ni accès données.

Lots suivants (hors périmètre, specs séparés) : B (filtre fonctionnel +
Facturation données réelles), C (parité SIRET/SIREN + réconciliation
défaut pixel CNIL), D (suggestions persistées + vue admin), E
(suppression de compte récupérable 30 j).

## Périmètre

Toutes les modifications sont dans le seul fichier
`public/prototype/components/Pro.jsx` (UI du prototype rendu en
navigateur). **Aucune route `/api/*`, aucun schéma Supabase, aucune
logique métier modifiés.**

Cross-impact mobile : **aucun impact fonctionnel**. `Pro.jsx` est la
source de vérité miroir mobile, mais ces changements sont purement
cosmétiques côté web. Une éventuelle parité visuelle sur l'app mobile
(RN/Expo) relève d'une demande explicite séparée et n'est pas couverte
ici.

## Décisions de conception (validées)

1. **Palette rouge** : réutiliser les tokens déjà présents dans
   `Pro.jsx` pour rester cohérent — fond `#FEF2F2`, accent fort
   `#B91C1C`. Pas d'introduction de nouvelle variable CSS.
2. Le bouton « Filtrer » du détail de campagne **n'est pas touché**
   (sa mise en fonction est le Lot B).
3. Les cartes « Abonnement actuel » et « Carte enregistrée » de
   Facturation **gardent leur contenu actuel tel quel** (leurs vraies
   données = Lot B). Seule la carte « Renouvellement » est retirée.
4. L'entrée `linkedin` est retirée **à la fois** du tableau `buttons`
   et de `REVEAL_INTENTS` (pas de code mort), sous réserve qu'aucune
   autre référence à l'intent `'linkedin'` ne subsiste (vérif en phase
   plan).

## Changements détaillés

### A1 — Campagnes : retrait du bouton « Exporter CSV »

- Fichier : `public/prototype/components/Pro.jsx`
- Emplacement : ligne ~6962, dans la section « Contacts obtenus » du
  détail de campagne (`tab === 'contacts'`).
- Action : supprimer l'élément
  `<button className="btn btn-ghost btn-sm"><Icon name="download" size={12}/> Exporter CSV</button>`.
- Le bouton « Filtrer » (ligne ~6961) reste inchangé ; le conteneur
  `<div className="row gap-2">` ne contient alors plus que « Filtrer ».
- Résultat attendu : plus aucun bouton d'export dans le détail de
  campagne ; le bouton « Filtrer » reste affiché, toujours non
  fonctionnel (inchangé).

### A2 — Mes contacts : retrait du bouton LinkedIn

- Fichier : `public/prototype/components/Pro.jsx`
- Emplacements :
  - Tableau `buttons` de `ContactActionButtons` (lignes ~4874-4881) :
    supprimer l'objet `{ key: 'linkedin', channel: 'linkedin', … }`.
  - `REVEAL_INTENTS` (ligne ~4807) : supprimer l'entrée `linkedin: { … }`.
- Pré-condition vérifiée en phase plan : aucune autre occurrence de
  l'intent `'linkedin'` (recherche `linkedin` dans `Pro.jsx`) hors ces
  deux emplacements ; sinon adapter.
- Résultat attendu : le bouton LinkedIn disparaît de la barre d'actions
  de contact ; Facebook et les autres canaux (call/email/sms/whatsapp)
  restent inchangés ; aucun code mort résiduel.

### A3 — Mes contacts : « Politique d'usage » en encart d'alerte rouge clair

- Fichier : `public/prototype/components/Pro.jsx`
- Emplacement : carte « Politique d'usage » (lignes ~4751-4758).
- État actuel : `<div className="card" style={{ padding:16,
  background:'var(--ivory-2)', borderStyle:'dashed' }}>` avec icône
  `shield`, `<strong>Politique d'usage.</strong>` puis corps en
  `className="muted"`.
- Action — transformer en encart d'alerte :
  - conteneur : `background: '#FEF2F2'`,
    `border: '1px solid #FCA5A5'`,
    `borderLeft: '4px solid #B91C1C'`,
    (retrait de `borderStyle:'dashed'` et de `background:'var(--ivory-2)'`),
    `padding: 16` conservé.
  - `<Icon name="shield" size={16}/>` : couleur `#B91C1C`.
  - `<strong>Politique d'usage.</strong>` : couleur `#B91C1C`.
  - corps (actuellement `className="muted"`) : retirer `muted`, couleur
    `#B91C1C` à ~75 % d'opacité (ex. `color: 'rgba(185,28,28,.75)'`).
- Le texte du message reste **identique** (seul le style change).
- Résultat attendu : carte visuellement traitée comme un avertissement
  rouge clair, attirant l'attention, message inchangé.

### A4 — Facturation : retrait de la carte « Renouvellement »

- Fichier : `public/prototype/components/Pro.jsx`
- Emplacements :
  - Tableau des cartes KPI (ligne ~6024) : supprimer l'entrée
    `['Renouvellement', '02 mai 2026', 'Prélèvement auto.']`.
  - Grille (ligne ~6015) : passer
    `gridTemplateColumns: 'repeat(3, 1fr)'` →
    `gridTemplateColumns: 'repeat(2, 1fr)'`.
- Les deux cartes restantes (« Abonnement actuel », « Carte
  enregistrée ») conservent leur contenu actuel.
- Résultat attendu : 2 cartes équilibrées sur la ligne, plus aucune
  mention de renouvellement automatique (cohérent : il n'y a pas de
  renouvellement automatique d'abonnement).

## Vérification

- `npx tsc --noEmit` (projet) : 0 erreur.
- `npx eslint` sur les fichiers touchés : 0 erreur.
- `npx vitest run` : suite verte (inchangée — aucun test ne couvre le
  prototype, mais on s'assure de non-régression).
- Contrôle manuel : recherche `linkedin` dans `Pro.jsx` → ne subsiste
  qu'éventuellement dans des libellés non liés à l'intent supprimé ;
  recherche `Renouvellement` et `Exporter CSV` → absentes des zones
  visées.
- Validation visuelle recommandée via `npm run dev` (non bloquante) :
  détail campagne sans bouton export, barre contacts sans LinkedIn,
  encart politique en rouge clair, Facturation à 2 cartes.

## Hors périmètre

- Rendre « Filtrer » fonctionnel (Lot B).
- Vraies données « Abonnement actuel » / « Carte enregistrée » (Lot B).
- Toute modification d'API, de schéma, ou de l'app mobile.
