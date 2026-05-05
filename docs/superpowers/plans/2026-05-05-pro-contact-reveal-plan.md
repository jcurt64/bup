# Pro Contact Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au pro de contacter un prospect (téléphone / email) directement depuis l'onglet « Mes contacts » via un modal de révélation à la demande, avec un audit log côté serveur.

**Architecture:** Une nouvelle table `pro_contact_reveals` (audit log), un nouvel endpoint `POST /api/pro/contacts/[relationId]/reveal` qui authentifie, autorise, lit la donnée en clair depuis `prospect_identity` et logue l'accès, et un composant React `RevealContactModal` qui appelle cet endpoint à l'ouverture puis offre un CTA `tel:`/`mailto:`. L'endpoint `GET /api/pro/contacts` est enrichi de deux flags `emailAvailable` / `telephoneAvailable` pour pré-désactiver les boutons quand la donnée n'est pas partagée.

**Tech Stack:** Next.js 16 (App Router, runtime `nodejs`), Supabase (Postgres + service-role admin client), Clerk auth, React 19, prototype CSS classes existantes (`btn`, `card`, `mono`).

**Spec:** `docs/superpowers/specs/2026-05-05-pro-contact-reveal-design.md`

**Verification approach:** Le projet n'a pas de framework de tests automatisés. Vérification = `npm run lint` + `npm run build` (TypeScript) + tests manuels via `curl` contre `npm run dev` + lecture SQL via Supabase MCP. Le test browser est manuel à la fin.

---

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `supabase/migrations/20260505040000_pro_contact_reveals.sql` | **Create** | Crée la table d'audit `pro_contact_reveals` avec RLS activée et index. |
| `app/api/pro/contacts/route.ts` | **Modify** | Ajoute les flags `emailAvailable` / `telephoneAvailable` dans la réponse. |
| `app/api/pro/contacts/[relationId]/reveal/route.ts` | **Create** | Endpoint `POST` qui révèle la donnée en clair et insère une ligne d'audit. |
| `public/prototype/components/Pro.jsx` | **Modify** | Boutons d'actions cliquables + nouveau composant `RevealContactModal`. |

---

## Task 1: Migration — table `pro_contact_reveals`

**Files:**
- Create: `supabase/migrations/20260505040000_pro_contact_reveals.sql`

- [ ] **Step 1: Créer le fichier de migration**

```sql
-- Audit log: chaque révélation (clic) d'un email/téléphone par un pro.
-- Cf. docs/superpowers/specs/2026-05-05-pro-contact-reveal-design.md.
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
-- Pas de policy: seul le service_role (admin client) peut écrire/lire,
-- comme pour les autres tables d'audit/sensibles existantes.
```

- [ ] **Step 2: Appliquer la migration sur la base distante**

Utiliser le MCP Supabase :

```
mcp__plugin_supabase_supabase__apply_migration
  name: "pro_contact_reveals"
  query: <le contenu SQL ci-dessus>
```

Si le projet a un stack Supabase local : `npx supabase db push`. Vérifier d'abord avec `npx supabase migration list` quel mode est utilisé.

- [ ] **Step 3: Vérifier que la table existe**

Via MCP :

```
mcp__plugin_supabase_supabase__execute_sql
  query: "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'pro_contact_reveals';"
```

Expected: 1 row, `pro_contact_reveals`.

- [ ] **Step 4: Vérifier la structure**

```
mcp__plugin_supabase_supabase__execute_sql
  query: "select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'pro_contact_reveals' order by ordinal_position;"
```

Expected: 5 colonnes (`id`, `pro_account_id`, `relation_id`, `field`, `revealed_at`), `id` not null, `field` not null, `revealed_at` not null.

- [ ] **Step 5: Vérifier que RLS est activée**

```
mcp__plugin_supabase_supabase__execute_sql
  query: "select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'pro_contact_reveals';"
```

Expected: `rowsecurity = true`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260505040000_pro_contact_reveals.sql
git commit -m "feat(db): pro_contact_reveals audit table"
```

---

## Task 2: Enrichir `GET /api/pro/contacts` avec les flags d'availability

**Files:**
- Modify: `app/api/pro/contacts/route.ts:88-99`

- [ ] **Step 1: Ajouter les deux flags au mapping**

Localiser le bloc `return { relationId: r.id, … }` (lignes ~88-99) et y ajouter deux lignes juste avant `receivedAt` :

```ts
return {
  relationId: r.id,
  name: maskName(ident?.prenom, ident?.nom),
  score: id?.bupp_score ?? 0,
  campaign: camp?.name ?? "—",
  tier,
  email: maskEmail(ident?.email),
  telephone: maskPhone(ident?.telephone),
  emailAvailable: !!ident?.email,
  telephoneAvailable: !!ident?.telephone,
  receivedAt: r.decided_at,
  evaluation: null as null | "valide" | "difficile" | "invalide",
};
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: pas d'erreur TypeScript dans `app/api/pro/contacts/route.ts`. Si la build échoue ailleurs (non lié), continuer si le compilateur n'a pas signalé d'erreur dans ce fichier.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: pas d'erreur lint dans le fichier modifié.

- [ ] **Step 4: Smoke test contre le dev server**

Démarrer `npm run dev` (background), puis depuis un navigateur authentifié comme pro, ouvrir l'onglet « Mes contacts » de la page Pro et vérifier dans les DevTools (Network → `/api/pro/contacts`) que la réponse contient les nouveaux champs `emailAvailable` et `telephoneAvailable` pour chaque ligne.

Si pas de session pro disponible facilement, sauter ce step et le valider lors du smoke test final (Task 7).

- [ ] **Step 5: Commit**

```bash
git add app/api/pro/contacts/route.ts
git commit -m "feat(pro/contacts): expose email/telephone availability flags"
```

---

## Task 3: Endpoint `POST /api/pro/contacts/[relationId]/reveal` — happy path + audit

**Files:**
- Create: `app/api/pro/contacts/[relationId]/reveal/route.ts`

- [ ] **Step 1: Créer le fichier avec la structure de base**

```ts
/**
 * POST /api/pro/contacts/[relationId]/reveal
 * Body : { field: "email" | "telephone" }
 *
 * Révèle au pro authentifié la valeur en clair de l'email ou du téléphone
 * d'un prospect avec qui il a une relation acceptée/settled. Chaque appel
 * réussi est enregistré dans pro_contact_reveals (audit best-effort).
 *
 * 200 → { value: string }
 * 400 → field invalide
 * 401 → non authentifié
 * 403 → relation introuvable / wrong pro / status non accepted|settled
 * 404 → { error: "not_shared" }  (donnée NULL en base)
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProAccount } from "@/lib/sync/pro-accounts";

export const runtime = "nodejs";

type Field = "email" | "telephone";
type RouteContext = { params: Promise<{ relationId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { relationId } = await ctx.params;
  if (!relationId) {
    return NextResponse.json({ error: "missing_relation_id" }, { status: 400 });
  }

  let body: { field?: Field };
  try {
    body = (await req.json()) as { field?: Field };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const field = body?.field;
  if (field !== "email" && field !== "telephone") {
    return NextResponse.json({ error: "invalid_field" }, { status: 400 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const proId = await ensureProAccount({ clerkUserId: userId, email });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("relations")
    .select(
      `id, status, pro_account_id,
       prospects:prospect_id (
         prospect_identity ( email, telephone )
       )`,
    )
    .eq("id", relationId)
    .maybeSingle();

  if (error) {
    console.error("[/api/pro/contacts/reveal] read failed", error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  type Row = {
    id: string;
    status: string;
    pro_account_id: string;
    prospects: {
      prospect_identity:
        | { email: string | null; telephone: string | null }
        | { email: string | null; telephone: string | null }[]
        | null;
    } | null;
  };
  const row = data as unknown as Row;
  if (row.pro_account_id !== proId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (row.status !== "accepted" && row.status !== "settled") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const prospects = Array.isArray(row.prospects) ? row.prospects[0] : row.prospects;
  const identRaw = prospects?.prospect_identity ?? null;
  const ident = Array.isArray(identRaw) ? identRaw[0] ?? null : identRaw;
  const value = field === "email" ? ident?.email ?? null : ident?.telephone ?? null;
  if (!value) {
    return NextResponse.json({ error: "not_shared" }, { status: 404 });
  }

  // Audit best-effort : on ne casse pas l'usage si l'insert échoue.
  const { error: auditErr } = await admin.from("pro_contact_reveals").insert({
    pro_account_id: proId,
    relation_id: relationId,
    field,
  });
  if (auditErr) {
    console.error("[/api/pro/contacts/reveal] audit insert failed", auditErr);
  }

  return NextResponse.json({ value });
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: pas d'erreur TS dans `app/api/pro/contacts/[relationId]/reveal/route.ts`.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: pas d'erreur lint dans le nouveau fichier.

- [ ] **Step 4: Smoke test 401 (non authentifié)**

Démarrer `npm run dev` (background si pas déjà lancé), puis :

```bash
curl -i -X POST http://localhost:3000/api/pro/contacts/00000000-0000-0000-0000-000000000000/reveal \
  -H "content-type: application/json" \
  -d '{"field":"email"}'
```

Expected: HTTP 401, body `{"error":"unauthorized"}`.

- [ ] **Step 5: Smoke test 400 (field invalide)**

Récupérer un cookie Clerk valide (pro logué) en ouvrant DevTools → Application → Cookies sur `localhost:3000` et copier la valeur de `__session`. Puis :

```bash
curl -i -X POST http://localhost:3000/api/pro/contacts/<any-uuid>/reveal \
  -H "content-type: application/json" \
  -H "cookie: __session=<value>" \
  -d '{"field":"plop"}'
```

Expected: HTTP 400, body `{"error":"invalid_field"}`.

- [ ] **Step 6: Smoke test 200 (happy path)**

Récupérer un `relationId` valide pour le pro authentifié :

```
mcp__plugin_supabase_supabase__execute_sql
  query: "select r.id, pa.clerk_user_id, r.status from relations r join pro_accounts pa on pa.id = r.pro_account_id where r.status in ('accepted','settled') limit 5;"
```

Avec un `relation_id` correspondant au pro logué :

```bash
curl -i -X POST http://localhost:3000/api/pro/contacts/<relation-id>/reveal \
  -H "content-type: application/json" \
  -H "cookie: __session=<value>" \
  -d '{"field":"telephone"}'
```

Expected: HTTP 200, body `{"value":"<numéro en clair>"}` (ou 404 `not_shared` si la donnée est NULL — auquel cas tester avec `field:"email"` qui est plus susceptible d'être renseigné).

- [ ] **Step 7: Vérifier qu'une ligne d'audit a été insérée**

```
mcp__plugin_supabase_supabase__execute_sql
  query: "select pro_account_id, relation_id, field, revealed_at from pro_contact_reveals order by revealed_at desc limit 3;"
```

Expected: au moins une ligne avec le `relation_id` testé au step 6 et le `field` correspondant.

- [ ] **Step 8: Smoke test 403 (relation d'un autre pro)**

Récupérer un `relation_id` qui n'appartient PAS au pro logué :

```
mcp__plugin_supabase_supabase__execute_sql
  query: "select r.id from relations r where r.pro_account_id != (select id from pro_accounts where clerk_user_id = '<clerk-user-id-du-pro-logué>') limit 1;"
```

```bash
curl -i -X POST http://localhost:3000/api/pro/contacts/<other-pro-relation-id>/reveal \
  -H "content-type: application/json" \
  -H "cookie: __session=<value>" \
  -d '{"field":"email"}'
```

Expected: HTTP 403, body `{"error":"forbidden"}`.

- [ ] **Step 9: Commit**

```bash
git add app/api/pro/contacts/[relationId]/reveal/route.ts
git commit -m "feat(pro/contacts): on-demand reveal endpoint with audit log"
```

---

## Task 4: UI — composant `RevealContactModal`

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (ajout d'un nouveau composant à proximité de `Contacts`)

- [ ] **Step 1: Ajouter le composant `RevealContactModal`**

Repérer la fin du composant `Contacts()` (~ligne 2500). Juste après la fermeture du composant `Contacts`, ajouter le composant suivant :

```jsx
function RevealContactModal({ relationId, field, name, onClose }) {
  const [status, setStatus] = React.useState('loading'); // 'loading' | 'ok' | 'not_shared' | 'error'
  const [value, setValue] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/pro/contacts/${relationId}/reveal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ field }),
    })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 404) { setStatus('not_shared'); return; }
        if (!r.ok) { setStatus('error'); return; }
        const j = await r.json();
        setValue(j.value);
        setStatus('ok');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [relationId, field]);

  const isPhone = field === 'telephone';
  const ctaHref = !value
    ? '#'
    : isPhone
      ? `tel:${value.replace(/[^\d+]/g, '')}`
      : `mailto:${encodeURIComponent(value)}`;
  const ctaLabel = isPhone ? 'Appeler maintenant' : 'Ouvrir mon mail';
  const iconName = isPhone ? 'phone' : 'email';
  const title = isPhone ? `Contacter ${name}` : `Écrire à ${name}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,20,20,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: 420, padding: 24 }}
      >
        <div className="row between" style={{ alignItems: 'center', marginBottom: 16 }}>
          <div className="row center gap-2">
            <Icon name={iconName} size={16}/>
            <span className="serif" style={{ fontSize: 18 }}>{title}</span>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Fermer">
            <Icon name="close" size={12}/>
          </button>
        </div>

        {status === 'loading' && (
          <div className="muted" style={{ fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            Récupération du contact…
          </div>
        )}

        {status === 'ok' && (
          <>
            <div
              className="mono"
              style={{ fontSize: 22, padding: '20px 0', textAlign: 'center', userSelect: 'text', wordBreak: 'break-all' }}
            >
              {value}
            </div>
            <a
              href={ctaHref}
              className="btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--ink)', color: 'var(--paper)', textDecoration: 'none',
                padding: '10px 16px', borderRadius: 8, fontWeight: 500,
              }}
            >
              <Icon name={iconName} size={14}/> {ctaLabel}
            </a>
            <div className="muted" style={{ fontSize: 11, marginTop: 14, textAlign: 'center' }}>
              ⓘ Cet accès a été enregistré dans votre historique de consultations.
            </div>
          </>
        )}

        {status === 'not_shared' && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 13 }}>Le prospect n'a pas partagé ce contact pour cette campagne.</div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>
              Fermer
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 13 }}>Impossible de récupérer le contact. Réessayez.</div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier que le code parse**

Démarrer ou recharger `npm run dev`, ouvrir une page de l'app et vérifier dans la console navigateur qu'aucune erreur de parsing n'apparaît. Le composant n'est pas encore monté — c'est juste un check syntaxique.

- [ ] **Step 3: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro/contacts): RevealContactModal component (not yet wired)"
```

---

## Task 5: UI — câbler les boutons d'actions et l'état dans `Contacts()`

**Files:**
- Modify: `public/prototype/components/Pro.jsx` (composant `Contacts`, ~ligne 2372 et ~ligne 2486)

- [ ] **Step 1: Ajouter l'état `reveal` dans `Contacts()`**

Localiser le début du composant `Contacts()` (~ligne 2372). Après la ligne `const [allRows, setAllRows] = React.useState(null);`, ajouter :

```jsx
const [reveal, setReveal] = React.useState(null); // { relationId, field, name } | null
```

- [ ] **Step 2: Remplacer les boutons d'actions par les versions câblées**

Localiser la cellule Actions complète dans la table (le `<td style={{ textAlign: 'right' }}>...</td>` qui contient les deux boutons `Icon name="phone"` et `Icon name="email"`, ~ligne 2485-2490). **Remplacer ce `<td>...</td>` complet** par :

```jsx
<td style={{ textAlign: 'right' }}>
  <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
    <button
      className="btn btn-ghost btn-sm"
      style={{
        padding: '4px 8px',
        opacity: r.telephoneAvailable ? 1 : 0.3,
        cursor: r.telephoneAvailable ? 'pointer' : 'not-allowed',
      }}
      disabled={!r.telephoneAvailable}
      title={r.telephoneAvailable ? 'Appeler ce prospect' : "Le prospect n'a pas partagé son téléphone"}
      onClick={() => setReveal({ relationId: r.relationId, field: 'telephone', name: r.name })}
    >
      <Icon name="phone" size={12}/>
    </button>
    <button
      className="btn btn-ghost btn-sm"
      style={{
        padding: '4px 8px',
        opacity: r.emailAvailable ? 1 : 0.3,
        cursor: r.emailAvailable ? 'pointer' : 'not-allowed',
      }}
      disabled={!r.emailAvailable}
      title={r.emailAvailable ? 'Envoyer un email' : "Le prospect n'a pas partagé son email"}
      onClick={() => setReveal({ relationId: r.relationId, field: 'email', name: r.name })}
    >
      <Icon name="email" size={12}/>
    </button>
  </div>
</td>
```

- [ ] **Step 3: Monter le modal à la fin du JSX de `Contacts()`**

Localiser la fin du JSX retourné par `Contacts()` (juste avant `</div>` de fermeture du `<div className="col gap-6">` à ~ligne 2497-2510). Avant la balise `</div>` racine, ajouter :

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

- [ ] **Step 4: Smoke test browser**

`npm run dev` actif, se connecter en pro avec au moins une relation acceptée :

1. Aller sur la page Pro → onglet « Mes contacts ».
2. Vérifier que les boutons 📞 / ✉️ sont cliquables si la donnée est disponible, grisés sinon.
3. Cliquer sur 📞 d'une ligne où `telephoneAvailable === true` → le modal s'ouvre, affiche « Récupération… », puis le numéro en clair + le bouton « Appeler maintenant ».
4. Vérifier que le clic sur « Appeler maintenant » ouvre l'app téléphone (ou affiche le dialog de confirmation `tel:` du navigateur).
5. Fermer le modal (clic ✕ ou clic backdrop).
6. Tester le bouton ✉️ → modal email + CTA `mailto:` qui ouvre le client mail.
7. Tester un bouton désactivé → ne fait rien (pas de modal).
8. Vérifier dans la DB qu'une ligne a été insérée pour chaque ouverture réussie :

```
mcp__plugin_supabase_supabase__execute_sql
  query: "select field, revealed_at from pro_contact_reveals order by revealed_at desc limit 5;"
```

- [ ] **Step 5: Test du cas `not_shared`**

Identifier (ou simuler via SQL) une relation où la donnée est NULL :

```
mcp__plugin_supabase_supabase__execute_sql
  query: "select r.id from relations r join prospects p on p.id = r.prospect_id join prospect_identity pi on pi.prospect_id = p.id where r.status in ('accepted','settled') and pi.telephone is null limit 1;"
```

Si une telle relation existe pour le pro logué, ses boutons devraient déjà être désactivés grâce aux flags. Pour tester l'erreur 404 « not_shared » côté API directement (au cas où le state UI deviendrait incohérent) :

```bash
curl -i -X POST http://localhost:3000/api/pro/contacts/<id>/reveal \
  -H "content-type: application/json" \
  -H "cookie: __session=<value>" \
  -d '{"field":"telephone"}'
```

Expected: HTTP 404, `{"error":"not_shared"}`. (Le step 4 a déjà couvert le cas habituel — ce step est une vérification défensive.)

- [ ] **Step 6: Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro/contacts): wire reveal modal to phone/email action buttons"
```

---

## Task 6: Smoke test final & push

- [ ] **Step 1: Build complet**

```bash
npm run build
```

Expected: build OK, pas d'erreur TS, pas de warning critique sur les fichiers modifiés.

- [ ] **Step 2: Lint complet**

```bash
npm run lint
```

Expected: pas d'erreur lint sur les fichiers modifiés/créés.

- [ ] **Step 3: Récapitulatif des tests manuels (à passer en revue)**

- [ ] Bouton 📞 actif → modal → numéro en clair → CTA `tel:` ouvre l'app
- [ ] Bouton ✉️ actif → modal → email en clair → CTA `mailto:` ouvre le client mail
- [ ] Bouton désactivé → ne fait rien, tooltip explicite
- [ ] Modal fermable via ✕ et via clic backdrop
- [ ] `pro_contact_reveals` reçoit une ligne par révélation réussie
- [ ] Endpoint reveal : 401 sans cookie, 400 sur field invalide, 403 sur relation d'un autre pro, 404 sur donnée NULL, 200 + audit row sur happy path

- [ ] **Step 4: Push**

```bash
git push
```

---

## Spec coverage

| Section spec | Task |
|---|---|
| Migration SQL `pro_contact_reveals` | Task 1 |
| Flags `emailAvailable` / `telephoneAvailable` dans GET contacts | Task 2 |
| Endpoint reveal — auth, validation, ownership, status, audit, happy path | Task 3 |
| Endpoint reveal — cas 404 `not_shared` | Task 3 (steps 1 & 6) + Task 5 step 5 |
| Endpoint reveal — audit best-effort (ne casse pas l'usage) | Task 3 step 1 |
| Composant `RevealContactModal` (loading / ok / not_shared / error) | Task 4 |
| Boutons action câblés + désactivés selon flags | Task 5 |
| Modal monté avec backdrop / ✕ / fermeture | Task 4 + Task 5 step 3 |
| `tel:` cleaning + `mailto:` `encodeURIComponent` | Task 4 step 1 |
| Texte « accès enregistré » dans le modal | Task 4 step 1 |
| Sécurité : 401 / 403 / 404 / 400 | Task 3 steps 4-8 |
| Hors scope (historique côté pro, notif prospect, rate-limit, subject mailto) | Non implémentés — voir spec § « Hors scope » |
