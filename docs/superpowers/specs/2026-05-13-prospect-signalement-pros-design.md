# Signalement des professionnels par les prospects — design

**Statut** : draft · **Date** : 2026-05-13 · **Auteur** : jcurt64 (via Claude)

## 1. Contexte et objectif

Les prospects subissent parfois des comportements non conformes au règlement
BUUPP de la part des professionnels qui les sollicitent :

- relances multiples interdites par le règlement,
- comptes douteux qui ne semblent pas correspondre à une vraie entreprise,
- échanges déplaisants (ton agressif, pression, propos déplacés).

Aujourd'hui le prospect n'a aucun moyen de signaler ces abus depuis son
espace. L'objectif est de lui donner un canal léger et clair pour le faire
depuis la fiche d'une mise en relation, et que l'équipe BUUPP retrouve ces
signalements dans le back-office pour les traiter au cas par cas.

Hors périmètre :
- pas d'auto-blocage du pro,
- pas d'auto-détection serveur d'une seconde sollicitation,
- pas d'email envoyé au prospect ni au pro,
- pas de vue « mes signalements » côté prospect.

## 2. Parcours utilisateur

### 2.1 Côté prospect

1. Le prospect ouvre l'onglet « Mises en relation » puis clique sur le « + »
   d'une card en attente, ou sur une ligne de l'historique → la modale
   `RelationDetailModal` s'ouvre.
2. En bas de la modale, à gauche des actions principales, un lien discret
   **« Signaler ce professionnel »** est visible si la relation n'a pas déjà
   été signalée.
3. Au clic, une sous-modale `ReportProModal` s'ouvre par-dessus la modale de
   détail.
4. Le prospect choisit un motif parmi trois cartes radio :

   - **Sollicitation multiple** — « Ce professionnel m'a contacté plus
     d'une fois. C'est interdit par le règlement BUUPP. »
   - **Faux compte** — « Je doute qu'il s'agisse d'une vraie société. Le
     pro ne semble pas légitime. »
   - **Échange abusif** — « L'attitude du professionnel n'a pas été
     correcte (ton, propos, pression…). »

5. Il peut optionnellement ajouter un commentaire libre (1000 caractères
   max, compteur visible).
6. Il valide via **« Envoyer le signalement »**. La sous-modale affiche un
   état de succès (« Signalement transmis. Notre équipe le traitera. ») puis
   se referme automatiquement après ~2 s.
7. À la prochaine ouverture de la modale de détail pour cette relation, le
   lien « Signaler » est remplacé par une chip neutre **« Signalement déjà
   transmis »** (read-only).

### 2.2 Côté admin

1. Un nouvel onglet **« Signalements »** apparaît dans la nav latérale du
   back-office entre « Non atteint » et « Professionnels ».
2. La page liste les signalements avec :
   - 3 KPI en haut (À traiter · Traités sur 30 j · Total par motif),
   - filtres : motif, statut (ouvert / traité / tous), période,
   - une carte par signalement (motif, pro cliquable, prospect cliquable,
     contexte campagne, commentaire prospect, statut).
3. L'admin peut cliquer **« Marquer traité »** sur une carte : une textarea
   optionnelle s'ouvre pour saisir une note interne ; à la soumission le
   signalement passe en statut « Traité le … par … » et sort des « À
   traiter » par défaut.
4. Un signalement traité peut être rouvert via **« Rouvrir »**.
5. En parallèle, chaque signalement apparaît dans le **LiveFeed** de la page
   d'accueil admin avec sévérité `warning` (cadre ambre), icône drapeau, et
   un lien direct vers la page Signalements.

## 3. Modèle de données

### 3.1 Nouvelle table `public.relation_reports`

```sql
create type public.relation_report_reason as enum (
  'sollicitation_multiple',
  'faux_compte',
  'echange_abusif'
);

create table public.relation_reports (
  id uuid primary key default gen_random_uuid(),
  relation_id uuid not null references public.relations(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  pro_account_id uuid not null references public.pro_accounts(id) on delete cascade,
  reason public.relation_report_reason not null,
  comment text check (comment is null or length(comment) <= 1000),
  resolved_at timestamptz,
  resolved_by_clerk_id text,
  resolved_note text check (resolved_note is null or length(resolved_note) <= 1000),
  created_at timestamptz not null default now(),
  unique (relation_id)
);

create index relation_reports_created_at_idx
  on public.relation_reports (created_at desc);
create index relation_reports_open_idx
  on public.relation_reports (created_at desc)
  where resolved_at is null;
create index relation_reports_pro_idx
  on public.relation_reports (pro_account_id, created_at desc);

alter table public.relation_reports enable row level security;
-- Aucune policy : tout passe par service_role (même pattern que admin_events).
```

`unique (relation_id)` impose la règle métier « un signalement max par
relation ». L'API renvoie `409 conflict` si l'insert viole la contrainte.

### 3.2 Contrainte sur l'origine du signalement

Côté API on vérifie que `relation.prospect_id == ensureProspect(clerkUserId)`
avant insertion. Le `prospect_id` et le `pro_account_id` stockés sont copiés
depuis la relation (pas fournis par le client) pour éviter toute injection.

### 3.3 Convention de migration

Le projet est dans l'état « migrations divergées local / remote » → ne pas
utiliser `supabase db push`. Le fichier de migration est créé sous
`supabase/migrations/<ts>_relation_reports.sql`, la migration est appliquée
manuellement via SQL Editor puis enregistrée avec `supabase migration repair`
(voir mémoire `supabase-migrations`).

## 4. API

### 4.1 `POST /api/prospect/relations/[id]/report`

- Auth Clerk requise (`auth()` + `ensureProspect`).
- Body : `{ reason: 'sollicitation_multiple' | 'faux_compte' | 'echange_abusif', comment?: string }`.
- Étapes :
  1. Lecture de la relation cible (admin client). 404 si introuvable.
  2. Vérification `relation.prospect_id === prospectId`. 403 sinon.
  3. Validation du `reason` (enum) et du `comment` (≤ 1000 chars, trim, vide → null).
  4. Insert dans `relation_reports`. Si violation unique → `409 already_reported`.
  5. `recordEvent({ type: 'prospect.report', severity: 'warning', prospectId, proAccountId, relationId, payload: { reason, hasComment } })`.
  6. Réponse `200 { id, createdAt }`.

Comportement fire-and-forget pour `recordEvent` (la création réussit même si
le record d'event échoue, comme partout ailleurs).

### 4.2 Extension `GET /api/prospect/relations`

Le handler enrichit chaque entrée (pending + history) avec
`reported: boolean` calculé par jointure sur `relation_reports` (existence
d'une ligne pour cette relation). Pas besoin de renvoyer la raison au front
prospect.

### 4.3 `GET /api/admin/reports`

- Auth admin (même garde que les autres routes `/api/admin/...`).
- Query string : `status=open|resolved|all` (défaut `open`), `reason=...`,
  `period=7d|30d|90d|all`.
- Renvoie un tableau de signalements enrichis (jointures pro + prospect +
  campagne) prêts pour l'UI.

### 4.4 `POST /api/admin/reports/[id]/resolve`

- Auth admin.
- Body : `{ action: 'resolve' | 'reopen', note?: string }`.
- `resolve` : set `resolved_at = now()`, `resolved_by_clerk_id = adminClerkId`,
  `resolved_note = note ?? null`.
- `reopen` : remet `resolved_at`, `resolved_by_clerk_id`, `resolved_note` à
  null.
- `recordEvent({ type: 'admin.report_resolved' | 'admin.report_reopened', severity: 'info', … })` (trace audit légère).

## 5. UI prospect

### 5.1 Modification de `RelationDetailModal` (Prospect.jsx)

Ajout d'un footer secondaire au-dessus de la rangée d'actions
principales :

- Si `r.reported` falsy : bouton lien « Signaler ce professionnel » (texte
  rouge discret, icône drapeau, `btn btn-ghost btn-sm`). Ouvre
  `ReportProModal`.
- Si `r.reported` truthy : chip neutre « Signalement déjà transmis » (gris,
  non cliquable).

Le bouton reste visible quel que soit le statut de la relation (pending,
accepted, settled, refused, expired) — un prospect peut signaler une
sollicitation multiple sans avoir pris de décision, ou un faux compte
constaté juste à la lecture de la demande.

### 5.2 Nouveau composant `ReportProModal`

Fichier : ajouté dans `public/prototype/components/Prospect.jsx` à la suite
de `RelationDetailModal` (même fichier — pas de séparation de fichiers
pour le prototype JSX).

Props : `{ relation, onClose, onSubmitted }`.

Structure visuelle (réutilise `ModalShell` existant) :

- Titre : « Signaler un comportement ».
- Sous-titre rappelant le pro (avatar + raison sociale + secteur).
- Liste verticale de 3 cartes radio (clic sur toute la carte) :
  - Header chip motif + bold label + paragraphe d'aide.
  - L'option sélectionnée prend une bordure accent.
- Textarea optionnelle (placeholder « Ajouter un détail à l'attention de
  l'équipe BUUPP (facultatif) »). Compteur `N / 1000` en bas à droite.
- Pied de modale :
  - bouton « Annuler » (ghost),
  - bouton « Envoyer le signalement » (primary, disabled tant qu'aucun
    motif sélectionné).
- En cas d'erreur API : message rouge inline sous la textarea (« Une erreur
  est survenue, merci de réessayer. »).
- En cas de succès : la modale bascule sur un état confirmatif (icône
  check + « Signalement transmis. Notre équipe le traitera. ») puis se
  ferme automatiquement après ~2 s. Le parent `RelationDetailModal` met à
  jour son état local pour afficher la chip « Signalement déjà transmis »
  (sans attendre un re-fetch complet).

Accessibilité : focus initial sur le bouton « Annuler », `aria-modal`,
escape pour fermer.

## 6. UI admin

### 6.1 Nouvelle entrée nav

`app/buupp-admin/_components/AdminShell.tsx` — insérer entre
« Non atteint » et « Professionnels » :

```ts
{ href: "/buupp-admin/signalements", label: "Signalements" },
```

### 6.2 Page `/buupp-admin/signalements`

Server component (modèle : `/buupp-admin/non-atteint`).

Structure :

- En-tête identique au modèle non-atteint (eyebrow « Anti-fraude · Pros »,
  titre, paragraphe descriptif court).
- Trois cartes KPI : « À traiter », « Traités 30j », « Total période ».
- Une mini ligne de répartition par motif (3 valeurs, format chips chiffrés).
- Filtres (form GET, server-side) :
  - Statut (`open` / `resolved` / `all`).
  - Motif (`all` / `sollicitation_multiple` / `faux_compte` / `echange_abusif`).
  - Période (`7d` / `30d` / `90d` / `all`).
- Liste de cartes signalement (`ReportCard`, server component) :
  - Chip motif coloré (rouge `echange_abusif`, ambre `sollicitation_multiple`, neutre `faux_compte`).
  - **Pro** : lien `/buupp-admin/pros/[id]` (raison sociale).
  - **Prospect** : lien `/buupp-admin/prospects/[id]` (prénom + initiale nom).
  - Contexte : nom de la campagne, motif de la campagne tronqué, date de
    sollicitation.
  - Commentaire du prospect (italique, dans une boîte beige) si présent.
  - Statut :
    - ouvert → bouton client « Marquer traité » qui ouvre un petit pop-in
      avec textarea note (≤ 1000 chars), submit POST `/api/admin/reports/[id]/resolve`,
    - résolu → badge « Traité le … par … » + bouton « Rouvrir » (POST
      `action: 'reopen'`).
- Pagination simple : 50 par page, query param `?page=`.

### 6.3 Composants

- `lib/admin/queries/reports.ts` : fonctions `fetchReportsList(opts)` et
  `fetchReportsKpis(opts)` (service_role, jointures pro + prospect +
  campagne via Postgres).
- `app/buupp-admin/signalements/page.tsx` : page server component.
- `app/buupp-admin/signalements/_components/ReportCard.tsx` : carte
  individuelle (server pour le rendu, mais le bouton « Marquer traité »
  est un client component minimal `ResolveButton`).
- `app/buupp-admin/signalements/_components/ResolveButton.tsx` : client
  component qui gère l'ouverture du pop-in textarea + fetch POST.

### 6.4 LiveFeed

`app/buupp-admin/_components/eventMeta.ts` — ajouter :

```ts
"prospect.report": {
  icon: "🚩",
  label: "Signalement prospect",
  subLine: (ev) => {
    const reasonLabels: Record<string, string> = {
      sollicitation_multiple: "Sollicitation multiple",
      faux_compte: "Faux compte",
      echange_abusif: "Échange abusif",
    };
    const reason = String(ev.payload?.reason ?? "");
    return reasonLabels[reason] ?? "Signalement";
  },
  link: () => "/buupp-admin/signalements?status=open",
},
```

## 7. Sécurité

- L'API prospect rejette tout signalement où la relation n'appartient pas au
  prospect Clerk-authentifié (403).
- Le `pro_account_id` et le `prospect_id` sont dérivés serveur, jamais lus
  du body.
- La contrainte `unique (relation_id)` empêche le spam à l'API : un même
  prospect ne peut signaler qu'une fois par relation.
- Pas de rate-limit additionnel : la contrainte unique + le fait qu'on doive
  avoir une relation existante limitent naturellement l'abus.
- Les commentaires libres (`comment`, `resolved_note`) sont bornés à 1000
  caractères côté DB (check constraint) ET côté API.
- Pas de policy RLS publique : tout passe par `service_role` côté route
  handler, comme `admin_events`.

## 8. Découpage proposé

1. **Migration SQL** (table + enum + indexes), à appliquer via SQL Editor +
   `migration repair`.
2. **API prospect** : nouveau route handler `/api/prospect/relations/[id]/report`
   et extension du handler `GET /api/prospect/relations` (champ `reported`).
3. **UI prospect** : `ReportProModal` + bouton dans `RelationDetailModal`,
   wiring fetch + état optimiste.
4. **API admin** : `GET /api/admin/reports`, `POST /api/admin/reports/[id]/resolve`,
   helpers `lib/admin/queries/reports.ts`.
5. **UI admin** : page `/buupp-admin/signalements`, composants
   `ReportCard` + `ResolveButton`, entrée nav, entrée `eventMeta`.
6. **Vérif end-to-end** : signaler depuis la page prospect, vérifier
   apparition LiveFeed + page Signalements, marquer traité, rouvrir.

## 9. Risques

- **Migration divergée** : appliquer par SQL Editor strictement, sinon
  reset complet local. Vérifier `supabase migration repair` après application.
- **Conflit unique** : si un prospect re-signale rapidement (double clic), le
  front doit gérer le `409` comme un succès silencieux (la chip « déjà
  transmis » s'affichera au prochain render).
- **Pas de notif au pro** : volontaire — le signalement reste interne,
  l'admin tranche. Documenter explicitement dans le commit pour éviter une
  future PR « notification pro » qui casserait cette propriété.
