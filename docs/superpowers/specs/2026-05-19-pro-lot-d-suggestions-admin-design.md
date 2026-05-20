# Espace Pro — Lot D : suggestions persistées + triage admin — Design

Date : 2026-05-19
Statut : approuvé (design), prêt pour planification d'implémentation
Approche retenue : **A** (table dédiée + page admin calquée sur Signalements)

## Contexte

Le formulaire « Vos suggestions » (onglet prospect/pro, composant
`SuggestionsPanel` dans `public/prototype/components/Prospect.jsx`) poste
sur `POST /api/me/suggestions`. Aujourd'hui cette route **n'écrit rien en
base** (docstring : « Pas de stockage en DB pour la v1 — l'email reste la
source de vérité ») et **aucune vue admin n'existe**. L'e-mail tombe en
repli silencieux sur `jjlex64@gmail.com` (`BUUPP_SUGGESTIONS_INBOX` non
défini) et un échec d'envoi est avalé (`{ ok:false }` loggé console, non
tracé). Conséquence vécue : un message envoyé est introuvable côté admin.

Lot D issu de la décomposition de la demande Pro multi-items (cf. lots
A/B/C/E). Lots A traités/mergés, C clos sans code.

## Objectif

Rendre les suggestions **durables et exploitables** : persistées en base,
visibles et triables dans l'admin, l'e-mail devenant une simple
notification best-effort.

## Décisions validées

1. **Périmètre admin = triage complet** : liste + filtres
   (statut/période) + KPIs + actions « marquer lu » / « résoudre » /
   « rouvrir » + note de résolution. Calque 1:1 le pattern existant
   `signalements`.
2. **E-mail = best-effort** : la base est la source de vérité. Succès API
   dès que l'insert DB réussit (même si l'e-mail échoue). Échec d'envoi
   tracé dans `admin_events` (plus jamais avalé). Destinataire =
   `BUUPP_SUGGESTIONS_INBOX` sinon `ADMIN_EMAILS` ; suppression du repli
   `jjlex64@gmail.com` codé en dur.
3. **Contrat de réponse `/api/me/suggestions` inchangé** (`{ ok:true }`).

## Architecture

### 1. Table `public.suggestions`

Pattern `relation_reports` : RLS **activé**, **aucune policy** → accès
service_role uniquement.

```sql
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  from_email text,
  from_name  text,
  from_role  text check (from_role is null or from_role in ('prospect','pro')),
  subject    text check (subject is null or length(subject) <= 120),
  message    text not null check (length(message) <= 4000),
  email_sent_at     timestamptz,
  email_message_id  text,
  read_at           timestamptz,
  read_by_clerk_id  text,
  resolved_at       timestamptz,
  resolved_by_clerk_id text,
  resolved_note     text check (resolved_note is null or length(resolved_note) <= 1000),
  created_at timestamptz not null default now()
);
create index suggestions_created_at_idx on public.suggestions (created_at desc);
create index suggestions_unread_idx on public.suggestions (created_at desc) where read_at is null;
alter table public.suggestions enable row level security;
-- aucune policy : service_role only
```

Fichier : `supabase/migrations/<timestamp>_user_suggestions.sql`
(timestamp généré au moment de l'implémentation, format
`YYYYMMDDHHMMSS`).

⚠️ **Application de la migration** ([[supabase-migrations]]) : local et
remote ont divergé. La migration sera **appliquée manuellement via le
SQL Editor Supabase**, puis enregistrée avec
`npx supabase migration repair --status applied <timestamp>`. **Ne PAS
utiliser `supabase db push`.** Le plan d'implémentation détaillera cette
étape manuelle comme une étape explicite (non automatisable).

### 2. Soumission — `POST /api/me/suggestions`

Fichier : `app/api/me/suggestions/route.ts`. Auth + validation
(120/4000 chars, message non vide) **inchangées**.

Nouveau flux après résolution expéditeur (email/nom/rôle) :

1. Tenter l'e-mail via `sendUserSuggestion(...)` — helper modifié pour
   renvoyer `{ ok: boolean; messageId?: string }`. Destinataire :
   `process.env.BUUPP_SUGGESTIONS_INBOX` sinon `process.env.ADMIN_EMAILS`
   (liste séparée par virgules, tous destinataires). Le repli codé en
   dur `jjlex64@gmail.com` est supprimé ; si ni l'un ni l'autre n'est
   défini, l'e-mail est sauté (transport déjà tolérant) — la DB reste la
   source de vérité.
2. Insérer une row `suggestions` via le client service_role
   (`createSupabaseAdminClient`), avec `from_*`, `subject`, `message`,
   `email_sent_at` = now si `ok` sinon null, `email_message_id` =
   `messageId` si présent.
3. Sémantique de réponse :
   - insert DB OK → `{ ok:true }` (200), **même si l'e-mail a échoué**.
   - e-mail KO (mais DB OK) → `void recordEvent({ type:
     'suggestions.email_failed', severity:'warning', payload:{ fromEmail,
     suggestionId } })`.
   - insert DB KO → 502 `{ error:'persist_failed' }` + `void
     recordEvent({ type:'suggestions.persist_failed',
     severity:'critical', payload:{ fromEmail } })`.

`lib/email/user-suggestion.ts` : type de retour passe de `{ ok }` à
`{ ok, messageId? }` ; `messageId` extrait de la réponse Brevo si le
transport l'expose, sinon `undefined` (non bloquant).

### 3. Lecture / triage admin

`lib/admin/queries/suggestions.ts` (calque `lib/admin/queries/reports.ts`) :

```ts
export type SuggestionStatus = 'unread' | 'resolved' | 'all';
export type SuggestionPeriod = '7d' | '30d' | '90d' | 'all';
export type SuggestionListItem = {
  id: string;
  fromEmail: string | null; fromName: string | null; fromRole: string | null;
  subject: string | null; message: string;
  createdAt: string;
  readAt: string | null; readByClerkId: string | null;
  resolvedAt: string | null; resolvedByClerkId: string | null; resolvedNote: string | null;
  emailSentAt: string | null;
};
export async function fetchSuggestionsList(opts: { status: SuggestionStatus; period: SuggestionPeriod; page: number }): Promise<SuggestionListItem[]>;
export async function fetchSuggestionsKpis(opts: { period: SuggestionPeriod }): Promise<{ unread: number; resolved: number; total: number; emailFailed: number }>;
```

- `fetchSuggestionsList` : client service_role, `select('*')`,
  `order('created_at',{ascending:false})`, filtre statut (`unread` →
  `.is('read_at',null)` ; `resolved` → `.not('resolved_at','is',null)`),
  filtre période (`.gte('created_at', cutoff)`), pagination
  `.range(page*50, page*50+49)` (PAGE_SIZE=50). Mapping snake→camel.
- `fetchSuggestionsKpis` : comptes parallèles `unread` (read_at null),
  `resolved` (resolved_at not null), `total` (sur période),
  `emailFailed` (email_sent_at null) — `head:true, count:'exact'`.
- Échec lecture → `[]` / zéros (cohérent avec `reports.ts`).

Page `app/buupp-admin/suggestions/page.tsx` : server component (auth déjà
imposée par `app/buupp-admin/layout.tsx`). `searchParams` validés
(`status` défaut `unread`, `period` défaut `30d`, `page` défaut `0` ;
valeurs hors enum → défaut). `Promise.all([fetchSuggestionsList,
fetchSuggestionsKpis])`. Rendu : en-tête + description, cartes KPI,
formulaire filtres (méthode GET, statut/période), liste de
`SuggestionCard`, pagination (prev/next sur `page`). Calque la structure
de `app/buupp-admin/signalements/page.tsx`.

Navigation : ajouter une entrée « Suggestions » dans la navigation admin,
au même endroit que le lien « Signalements » (localiser le composant de
nav admin à l'implémentation ; suivre le pattern du lien existant).

`app/buupp-admin/suggestions/_components/SuggestionCard.tsx` (calque
`ReportCard.tsx`) : badge statut (Non lu / Résolu / —), `created_at`
formaté, expéditeur (email · nom · rôle), sujet + message (affiché en
entier ; `white-space: pre-wrap`), indicateur e-mail (Envoyé ✓ si
`emailSentAt` sinon Échec ✗), boutons d'action (section 4).

### 4. Mutations admin

`app/api/admin/suggestions/route.ts` :

- `PATCH` : `requireAdminRequest(req)` (404 si non admin) ; body
  `{ id: string; action: 'mark-read'|'resolve'|'reopen'; note?: string }`.
  Identité admin via Clerk `auth()` (userId pour
  `read_by_clerk_id`/`resolved_by_clerk_id`). Updates :
  - `mark-read` → `{ read_at: now, read_by_clerk_id: userId }`
  - `resolve` → `{ resolved_at: now, resolved_by_clerk_id: userId,
    resolved_note: note ?? null }` (+ `read_at`/`read_by` si encore null)
  - `reopen` → `{ resolved_at: null, resolved_by_clerk_id: null,
    resolved_note: null }`
  - action inconnue → 400 `{ error:'invalid_action' }`
  - `update(...).eq('id', id)` via service_role ; `{ ok:true }`.

Boutons : composant client (calque
`app/buupp-admin/signalements/_components/ResolveButton.tsx`) appelant
`PATCH /api/admin/suggestions` puis `router.refresh()`.

## Gestion d'erreurs

- Chemin critique = insert DB (502 + event `critical` si échec).
- E-mail = best-effort (event `warning` si échec, jamais bloquant).
- Lectures admin = dégradation douce (`[]`/zéros), cohérent `reports.ts`.

## Tests

Vitest couvre `lib/` (le prototype et les pages ne sont pas testés
unitairement — cohérent avec le repo).

- `tests/lib/admin/queries/suggestions.test.ts` (calque
  `tests/lib/admin/queries/reports.test.ts`) — écrit **avant**
  l'implémentation (TDD) : mapping statut→filtre, période→cutoff,
  pagination, shaping snake→camel, dégradation `[]` en cas d'erreur.
- Vérification manuelle (non bloquante) : soumettre une suggestion
  (front) → row créée dans `suggestions` → visible dans
  `/buupp-admin/suggestions` (filtre « non lues ») → « marquer lu »
  bascule le badge → « résoudre » + note → filtre « résolues » ; couper
  Brevo (clé invalide) → suggestion quand même persistée + event
  `suggestions.email_failed` visible dans le flux admin.

## Impact mobile / transverse (règle permanente)

- `POST /api/me/suggestions` est **partagé avec le mobile** (app
  prospect/pro RN poste aussi dessus). Contrat de réponse inchangé →
  **aucune modification mobile requise** ; effet de bord positif : les
  suggestions mobiles seront désormais persistées + visibles en admin.
- Table `suggestions` = **changement de schéma sur la base partagée**
  (prod commune web/mobile). Migration appliquée manuellement (SQL
  Editor + `migration repair`), cf. [[supabase-migrations]].
- Vue/route admin = **web-only** (pas d'admin mobile).
- Bilan : zéro code mobile ; coordination uniquement sur la migration DB.

## Hors périmètre

- Répondre à une suggestion depuis l'admin (juste lien mailto éventuel
  plus tard) — non inclus.
- Notifications push/temps réel dédiées au-delà de l'event `admin_events`
  déjà émis.
- Tout changement du composant front `SuggestionsPanel` (le formulaire
  fonctionne déjà ; seul le backend change).
- Lots B et E.
