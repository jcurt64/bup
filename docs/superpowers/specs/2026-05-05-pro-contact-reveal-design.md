# Pro contact reveal — design

**Date :** 2026-05-05
**Scope :** permettre au pro de contacter un prospect (téléphone / email) directement depuis l'onglet « Mes contacts » de la page Pro, avec révélation à la demande et traçabilité.

## Contexte

Aujourd'hui, dans `app/api/pro/contacts/route.ts`, l'email et le téléphone des prospects acceptés sont renvoyés masqués (`maskEmail`, `maskPhone`). Les boutons d'action 📞 / ✉️ dans la table « Mes contacts » de `public/prototype/components/Pro.jsx` (~ligne 2486) ne sont pas câblés — ils n'ouvrent rien.

L'objectif : transformer ces boutons en mécanismes de contact direct (`tel:` / `mailto:`), tout en préservant la promesse de watermarking (« coordonnées accessibles dans l'interface uniquement ») via un endpoint de révélation à la demande qui logue chaque accès.

## Décisions de conception

1. **UX = modal de révélation.** Le clic sur 📞 / ✉️ ouvre un modal qui affiche la valeur en clair + un CTA `tel:` / `mailto:`. Cohérent avec le « watermarking appliqué à chaque fiche » déjà annoncé dans la section.
2. **Audit = table dédiée `pro_contact_reveals`.** Une nouvelle migration crée la table. Pas seulement un console log : permet d'exposer plus tard l'historique côté pro et côté prospect.
3. **Reveal = à l'ouverture du modal.** Pas de double confirmation. Le clic initial sur le bouton est l'intention. Un avertissement « Cet accès est tracé » est affiché dans le modal sans bloquer.
4. **Pas de rate-limiting** dans cette première version. Pourra être ajouté plus tard via une lecture sur `pro_contact_reveals` (count fenêtre glissante).
5. **Pas de stockage de la valeur révélée** dans le log d'audit, seulement le fait qu'il y a eu accès (RGPD, donnée minimale).

## Architecture

```
[Mes contacts (Pro.jsx)]
  └─ ligne r → bouton 📞/✉️ (disabled si donnée non partagée)
       ↓ onClick
  └─ <RevealContactModal relationId field name>
       ↓ on mount
       POST /api/pro/contacts/[relationId]/reveal { field }
       ↓ 200
       ┌─ insert pro_contact_reveals (pro_account_id, relation_id, field)
       └─ select prospect_identity.{email|telephone}
       ↓ retourne { value }
       Modal affiche la valeur + CTA tel:/mailto:
```

## Composants

### 1. Migration SQL

Nouveau fichier : `supabase/migrations/20260505040000_pro_contact_reveals.sql`.

```sql
-- Audit log: chaque révélation (clic) d'un email/téléphone par un pro.
create table public.pro_contact_reveals (
  id              uuid primary key default gen_random_uuid(),
  pro_account_id  uuid not null references public.pro_accounts(id) on delete cascade,
  relation_id     uuid not null references public.relations(id)    on delete cascade,
  field           text not null check (field in ('email','telephone')),
  revealed_at     timestamptz not null default now()
);

create index pro_contact_reveals_pro_idx
  on public.pro_contact_reveals(pro_account_id, revealed_at desc);
create index pro_contact_reveals_relation_idx
  on public.pro_contact_reveals(relation_id, revealed_at desc);

alter table public.pro_contact_reveals enable row level security;
-- Pas de policy: l'admin client (service_role) lit/écrit, anon/auth ne peuvent rien.
```

### 2. `GET /api/pro/contacts` — modifications

Fichier : `app/api/pro/contacts/route.ts`.

Ajouter deux flags au mapping `rows.map(...)` :

```ts
emailAvailable: !!ident?.email,
telephoneAvailable: !!ident?.telephone,
```

Aucun changement de signature breaking. Les champs `email` et `telephone` continuent d'être renvoyés masqués (inchangé). Les flags servent à l'UI pour griser les boutons quand la donnée n'est pas disponible — évite un aller-retour serveur pour rien.

### 3. `POST /api/pro/contacts/[relationId]/reveal` — nouveau

Fichier : `app/api/pro/contacts/[relationId]/reveal/route.ts`.

**Contrat :**
- **Body :** `{ field: "email" | "telephone" }`
- **200 :** `{ value: string }` (valeur en clair)
- **400 :** `field` invalide ou body malformé
- **401 :** non authentifié (pas de Clerk session)
- **403 :** relation introuvable, n'appartient pas au pro authentifié, ou statut hors `accepted`/`settled`
- **404 :** `{ error: "not_shared" }` si la donnée existe en base mais est `null`/vide

**Logique :**

1. `auth()` Clerk → `userId` ; `currentUser()` → email (pour `ensureProAccount`).
2. `ensureProAccount({ clerkUserId, email })` → `proId`.
3. `await req.json()` ; valider `field ∈ {"email","telephone"}`. Sinon **400**.
4. `admin.from("relations").select("status, pro_account_id, prospects:prospect_id(prospect_identity(email, telephone))").eq("id", relationId).maybeSingle()`.
5. Si row absente OU `pro_account_id !== proId` → **403**.
6. Si `status` ∉ `["accepted","settled"]` → **403**.
7. Lire `ident.email` / `ident.telephone`. Si `null/empty` → **404** `{ error: "not_shared" }`.
8. **Insérer** dans `pro_contact_reveals` `(pro_account_id, relation_id, field)`. Si erreur, log côté serveur via `console.error` mais **continuer** (l'audit ne doit pas casser le service).
9. Retourner `{ value }`.

### 4. UI — `Pro.jsx`

#### 4a. Boutons d'action

Dans la table « Mes contacts » (~ligne 2486), remplacer les deux boutons par des handlers qui ouvrent le modal et qui sont désactivés si la donnée n'est pas disponible :

```jsx
<button
  className="btn btn-ghost btn-sm"
  style={{ padding: '4px 8px', opacity: r.telephoneAvailable ? 1 : 0.3, cursor: r.telephoneAvailable ? 'pointer' : 'not-allowed' }}
  disabled={!r.telephoneAvailable}
  title={r.telephoneAvailable ? 'Appeler ce prospect' : "Le prospect n'a pas partagé son téléphone"}
  onClick={() => setReveal({ relationId: r.relationId, field: 'telephone', name: r.name })}
>
  <Icon name="phone" size={12}/>
</button>

<button
  className="btn btn-ghost btn-sm"
  style={{ padding: '4px 8px', opacity: r.emailAvailable ? 1 : 0.3, cursor: r.emailAvailable ? 'pointer' : 'not-allowed' }}
  disabled={!r.emailAvailable}
  title={r.emailAvailable ? 'Envoyer un email' : "Le prospect n'a pas partagé son email"}
  onClick={() => setReveal({ relationId: r.relationId, field: 'email', name: r.name })}
>
  <Icon name="email" size={12}/>
</button>
```

État local dans `Contacts()` : `const [reveal, setReveal] = useState(null);`

À la fin du JSX du composant `Contacts()`, monter le modal :

```jsx
{reveal && (
  <RevealContactModal
    relationId={reveal.relationId}
    field={reveal.field}
    name={reveal.name}
    onClose={() => setReveal(null)}
  />
)}
```

#### 4b. Composant `RevealContactModal`

Nouveau composant dans `Pro.jsx` (à proximité de `Contacts`).

**Props :** `relationId`, `field` (`"email" | "telephone"`), `name`, `onClose`.

**État interne :** `status: "loading" | "ok" | "not_shared" | "error"`, `value: string | null`.

**Effet de mount :**

```jsx
useEffect(() => {
  let cancelled = false;
  fetch(`/api/pro/contacts/${relationId}/reveal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ field }),
  })
    .then(async r => {
      if (cancelled) return;
      if (r.status === 404) { setStatus('not_shared'); return; }
      if (!r.ok)            { setStatus('error');       return; }
      const j = await r.json();
      setValue(j.value); setStatus('ok');
    })
    .catch(() => { if (!cancelled) setStatus('error'); });
  return () => { cancelled = true; };
}, [relationId, field]);
```

**Rendu (cas succès, téléphone) :**

```
┌──────────────────────────────────────────┐
│ 📞 Contacter Jean D.                  ✕ │
├──────────────────────────────────────────┤
│                                          │
│       +33 6 12 34 56 78                  │
│       (mono, gros, sélectionnable)       │
│                                          │
│  [ 📞 Appeler maintenant ]               │
│                                          │
│  ⓘ Cet accès a été enregistré dans       │
│    votre historique de consultations.    │
└──────────────────────────────────────────┘
```

- CTA principal = `<a href={field === 'telephone' ? `tel:${cleanedValue}` : `mailto:${value}`}>` stylé en `btn btn-primary`.
- Pour `tel:`, nettoyer la valeur : `value.replace(/[^\d+]/g, '')`.
- Pour `mailto:`, valeur brute, encodée via `encodeURIComponent` pour être safe en URL.
- Loader pendant `status === "loading"` (spinner ou texte « Récupération… »).
- `status === "not_shared"` : message « Le prospect n'a pas partagé ce contact pour cette campagne. » + bouton Fermer.
- `status === "error"` : message générique « Impossible de récupérer le contact. Réessayez. » + Fermer.
- Backdrop semi-transparent ; clic backdrop ou ✕ → `onClose()`.
- Réutilisation des classes existantes (`card`, `btn`, `mono`). Pas de nouveau CSS global.
- `mailto:` est un `mailto:<value>` nu (pas de subject pré-rempli — option déclinée pour rester simple).

## Sécurité

- **Authentification :** Clerk via `auth()` ; rejet 401 si absent.
- **Autorisation :** la relation doit appartenir au `pro_account_id` du pro authentifié, et son statut doit être `accepted` ou `settled`. Toute autre situation → 403.
- **Donnée minimisée :** la valeur en clair n'est jamais renvoyée par `/api/pro/contacts` (qui sert la table). Elle n'apparaît qu'en réponse au `POST /reveal`, pour la relation cible, à la demande explicite du pro.
- **Audit :** chaque appel réussi insère une ligne dans `pro_contact_reveals` (pas de stockage de la valeur, juste le fait qu'il y a eu accès).
- **RLS :** activée sur `pro_contact_reveals`, sans policy → seul le service-role peut écrire/lire (cohérent avec le modèle existant).
- **CSRF :** non applicable, JSON body + Clerk session ; même politique que les autres endpoints `/api/pro/*` du projet.

## Cas limites

- **Donnée NULL en base** (le prospect n'a pas saisi son téléphone alors que le palier 1 a été partagé) → 404, modal affiche « non partagé ». Côté UI, le bouton est déjà désactivé via le flag `*Available` envoyé par `GET /api/pro/contacts`.
- **Relation expirée / refusée** entre le moment où l'UI charge et le clic → 403, modal affiche « erreur ».
- **Pro qui change de compte** entre le chargement et le clic → 403.
- **Échec d'insert audit** → on log côté serveur, on retourne quand même la valeur (audit best-effort, ne casse pas l'usage).
- **Réseau down côté client** → `status === "error"`, message générique, possibilité de fermer/réessayer.

## Tests

À cadrer dans le plan d'implémentation. Au minimum :
- Test API : 200 happy path, 400 field invalide, 401 sans auth, 403 wrong pro, 403 status non-accepted, 404 ident.email NULL.
- Vérification côté SQL que `pro_contact_reveals` reçoit bien la ligne en cas de 200.
- Test UI manuel : ouverture modal, valeur affichée, clic CTA déclenche bien le `tel:`/`mailto:`, bouton désactivé quand `*Available === false`.

## Hors scope (à reporter)

- Historique des consultations affiché au pro (« vous avez consulté ce numéro 5 fois »).
- Notification au prospect (« 3 pros ont consulté votre email »).
- Rate-limiting / quotas par pro.
- Sujet pré-rempli pour `mailto:`.
- Logique différenciée `accepted` vs `settled` dans le log.
