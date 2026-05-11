# Admin broadcasts → user notifications

Status: approved 2026-05-11

## Goal

Permettre à un admin d'envoyer un message (titre + contenu + pièce jointe
optionnelle) à une audience parmi {tous les prospects, tous les pros, tous les
utilisateurs}. Les destinataires reçoivent le message par email **et** le voient
dans la cloche du header de leur dashboard, avec marquage non lu / lu.

## Data model

### Table `admin_broadcasts`

| col                  | type                  | notes                                       |
|----------------------|-----------------------|---------------------------------------------|
| id                   | uuid PK               | default `gen_random_uuid()`                 |
| title                | text NOT NULL         | max 200 char (validé côté API)              |
| body                 | text NOT NULL         | max 10 000 char                             |
| attachment_path      | text NULL             | path Supabase Storage (bucket privé)        |
| attachment_filename  | text NULL             | nom d'origine pour le download              |
| audience             | enum NOT NULL         | `prospects` \| `pros` \| `all`              |
| created_by_admin_id  | text NOT NULL         | clerk_user_id de l'admin émetteur           |
| created_at           | timestamptz NOT NULL  | default `now()`                             |
| sent_email_at        | timestamptz NULL      | rempli après envoi des emails (best-effort) |

Index : `(audience, created_at desc)` pour les listings utilisateur.

### Table `admin_broadcast_reads`

| col            | type                  |
|----------------|-----------------------|
| broadcast_id   | uuid NOT NULL FK      |
| clerk_user_id  | text NOT NULL         |
| read_at        | timestamptz NOT NULL default `now()` |

PK composite `(broadcast_id, clerk_user_id)`. ON DELETE CASCADE depuis
`admin_broadcasts.id`.

### Storage

Bucket `admin-broadcasts` (privé). Chemin :
`broadcasts/<broadcast_id>/<original_filename>`. Limite 5 Mo (validation API).
Pas de RLS user-facing : on n'expose que via signed URL générée par l'API
`/api/me/notifications/[id]/attachment` après vérif d'éligibilité d'audience.

### RLS

`admin_broadcasts` : lecture authentifiée si la row matche l'audience (
prospect_user / pro_user / all). Insert + update interdits côté client (server
uniquement, admin client). `admin_broadcast_reads` : insert et select sur ses
propres rows (`clerk_user_id = current_clerk_user_id`).

En pratique on bypasse RLS via `createSupabaseAdminClient()` côté API et on
filtre par audience dans la requête — la RLS reste un garde-fou.

## APIs

### Admin

- `POST /api/admin/broadcasts` — multipart/form-data `(title, body, audience,
  attachment?)`. Garde admin via `requireAdminUserOrNotFound`. Validations :
  audience ∈ {prospects, pros, all}, title ≤ 200, body ≤ 10000, attachment ≤
  5 Mo, mimetype dans une allowlist (pdf, png, jpg, jpeg, webp, docx, xlsx,
  txt, md). Crée la row, upload la pièce jointe si présente, lance l'envoi
  email best-effort en fire-and-forget (pas d'attente), retourne `{ id }`.
- `GET /api/admin/broadcasts` — liste paginée des broadcasts (50 derniers),
  pour l'historique. Renvoie `recipient_count` calculé à la volée par audience.

### Utilisateur

- `GET /api/me/notifications` — retourne les broadcasts visibles à l'utilisateur
  courant (selon son rôle DB, cf. `/api/me`), enrichis de `unread: boolean` et
  `has_attachment: boolean`. Trié desc par `created_at`. Cap 100.
- `POST /api/me/notifications/[id]/read` — upsert dans `admin_broadcast_reads`.
  Vérifie l'audience avant insert (interdit de marquer un broadcast d'une
  audience à laquelle on n'appartient pas).
- `GET /api/me/notifications/[id]/attachment` — vérifie l'éligibilité, signe
  l'URL Supabase Storage (TTL 5 min), redirige 302 vers l'URL signée.

## Email

`lib/email/admin-broadcast.ts`. Template HTML aligné sur `lib/email/relation.ts`
(palette ivoire, titre Fraunces, corps DM Sans). CTA principal "Voir le
message" → `https://<APP_URL>/<role>` (laisse l'utilisateur ouvrir la cloche).
Si pièce jointe : second bouton "Télécharger la pièce jointe" pointant vers
`/api/me/notifications/<id>/attachment`. Envoi via `safeSendMail` en boucle sur
les destinataires (BCC évite la personnalisation et complique le tracking
bounces). Une seule liste de destinataires construite via une vue ou deux
requêtes (`prospects` joint à `prospect_identity` pour l'email, `pro_accounts`
joint à Clerk pour l'email). Pour les pros, l'email vient de Clerk
(`clerkClient.users.getUser`) car non stocké en DB — on bulk-fetche avec
`getUserList`.

## Admin UI

- Nouvelle entrée nav dans `AdminShell.tsx` (entre "Waitlist" et "Santé") :
  `{ href: "/buupp-admin/notifications", label: "Notifications" }`.
- Page `/buupp-admin/notifications` (Server Component) qui charge l'historique
  et rend un Client Component `BroadcastComposer.tsx` :
  - Champ titre (input, max 200)
  - Champ contenu (textarea, max 10000, compteur de caractères)
  - Audience (radio group : Tous les prospects / Tous les pros / Tous les
    utilisateurs)
  - Pièce jointe (input file, accept allowlist, max 5 Mo, preview du nom)
  - Bouton "Envoyer" avec confirm modal indiquant le nombre estimé de
    destinataires
  - Sous le composer : table des 50 derniers broadcasts
    (date | audience | titre | destinataires | pièce jointe ? )

## User UI

Dans `Prospect.jsx` (composant `TopBar`, utilisé aussi par Pro.jsx via scope
global) :

- La cloche actuelle devient un bouton qui toggle un dropdown ancré à droite.
- Badge rouge avec compteur si `unread > 0`.
- Dropdown panel (350px desktop) :
  - En-tête "Notifications" + lien "Tout marquer comme lu"
  - Liste scrollable (max 400px), chaque item : pastille rouge si non lu,
    titre, date relative ("il y a 2h"), aperçu du corps tronqué à 80 char.
  - État vide : "Aucune notification pour l'instant."
- Click sur un item → modal popup (réutilise le pattern `SignOutConfirmModal`)
  affichant titre, date, body (white-space pre-line), bouton download si
  pièce jointe, bouton "Fermer". À l'ouverture du modal, on POST mark-as-read.
- Polling : `setInterval` 60 s + sur visibility change (`document.visibilityState
  === 'visible'`) + immédiat au mount.
- Mobile (≤900 px) : le dropdown devient un bottom sheet plein-largeur
  (position fixed bottom 0, max-height 80vh, scrollable). Le modal popup
  reste tel quel — déjà responsive via le pattern existant.

## Files

Nouveaux :
- `supabase/migrations/<ts>_admin_broadcasts.sql`
- `lib/email/admin-broadcast.ts`
- `app/api/admin/broadcasts/route.ts`
- `app/api/me/notifications/route.ts`
- `app/api/me/notifications/[id]/read/route.ts`
- `app/api/me/notifications/[id]/attachment/route.ts`
- `app/buupp-admin/notifications/page.tsx`
- `app/buupp-admin/notifications/_components/BroadcastComposer.tsx`

Édités :
- `app/buupp-admin/_components/AdminShell.tsx` (entrée nav)
- `public/prototype/components/Prospect.jsx` (TopBar bell + dropdown + modal)
- `public/prototype/styles.css` (dropdown panel + bottom sheet responsive)
- `lib/supabase/types.ts` (regen après migration — manuel par l'utilisateur)

## Risques connus

1. **Migrations Supabase divergées** (cf. memory) : l'utilisateur applique la
   migration via SQL Editor + `supabase migration repair`. Pas de `db push`.
2. **Envoi en boucle synchrone** : pour > ~100 destinataires, on s'approche
   du timeout 300 s Vercel. Acceptable au volume actuel. Future option :
   Vercel Queues.
3. **Email pro depuis Clerk** : on dépend de `clerkClient.users.getUserList`
   qui pagine à 500. Pour la v1 (< 500 pros), un seul appel suffit ; au-delà,
   il faudra paginer.

## Out of scope (v1)

- Édition / suppression d'un broadcast après envoi (immuable v1)
- Audiences personnalisées (segments, listes)
- Délai d'envoi planifié / brouillons
- Statistiques d'ouverture email
- Templates pré-définis
