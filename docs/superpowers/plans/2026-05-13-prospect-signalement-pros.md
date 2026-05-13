# Signalement des pros par les prospects — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un prospect de signaler un comportement non conforme d'un pro depuis la modale de mise en relation, et donner à l'admin BUUPP une page pour traiter ces signalements.

**Architecture:** Nouvelle table `relation_reports` (1 row par relation max), bouton dans `RelationDetailModal` ouvrant une sous-modale `ReportProModal`, API prospect insertion + API admin lecture/résolution, nouvelle page `/buupp-admin/signalements` modelée sur `/buupp-admin/non-atteint`, intégration LiveFeed via `eventMeta`.

**Tech Stack:** Next.js 16 (App Router), Supabase (service_role + admin client), Clerk auth, vitest pour les tests `lib/`, prototype JSX vanilla pour l'UI prospect.

**Pré-requis :** la spec `docs/superpowers/specs/2026-05-13-prospect-signalement-pros-design.md` est lue. La mémoire utilisateur indique que les migrations locales et remote sont divergées → la migration sera appliquée via SQL Editor + `supabase migration repair`, jamais `db push`.

---

## File Structure

**À créer :**
- `supabase/migrations/20260513120000_relation_reports.sql` — table + enum + indexes + RLS.
- `app/api/prospect/relations/[id]/report/route.ts` — handler POST signalement (côté prospect).
- `app/api/admin/reports/route.ts` — handler GET liste filtrée (côté admin).
- `app/api/admin/reports/[id]/resolve/route.ts` — handler POST resolve/reopen.
- `lib/admin/queries/reports.ts` — fonctions `fetchReportsList`, `fetchReportsKpis` (service_role).
- `lib/prospect/reports.ts` — helper `reportedRelationIds(admin, prospectId)` partagé par le handler GET relations.
- `app/buupp-admin/signalements/page.tsx` — page server component.
- `app/buupp-admin/signalements/_components/ReportCard.tsx` — carte signalement (server).
- `app/buupp-admin/signalements/_components/ResolveButton.tsx` — client component (pop-in note + fetch).
- `tests/lib/admin/queries/reports.test.ts` — tests unitaires des queries admin.
- `tests/lib/prospect/reports.test.ts` — test de `reportedRelationIds`.

**À modifier :**
- `app/api/prospect/relations/route.ts` — enrichit chaque entrée pending+history avec `reported: boolean`.
- `public/prototype/components/Prospect.jsx` — ajoute le bouton « Signaler » dans `RelationDetailModal` et le composant `ReportProModal`.
- `app/buupp-admin/_components/AdminShell.tsx` — ajoute l'entrée nav `Signalements`.
- `app/buupp-admin/_components/eventMeta.ts` — ajoute le mapping `prospect.report`.
- `lib/supabase/types.ts` — régénération après application de la migration.

---

## Task 1 : Migration SQL `relation_reports`

**Files:**
- Create: `supabase/migrations/20260513120000_relation_reports.sql`

- [ ] **Step 1 : Créer le fichier de migration**

Fichier complet à écrire :

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Signalements de pros par les prospects
-- ════════════════════════════════════════════════════════════════════
-- Append-only. Alimentée par POST /api/prospect/relations/[id]/report
-- (un prospect signale un comportement non conforme d'un pro sur une
-- relation précise) et lue par /buupp-admin/signalements (service_role).
--
-- Règles métier :
--   - 1 signalement max par relation (`unique (relation_id)`)
--   - 3 motifs fixes (enum `relation_report_reason`)
--   - commentaire optionnel ≤ 1000 chars
--   - admin peut marquer "traité" (resolved_at / resolved_by_clerk_id
--     / resolved_note) ou rouvrir (reset des 3 colonnes à NULL)
--
-- RLS activée sans policy : tout passe par service_role, comme
-- `admin_events`.
-- ════════════════════════════════════════════════════════════════════

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
-- Aucune policy : seul service_role accède directement.
```

- [ ] **Step 2 : Appliquer la migration manuellement**

Action humaine (ne PAS exécuter `supabase db push`) :

1. Ouvrir le SQL Editor du projet Supabase distant.
2. Copier-coller le contenu du fichier `supabase/migrations/20260513120000_relation_reports.sql`.
3. Exécuter.
4. Marquer la migration comme appliquée localement :

```bash
supabase migration repair --status applied 20260513120000
```

Vérification :

```bash
supabase migration list
```

La ligne `20260513120000_relation_reports` doit apparaître avec status `applied`.

- [ ] **Step 3 : Régénérer les types TypeScript**

Run:

```bash
npx supabase gen types typescript --linked > lib/supabase/types.ts
```

Vérification : `grep -c "relation_reports" lib/supabase/types.ts` doit renvoyer un nombre > 0.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/20260513120000_relation_reports.sql lib/supabase/types.ts
git commit -m "feat(signalements): migration relation_reports + types"
```

---

## Task 2 : Helper `reportedRelationIds`

**Files:**
- Create: `lib/prospect/reports.ts`
- Test: `tests/lib/prospect/reports.test.ts`

- [ ] **Step 1 : Écrire le test**

Fichier `tests/lib/prospect/reports.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { reportedRelationIds } from "@/lib/prospect/reports";

function fakeAdmin(rows: Array<{ relation_id: string }>) {
  const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: inFn,
        }),
      }),
    }),
    _inFn: inFn,
  };
}

describe("reportedRelationIds", () => {
  it("renvoie un Set vide quand aucune relation passée", async () => {
    const admin = fakeAdmin([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await reportedRelationIds(admin as any, "p1", []);
    expect(result.size).toBe(0);
  });

  it("renvoie l'ensemble des relation_id signalés", async () => {
    const admin = fakeAdmin([
      { relation_id: "r1" },
      { relation_id: "r3" },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await reportedRelationIds(admin as any, "p1", ["r1", "r2", "r3"]);
    expect([...result].sort()).toEqual(["r1", "r3"]);
  });

  it("renvoie un Set vide si l'admin retourne null", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const admin = {
      from: () => ({ select: () => ({ eq: () => ({ in: inFn }) }) }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await reportedRelationIds(admin as any, "p1", ["r1"]);
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2 : Run test pour vérifier qu'il échoue**

```bash
npm test -- tests/lib/prospect/reports.test.ts
```

Expected: `Cannot find module '@/lib/prospect/reports'`.

- [ ] **Step 3 : Implémenter `lib/prospect/reports.ts`**

```ts
/**
 * Helper partagé : retourne l'ensemble des `relation_id` déjà signalés
 * par un prospect, parmi une liste donnée.
 *
 * Appelé par `GET /api/prospect/relations` pour annoter chaque relation
 * du flag `reported: boolean` consommé par la modale prospect.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function reportedRelationIds(
  admin: SupabaseClient,
  prospectId: string,
  relationIds: string[],
): Promise<Set<string>> {
  if (relationIds.length === 0) return new Set();
  const { data, error } = await admin
    .from("relation_reports")
    .select("relation_id")
    .eq("prospect_id", prospectId)
    .in("relation_id", relationIds);
  if (error || !data) return new Set();
  return new Set(data.map((r: { relation_id: string }) => r.relation_id));
}
```

- [ ] **Step 4 : Run test pour vérifier qu'il passe**

```bash
npm test -- tests/lib/prospect/reports.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/prospect/reports.ts tests/lib/prospect/reports.test.ts
git commit -m "feat(signalements): helper reportedRelationIds"
```

---

## Task 3 : Enrichir `GET /api/prospect/relations` avec `reported`

**Files:**
- Modify: `app/api/prospect/relations/route.ts`

- [ ] **Step 1 : Ajouter l'import du helper**

Ouvrir `app/api/prospect/relations/route.ts`. Sous l'import existant de `settleRipeRelationsAndNotify`, ajouter :

```ts
import { reportedRelationIds } from "@/lib/prospect/reports";
```

- [ ] **Step 2 : Calculer le set des relations signalées**

Juste après la query `admin.from("relations").select(...)`, et avant la définition de `pending`, insérer :

```ts
const allRelationIds = (rows ?? []).map((r) => r.id);
const reportedSet = await reportedRelationIds(admin, prospectId, allRelationIds);
```

- [ ] **Step 3 : Annoter chaque entrée pending avec `reported`**

Dans le `.map((r) => { ... })` qui produit `pending`, ajouter le champ dans l'objet retourné, juste après `isFlashDeal` :

```ts
        isFlashDeal: isFlashDealTargeting(r.campaigns?.targeting ?? null),
        reported: reportedSet.has(r.id),
```

- [ ] **Step 4 : Annoter chaque entrée history avec `reported`**

Dans le `.map((r) => { ... })` qui produit `history`, idem :

```ts
        isFlashDeal: isFlashDealTargeting(r.campaigns?.targeting ?? null),
        reported: reportedSet.has(r.id),
```

- [ ] **Step 5 : Vérification typecheck + dev**

```bash
npx tsc --noEmit
```

Expected: aucune erreur sur ce fichier.

Lancer le dev server :

```bash
npm run dev
```

Ouvrir `http://localhost:3000/prospect?tab=relations` avec un compte prospect, vérifier dans la Network tab que la réponse `/api/prospect/relations` contient bien `reported: false` sur chaque entrée. Arrêter le server (Ctrl+C).

- [ ] **Step 6 : Commit**

```bash
git add app/api/prospect/relations/route.ts
git commit -m "feat(signalements): expose flag reported sur GET /api/prospect/relations"
```

---

## Task 4 : Handler `POST /api/prospect/relations/[id]/report`

**Files:**
- Create: `app/api/prospect/relations/[id]/report/route.ts`

- [ ] **Step 1 : Créer le route handler**

```ts
/**
 * POST /api/prospect/relations/[id]/report
 * Body : { reason: 'sollicitation_multiple' | 'faux_compte' | 'echange_abusif',
 *          comment?: string }
 *
 * Insère un row dans `relation_reports` après vérification que la
 * relation appartient bien au prospect Clerk-authentifié. La contrainte
 * `unique (relation_id)` empêche tout doublon → renvoyée en 409.
 *
 * Émet un admin_event `prospect.report` (severity warning) côté admin
 * fire-and-forget pour alimenter le LiveFeed + la page Signalements.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/clerk/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ensureProspect } from "@/lib/sync/prospects";
import { recordEvent } from "@/lib/admin/events/record";

export const runtime = "nodejs";

const VALID_REASONS = new Set([
  "sollicitation_multiple",
  "faux_compte",
  "echange_abusif",
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: relationId } = await ctx.params;
  if (!relationId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let body: { reason?: string; comment?: string };
  try {
    body = (await req.json()) as { reason?: string; comment?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const reason = body.reason;
  if (!reason || !VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  }

  const rawComment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (rawComment.length > 1000) {
    return NextResponse.json({ error: "comment_too_long" }, { status: 400 });
  }
  const comment = rawComment.length > 0 ? rawComment : null;

  const user = await currentUser();
  const email =
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;
  const prospectId = await ensureProspect({
    clerkUserId: userId,
    email,
    prenom: user?.firstName ?? null,
    nom: user?.lastName ?? null,
  });

  const admin = createSupabaseAdminClient();

  // Vérification ownership + récupération de pro_account_id (la clé est
  // recopiée côté serveur — jamais fournie par le client pour éviter
  // l'injection).
  const { data: relation, error: relErr } = await admin
    .from("relations")
    .select("id, prospect_id, pro_account_id")
    .eq("id", relationId)
    .maybeSingle();
  if (relErr) {
    console.error("[/api/prospect/relations/[id]/report] read failed", relErr);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!relation) {
    return NextResponse.json({ error: "relation_not_found" }, { status: 404 });
  }
  if (relation.prospect_id !== prospectId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: inserted, error: insErr } = await admin
    .from("relation_reports")
    .insert({
      relation_id: relation.id,
      prospect_id: prospectId,
      pro_account_id: relation.pro_account_id,
      reason: reason as "sollicitation_multiple" | "faux_compte" | "echange_abusif",
      comment,
    })
    .select("id, created_at")
    .single();

  if (insErr) {
    // Postgres unique violation → 23505
    if ((insErr as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }
    console.error("[/api/prospect/relations/[id]/report] insert failed", insErr);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  void recordEvent({
    type: "prospect.report",
    severity: "warning",
    prospectId,
    proAccountId: relation.pro_account_id,
    relationId: relation.id,
    payload: {
      reason,
      hasComment: comment !== null,
    },
  });

  return NextResponse.json({
    id: inserted.id,
    createdAt: inserted.created_at,
  });
}
```

- [ ] **Step 2 : Vérification typecheck**

```bash
npx tsc --noEmit
```

Expected : pas d'erreur.

- [ ] **Step 3 : Test manuel via curl**

Lancer `npm run dev`. Récupérer un token Clerk via l'UI (Cookies) ou utiliser un compte prospect connecté en navigateur.

Test depuis la Console du navigateur sur `/prospect` :

```js
const id = (await (await fetch('/api/prospect/relations')).json()).pending[0].id;
const r = await fetch(`/api/prospect/relations/${id}/report`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ reason: 'faux_compte', comment: 'test plan' }),
});
console.log(r.status, await r.json());
```

Expected : `200 { id: '...', createdAt: '...' }`.

Re-jouer la même commande → expected `409 { error: 'already_reported' }`.

Vérifier en SQL Editor que le row existe et que `admin_events` contient une ligne `type='prospect.report'`.

Arrêter le dev server.

- [ ] **Step 4 : Commit**

```bash
git add app/api/prospect/relations/\[id\]/report/route.ts
git commit -m "feat(signalements): API prospect POST report (3 motifs)"
```

---

## Task 5 : UI prospect — `ReportProModal` + bouton dans `RelationDetailModal`

**Files:**
- Modify: `public/prototype/components/Prospect.jsx`

- [ ] **Step 1 : Ajouter le composant `ReportProModal`**

Ouvrir `public/prototype/components/Prospect.jsx`. Repérer la fin de `RelationDetailModal` (juste avant la ligne `function formatRelationDate(iso)` — autour de la ligne 4135 actuelle). Insérer **juste après** la fonction `RelationDetailModal` (donc avant `function formatRelationDate`) :

```jsx
/* ─── ReportProModal — signalement d'un pro depuis la modale relation
   ────────────────────────────────────────────────────────────────────
   3 motifs fixes (cf. spec) + commentaire optionnel ≤ 1000 chars.
   Appel POST /api/prospect/relations/[id]/report. En succès, affiche
   un état confirmatif et notifie le parent via onSubmitted() pour
   qu'il bascule l'UI sur "Signalement déjà transmis". */
const REPORT_REASONS = [
  {
    key: 'sollicitation_multiple',
    label: 'Sollicitation multiple',
    help: "Ce professionnel m'a contacté plus d'une fois. C'est interdit par le règlement BUUPP.",
  },
  {
    key: 'faux_compte',
    label: 'Faux compte',
    help: "Je doute qu'il s'agisse d'une vraie société. Le pro ne semble pas légitime.",
  },
  {
    key: 'echange_abusif',
    label: 'Échange abusif',
    help: "L'attitude du professionnel n'a pas été correcte (ton, propos, pression…).",
  },
];

function ReportProModal({ relation, onClose, onSubmitted }) {
  const [reason, setReason] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/prospect/relations/${relation.id}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason, comment: comment.trim() || undefined }),
      });
      if (r.ok || r.status === 409) {
        // 409 = already_reported : on le traite comme un succès silencieux
        // (le bouton va passer en "Signalement déjà transmis" au prochain
        // render parent).
        setDone(true);
        onSubmitted && onSubmitted();
        setTimeout(() => onClose(), 1800);
        return;
      }
      const j = await r.json().catch(() => null);
      console.warn('[prospect/report] failed', r.status, j);
      setError("Une erreur est survenue, merci de réessayer.");
    } catch (e) {
      console.warn('[prospect/report] error', e);
      setError("Une erreur est survenue, merci de réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <ModalShell title="Signalement transmis" onClose={onClose} width={460}>
        <div className="col gap-3" style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--good)', color: 'white',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
          }}>
            <Icon name="check" size={22} stroke={2.5}/>
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Signalement transmis. Notre équipe le traitera.
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Signaler un comportement" onClose={onClose} width={520}>
      <div className="col gap-4">
        <div className="row center gap-3" style={{ alignItems: 'center' }}>
          <Avatar name={relation.pro} size={36}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{relation.pro}</div>
            <div className="muted" style={{ fontSize: 12 }}>{relation.sector}</div>
          </div>
        </div>

        <div className="col gap-2">
          {REPORT_REASONS.map(opt => {
            const active = reason === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setReason(opt.key)}
                className="card"
                style={{
                  padding: 14, textAlign: 'left',
                  border: '1.5px solid ' + (active ? 'var(--accent)' : 'var(--line)'),
                  background: active
                    ? 'color-mix(in oklab, var(--accent) 8%, var(--paper))'
                    : 'var(--paper)',
                  cursor: 'pointer',
                }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                  {opt.label}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                  {opt.help}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <label
            className="mono caps muted"
            style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>
            Détail facultatif
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value.slice(0, 1000))}
            placeholder="Ajouter un détail à l'attention de l'équipe BUUPP (facultatif)"
            rows={3}
            style={{
              width: '100%', padding: 10, borderRadius: 8,
              border: '1px solid var(--line)', background: 'var(--paper)',
              fontFamily: 'inherit', fontSize: 13, resize: 'vertical',
            }}/>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'right', marginTop: 4 }}>
            {comment.length} / 1000
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: 'color-mix(in oklab, var(--danger) 8%, var(--paper))',
            border: '1px solid color-mix(in oklab, var(--danger) 30%, var(--line))',
            color: 'var(--danger)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div className="row gap-2 modal-actions" style={{ justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm" disabled={submitting}>
            Annuler
          </button>
          <button
            onClick={submit}
            className="btn btn-primary btn-sm"
            disabled={!reason || submitting}>
            {submitting ? 'Envoi…' : 'Envoyer le signalement'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
```

- [ ] **Step 2 : Ajouter le bouton dans `RelationDetailModal`**

Toujours dans `Prospect.jsx`, dans la signature de `RelationDetailModal`, remplacer :

```jsx
function RelationDetailModal({ relation, isAccepted, isRefused, onAccept, onRefuse, onClose }) {
```

par :

```jsx
function RelationDetailModal({ relation, isAccepted, isRefused, onAccept, onRefuse, onClose }) {
  const [reportOpen, setReportOpen] = useState(false);
  // Statut local "reported" pour basculer l'UI immédiatement après
  // soumission sans attendre le re-fetch parent.
  const [reportedLocal, setReportedLocal] = useState(!!relation.reported);
```

- [ ] **Step 3 : Insérer la zone bouton + sous-modale dans le JSX**

Toujours dans `RelationDetailModal`, juste **avant** le bloc commenté `{/* Actions ... */}` et la rangée `<div className="row gap-2 modal-actions" ...>` (autour de la ligne 4300 actuelle), insérer :

```jsx
        {/* Footer secondaire : signalement (action discrète, mise en
            retrait au-dessus des actions principales) */}
        <div style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 12, marginTop: 4,
          display: 'flex', justifyContent: 'flex-start',
        }}>
          {reportedLocal ? (
            <span className="chip" style={{ background: 'var(--ivory-2)', color: 'var(--ink-4)', fontSize: 11 }}>
              <Icon name="flag" size={11}/> Signalement déjà transmis
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)', fontSize: 12 }}>
              <Icon name="flag" size={12}/> Signaler ce professionnel
            </button>
          )}
        </div>
```

- [ ] **Step 4 : Rendre la sous-modale en fin de `RelationDetailModal`**

Toujours dans `RelationDetailModal`, juste **avant** le `</ModalShell>` final, insérer :

```jsx
      {reportOpen && (
        <ReportProModal
          relation={relation}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => setReportedLocal(true)}/>
      )}
```

- [ ] **Step 5 : Tester en navigateur (golden path)**

Lancer :

```bash
npm run dev
```

1. Aller sur `http://localhost:3000/prospect?tab=relations` avec un compte prospect ayant au moins une mise en relation pending OU une dans l'historique.
2. Cliquer le `+` d'une card → la modale s'ouvre, le bouton « Signaler ce professionnel » apparaît en bas.
3. Cliquer le bouton → sous-modale ouverte.
4. Cliquer Annuler → la sous-modale se ferme, la modale parent reste ouverte.
5. Rouvrir, choisir un motif, écrire un détail (vérifier compteur), Envoyer.
6. L'écran de succès apparaît, puis la sous-modale se ferme automatiquement après ~1.8 s.
7. La modale parent affiche maintenant la chip « Signalement déjà transmis ».
8. Fermer la modale, la rouvrir → la chip est toujours là (parce que `relation.reported` revient `true` au prochain refetch ; en attendant `reportedLocal` couvre la session courante).
9. Tester aussi depuis une ligne d'historique : même comportement.

Edge cases à vérifier :
- Sans sélection de motif, le bouton « Envoyer » est disabled.
- Avec un commentaire > 1000 chars, le textarea est tronqué à 1000.
- En envoyant deux fois rapidement (interaction côté serveur déjà signalée), pas d'erreur visible : le second `409` est traité comme succès silencieux.

Arrêter le dev server.

- [ ] **Step 6 : Commit**

```bash
git add public/prototype/components/Prospect.jsx
git commit -m "feat(signalements): bouton Signaler + ReportProModal côté prospect"
```

---

## Task 6 : Query helpers `lib/admin/queries/reports.ts`

**Files:**
- Create: `lib/admin/queries/reports.ts`
- Test: `tests/lib/admin/queries/reports.test.ts`

- [ ] **Step 1 : Écrire le test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock des supabase queries. On ne teste pas l'aller-retour PostgREST,
// juste la composition des filtres et la forme du retour.
const builderState: {
  filters: Array<[string, unknown]>;
  gte: string | null;
  range: [number, number] | null;
  orderDesc: boolean;
} = { filters: [], gte: null, range: null, orderDesc: false };
const resultRowsRef: { rows: unknown[] } = { rows: [] };

const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn((col: string, val: unknown) => {
    builderState.filters.push([col, val]);
    return builder;
  }),
  is: vi.fn((col: string, val: unknown) => {
    builderState.filters.push([col, val]);
    return builder;
  }),
  not: vi.fn((col: string, _op: string, val: unknown) => {
    builderState.filters.push([col, val]);
    return builder;
  }),
  gte: vi.fn((_col: string, val: string) => {
    builderState.gte = val;
    return builder;
  }),
  order: vi.fn(() => {
    builderState.orderDesc = true;
    return builder;
  }),
  range: vi.fn((a: number, b: number) => {
    builderState.range = [a, b];
    return Promise.resolve({ data: resultRowsRef.rows, error: null });
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: () => builder,
  }),
}));

import { fetchReportsList } from "@/lib/admin/queries/reports";

beforeEach(() => {
  builderState.filters = [];
  builderState.gte = null;
  builderState.range = null;
  builderState.orderDesc = false;
  resultRowsRef.rows = [];
  builder.select.mockClear();
  builder.eq.mockClear();
  builder.is.mockClear();
  builder.not.mockClear();
  builder.gte.mockClear();
  builder.order.mockClear();
  builder.range.mockClear();
});

describe("fetchReportsList", () => {
  it("filtre par status=open via is(resolved_at, null)", async () => {
    await fetchReportsList({ status: "open", reason: "all", period: "all", page: 0 });
    expect(builderState.filters).toEqual(
      expect.arrayContaining([["resolved_at", null]]),
    );
  });

  it("filtre par status=resolved via not(resolved_at, is, null)", async () => {
    await fetchReportsList({ status: "resolved", reason: "all", period: "all", page: 0 });
    // not('resolved_at', 'is', null) → on a stocké la valeur null dans filters
    expect(builder.not).toHaveBeenCalled();
  });

  it("filtre par motif quand reason != 'all'", async () => {
    await fetchReportsList({ status: "all", reason: "faux_compte", period: "all", page: 0 });
    expect(builderState.filters).toEqual(
      expect.arrayContaining([["reason", "faux_compte"]]),
    );
  });

  it("applique un gte sur created_at quand period=7d", async () => {
    await fetchReportsList({ status: "all", reason: "all", period: "7d", page: 0 });
    expect(builderState.gte).not.toBeNull();
    // Vérifie que la borne est ~il y a 7 jours
    const ageMs = Date.now() - new Date(builderState.gte!).getTime();
    expect(ageMs).toBeGreaterThanOrEqual(7 * 86_400_000 - 5000);
    expect(ageMs).toBeLessThanOrEqual(7 * 86_400_000 + 5000);
  });

  it("paginate via range(page*50, page*50+49)", async () => {
    await fetchReportsList({ status: "all", reason: "all", period: "all", page: 2 });
    expect(builderState.range).toEqual([100, 149]);
  });
});
```

- [ ] **Step 2 : Run test pour vérifier qu'il échoue**

```bash
npm test -- tests/lib/admin/queries/reports.test.ts
```

Expected : `Cannot find module '@/lib/admin/queries/reports'`.

- [ ] **Step 3 : Implémenter `lib/admin/queries/reports.ts`**

```ts
/**
 * Queries pour la page admin `/buupp-admin/signalements`.
 *
 * - fetchReportsList : liste filtrée (statut, motif, période) + pagination.
 * - fetchReportsKpis : 3 chiffres (à traiter, traités 30j, total période)
 *   + répartition par motif sur la même période.
 *
 * Tout en lecture pure depuis Supabase service_role. Pas de RPC : volumes
 * faibles, agrégation côté SQL via .select(count) suffit.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ReportStatus = "open" | "resolved" | "all";
export type ReportReason =
  | "all"
  | "sollicitation_multiple"
  | "faux_compte"
  | "echange_abusif";
export type ReportPeriod = "7d" | "30d" | "90d" | "all";

export type ReportListItem = {
  id: string;
  reason: Exclude<ReportReason, "all">;
  comment: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByClerkId: string | null;
  resolvedNote: string | null;
  pro: {
    id: string;
    raisonSociale: string;
  } | null;
  prospect: {
    id: string;
    prenom: string | null;
    nomInitial: string | null;
  } | null;
  campaign: {
    id: string;
    name: string;
  } | null;
  relation: {
    id: string;
    sentAt: string;
    motif: string;
  } | null;
};

export type ReportsKpis = {
  open: number;
  resolved30d: number;
  totalPeriod: number;
  byReason: {
    sollicitation_multiple: number;
    faux_compte: number;
    echange_abusif: number;
  };
};

function periodCutoffIso(period: ReportPeriod): string | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

const PAGE_SIZE = 50;

export async function fetchReportsList(opts: {
  status: ReportStatus;
  reason: ReportReason;
  period: ReportPeriod;
  page: number;
}): Promise<ReportListItem[]> {
  const admin = createSupabaseAdminClient();
  let q = admin
    .from("relation_reports")
    .select(
      `id, reason, comment, created_at, resolved_at, resolved_by_clerk_id, resolved_note,
       pro_accounts ( id, raison_sociale ),
       prospects ( id, prenom, nom ),
       relations ( id, sent_at, motif, campaign_id, campaigns ( id, name ) )`,
    )
    .order("created_at", { ascending: false });

  if (opts.status === "open") {
    q = q.is("resolved_at", null);
  } else if (opts.status === "resolved") {
    q = q.not("resolved_at", "is", null);
  }
  if (opts.reason !== "all") {
    q = q.eq("reason", opts.reason);
  }
  const cutoff = periodCutoffIso(opts.period);
  if (cutoff) {
    q = q.gte("created_at", cutoff);
  }
  const from = opts.page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await q.range(from, to);
  if (error || !data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    id: r.id,
    reason: r.reason,
    comment: r.comment ?? null,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at ?? null,
    resolvedByClerkId: r.resolved_by_clerk_id ?? null,
    resolvedNote: r.resolved_note ?? null,
    pro: r.pro_accounts
      ? {
          id: r.pro_accounts.id,
          raisonSociale: r.pro_accounts.raison_sociale ?? "—",
        }
      : null,
    prospect: r.prospects
      ? {
          id: r.prospects.id,
          prenom: r.prospects.prenom ?? null,
          nomInitial:
            typeof r.prospects.nom === "string" && r.prospects.nom.length > 0
              ? r.prospects.nom[0].toUpperCase() + "."
              : null,
        }
      : null,
    campaign: r.relations?.campaigns
      ? {
          id: r.relations.campaigns.id,
          name: r.relations.campaigns.name ?? "—",
        }
      : null,
    relation: r.relations
      ? {
          id: r.relations.id,
          sentAt: r.relations.sent_at,
          motif: r.relations.motif ?? "",
        }
      : null,
  }));
}

export async function fetchReportsKpis(opts: {
  period: ReportPeriod;
}): Promise<ReportsKpis> {
  const admin = createSupabaseAdminClient();
  const cutoff = periodCutoffIso(opts.period);
  const cutoff30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const baseCount = (filterFn: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    q: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any) => {
    let q = admin
      .from("relation_reports")
      .select("id", { count: "exact", head: true });
    q = filterFn(q);
    if (cutoff) q = q.gte("created_at", cutoff);
    return q;
  };

  const [openRes, resolved30dRes, totalRes, multRes, fauxRes, abusRes] =
    await Promise.all([
      baseCount((q) => q.is("resolved_at", null)),
      admin
        .from("relation_reports")
        .select("id", { count: "exact", head: true })
        .not("resolved_at", "is", null)
        .gte("resolved_at", cutoff30d),
      baseCount((q) => q),
      baseCount((q) => q.eq("reason", "sollicitation_multiple")),
      baseCount((q) => q.eq("reason", "faux_compte")),
      baseCount((q) => q.eq("reason", "echange_abusif")),
    ]);

  return {
    open: openRes.count ?? 0,
    resolved30d: resolved30dRes.count ?? 0,
    totalPeriod: totalRes.count ?? 0,
    byReason: {
      sollicitation_multiple: multRes.count ?? 0,
      faux_compte: fauxRes.count ?? 0,
      echange_abusif: abusRes.count ?? 0,
    },
  };
}
```

- [ ] **Step 4 : Run tests**

```bash
npm test -- tests/lib/admin/queries/reports.test.ts
```

Expected : 5 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/admin/queries/reports.ts tests/lib/admin/queries/reports.test.ts
git commit -m "feat(signalements): queries admin (list + kpis)"
```

---

## Task 7 : API admin `GET /api/admin/reports` et `POST /api/admin/reports/[id]/resolve`

**Files:**
- Create: `app/api/admin/reports/route.ts`
- Create: `app/api/admin/reports/[id]/resolve/route.ts`

- [ ] **Step 1 : Créer `app/api/admin/reports/route.ts`**

```ts
/**
 * GET /api/admin/reports — Liste filtrée des signalements pour le
 * back-office. Garde admin (Clerk allowlist + x-admin-secret).
 *
 * Query params :
 *   status : 'open' | 'resolved' | 'all'   (défaut 'open')
 *   reason : 'all' | 'sollicitation_multiple' | 'faux_compte' | 'echange_abusif' (défaut 'all')
 *   period : '7d' | '30d' | '90d' | 'all'  (défaut '30d')
 *   page   : number                         (défaut 0)
 */

import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import {
  fetchReportsList,
  type ReportStatus,
  type ReportReason,
  type ReportPeriod,
} from "@/lib/admin/queries/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS: ReportStatus[] = ["open", "resolved", "all"];
const VALID_REASON: ReportReason[] = [
  "all",
  "sollicitation_multiple",
  "faux_compte",
  "echange_abusif",
];
const VALID_PERIOD: ReportPeriod[] = ["7d", "30d", "90d", "all"];

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "open") as ReportStatus;
  const reason = (url.searchParams.get("reason") ?? "all") as ReportReason;
  const period = (url.searchParams.get("period") ?? "30d") as ReportPeriod;
  const pageRaw = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;

  if (!VALID_STATUS.includes(status))
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  if (!VALID_REASON.includes(reason))
    return NextResponse.json({ error: "invalid_reason" }, { status: 400 });
  if (!VALID_PERIOD.includes(period))
    return NextResponse.json({ error: "invalid_period" }, { status: 400 });

  const items = await fetchReportsList({ status, reason, period, page });
  return NextResponse.json({ items });
}
```

- [ ] **Step 2 : Créer `app/api/admin/reports/[id]/resolve/route.ts`**

```ts
/**
 * POST /api/admin/reports/[id]/resolve
 * Body : { action: 'resolve' | 'reopen', note?: string }
 *
 * Garde admin (Clerk allowlist OU x-admin-secret).
 *
 * Met à jour les colonnes resolved_* sur le signalement :
 *  - resolve : set resolved_at=now(), resolved_by_clerk_id=adminId,
 *              resolved_note=note ?? null
 *  - reopen  : reset les 3 colonnes à null
 *
 * Émet un admin_event 'admin.report_resolved' ou 'admin.report_reopened'
 * (info, fire-and-forget).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { recordEvent } from "@/lib/admin/events/record";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const { userId: adminClerkId } = await auth();
  const { id: reportId } = await ctx.params;
  if (!reportId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let body: { action?: string; note?: string };
  try {
    body = (await req.json()) as { action?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "resolve" && action !== "reopen") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  const rawNote = typeof body.note === "string" ? body.note.trim() : "";
  if (rawNote.length > 1000) {
    return NextResponse.json({ error: "note_too_long" }, { status: 400 });
  }
  const note = rawNote.length > 0 ? rawNote : null;

  const admin = createSupabaseAdminClient();
  const patch =
    action === "resolve"
      ? {
          resolved_at: new Date().toISOString(),
          resolved_by_clerk_id: adminClerkId ?? null,
          resolved_note: note,
        }
      : {
          resolved_at: null,
          resolved_by_clerk_id: null,
          resolved_note: null,
        };

  const { data, error } = await admin
    .from("relation_reports")
    .update(patch)
    .eq("id", reportId)
    .select("id, prospect_id, pro_account_id, relation_id")
    .maybeSingle();
  if (error) {
    console.error("[/api/admin/reports/[id]/resolve] update failed", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "report_not_found" }, { status: 404 });
  }

  void recordEvent({
    type: action === "resolve" ? "admin.report_resolved" : "admin.report_reopened",
    severity: "info",
    prospectId: data.prospect_id,
    proAccountId: data.pro_account_id,
    relationId: data.relation_id,
    payload: { reportId: data.id, by: adminClerkId ?? null },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3 : Vérification typecheck**

```bash
npx tsc --noEmit
```

Expected : pas d'erreur.

- [ ] **Step 4 : Commit**

```bash
git add app/api/admin/reports/route.ts app/api/admin/reports/\[id\]/resolve/route.ts
git commit -m "feat(signalements): API admin list + resolve/reopen"
```

---

## Task 8 : Page admin `/buupp-admin/signalements`

**Files:**
- Create: `app/buupp-admin/signalements/page.tsx`
- Create: `app/buupp-admin/signalements/_components/ReportCard.tsx`
- Create: `app/buupp-admin/signalements/_components/ResolveButton.tsx`

- [ ] **Step 1 : Créer `ResolveButton` (client component)**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ResolveButton({
  reportId,
  action,
}: {
  reportId: string;
  action: "resolve" | "reopen";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/admin/reports/${reportId}/resolve`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, note: note.trim() || undefined }),
        });
        if (!r.ok) {
          setError("Échec de la mise à jour.");
          return;
        }
        setOpen(false);
        setNote("");
        router.refresh();
      } catch {
        setError("Échec de la mise à jour.");
      }
    });
  };

  if (action === "reopen") {
    return (
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="text-xs rounded px-3 py-1.5 transition-colors disabled:opacity-60 cursor-pointer"
        style={{
          background: "var(--ivory-2)",
          color: "var(--ink-2)",
          border: "1px solid var(--line)",
        }}
      >
        {pending ? "…" : "Rouvrir"}
      </button>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs rounded px-3 py-1.5 transition-colors cursor-pointer"
        style={{
          background: "var(--ink)",
          color: "var(--paper)",
          border: "1px solid var(--ink)",
        }}
      >
        Marquer traité
      </button>
    );
  }

  return (
    <div
      className="mt-2 p-3 rounded"
      style={{ background: "var(--ivory)", border: "1px solid var(--line)" }}
    >
      <label
        className="block text-[11px] mb-1.5"
        style={{
          color: "var(--ink-4)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
      >
        NOTE INTERNE (facultatif)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 1000))}
        rows={2}
        className="w-full text-sm rounded p-2"
        style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
        placeholder="Ce que tu as constaté, ce qui a été fait…"
      />
      {error && (
        <div className="text-xs mt-2" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setNote("");
            setError(null);
          }}
          disabled={pending}
          className="text-xs rounded px-3 py-1.5 cursor-pointer"
          style={{
            background: "var(--paper)",
            color: "var(--ink-3)",
            border: "1px solid var(--line)",
          }}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="text-xs rounded px-3 py-1.5 cursor-pointer disabled:opacity-60"
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            border: "1px solid var(--ink)",
          }}
        >
          {pending ? "Envoi…" : "Confirmer"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `ReportCard` (server component)**

```tsx
import Link from "next/link";
import type { ReportListItem } from "@/lib/admin/queries/reports";
import ResolveButton from "./ResolveButton";

const REASON_LABEL: Record<ReportListItem["reason"], string> = {
  sollicitation_multiple: "Sollicitation multiple",
  faux_compte: "Faux compte",
  echange_abusif: "Échange abusif",
};

const REASON_TONE: Record<
  ReportListItem["reason"],
  { bg: string; color: string }
> = {
  sollicitation_multiple: {
    bg: "color-mix(in oklab, var(--warn) 14%, var(--paper))",
    color: "var(--warn)",
  },
  echange_abusif: {
    bg: "color-mix(in oklab, var(--danger) 12%, var(--paper))",
    color: "var(--danger)",
  },
  faux_compte: {
    bg: "var(--ivory-2)",
    color: "var(--ink-2)",
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function ReportCard({ report }: { report: ReportListItem }) {
  const tone = REASON_TONE[report.reason];
  const isResolved = report.resolvedAt !== null;
  return (
    <article
      className="rounded-lg p-4"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <header className="flex flex-wrap items-start gap-3 mb-3">
        <span
          className="text-xs rounded px-2 py-0.5 font-medium"
          style={{ background: tone.bg, color: tone.color }}
        >
          {REASON_LABEL[report.reason]}
        </span>
        <span
          className="text-xs"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}
        >
          {fmtDate(report.createdAt)}
        </span>
        <div className="ml-auto">
          {isResolved ? (
            <span
              className="text-[11px] uppercase rounded px-2 py-0.5"
              style={{
                background: "color-mix(in oklab, var(--good) 14%, var(--paper))",
                color: "var(--good)",
                fontFamily: "var(--mono)",
                letterSpacing: "0.06em",
              }}
            >
              Traité
            </span>
          ) : (
            <span
              className="text-[11px] uppercase rounded px-2 py-0.5"
              style={{
                background: "color-mix(in oklab, var(--warn) 14%, var(--paper))",
                color: "var(--warn)",
                fontFamily: "var(--mono)",
                letterSpacing: "0.06em",
              }}
            >
              À traiter
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
        <div>
          <div
            className="text-[11px] uppercase mb-1"
            style={{
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.06em",
            }}
          >
            Pro signalé
          </div>
          {report.pro ? (
            <Link
              href={`/buupp-admin/pros/${report.pro.id}`}
              className="underline"
              style={{ color: "var(--ink)" }}
            >
              {report.pro.raisonSociale}
            </Link>
          ) : (
            <span style={{ color: "var(--ink-4)" }}>—</span>
          )}
        </div>
        <div>
          <div
            className="text-[11px] uppercase mb-1"
            style={{
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.06em",
            }}
          >
            Prospect signaleur
          </div>
          {report.prospect ? (
            <Link
              href={`/buupp-admin/prospects/${report.prospect.id}`}
              className="underline"
              style={{ color: "var(--ink)" }}
            >
              {report.prospect.prenom ?? "—"}{" "}
              {report.prospect.nomInitial ?? ""}
            </Link>
          ) : (
            <span style={{ color: "var(--ink-4)" }}>—</span>
          )}
        </div>
      </div>

      {report.campaign && report.relation && (
        <div
          className="text-xs mb-3"
          style={{ color: "var(--ink-3)" }}
        >
          Campagne <strong>{report.campaign.name}</strong> · sollicitée le{" "}
          {fmtDate(report.relation.sentAt)}
          {report.relation.motif && (
            <>
              <br />
              <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>
                « {report.relation.motif.slice(0, 200)}
                {report.relation.motif.length > 200 ? "…" : ""} »
              </span>
            </>
          )}
        </div>
      )}

      {report.comment && (
        <div
          className="rounded p-3 text-sm mb-3"
          style={{
            background: "var(--ivory)",
            border: "1px solid var(--line)",
            fontStyle: "italic",
            color: "var(--ink-2)",
          }}
        >
          « {report.comment} »
        </div>
      )}

      {isResolved && (
        <div className="text-xs mb-3" style={{ color: "var(--ink-4)" }}>
          Traité le {fmtDate(report.resolvedAt)}
          {report.resolvedByClerkId ? ` par ${report.resolvedByClerkId}` : ""}.
          {report.resolvedNote && (
            <>
              <br />
              <span style={{ fontStyle: "italic" }}>
                Note : {report.resolvedNote}
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <ResolveButton
          reportId={report.id}
          action={isResolved ? "reopen" : "resolve"}
        />
      </div>
    </article>
  );
}
```

- [ ] **Step 3 : Créer la page `/buupp-admin/signalements/page.tsx`**

```tsx
/**
 * /buupp-admin/signalements — Page admin des signalements pros par les
 * prospects. Filtres GET (statut / motif / période), KPI top, liste de
 * cartes ReportCard, pagination simple.
 */

import {
  fetchReportsList,
  fetchReportsKpis,
  type ReportStatus,
  type ReportReason,
  type ReportPeriod,
} from "@/lib/admin/queries/reports";
import ReportCard from "./_components/ReportCard";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{ value: ReportStatus; label: string }> = [
  { value: "open", label: "À traiter" },
  { value: "resolved", label: "Traités" },
  { value: "all", label: "Tous" },
];
const REASON_OPTIONS: Array<{ value: ReportReason; label: string }> = [
  { value: "all", label: "Tous motifs" },
  { value: "sollicitation_multiple", label: "Sollicitation multiple" },
  { value: "faux_compte", label: "Faux compte" },
  { value: "echange_abusif", label: "Échange abusif" },
];
const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "all", label: "Tout" },
];

function asStatus(v: string | undefined): ReportStatus {
  if (v === "resolved" || v === "all") return v;
  return "open";
}
function asReason(v: string | undefined): ReportReason {
  if (
    v === "sollicitation_multiple" ||
    v === "faux_compte" ||
    v === "echange_abusif"
  ) {
    return v;
  }
  return "all";
}
function asPeriod(v: string | undefined): ReportPeriod {
  if (v === "7d" || v === "90d" || v === "all") return v;
  return "30d";
}

export default async function SignalementsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    reason?: string;
    period?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = asStatus(sp.status);
  const reason = asReason(sp.reason);
  const period = asPeriod(sp.period);
  const pageRaw = Number(sp.page ?? "0");
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;

  const [items, kpis] = await Promise.all([
    fetchReportsList({ status, reason, period, page }),
    fetchReportsKpis({ period }),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div
          className="text-[11px] uppercase"
          style={{
            color: "var(--ink-4)",
            fontFamily: "var(--mono)",
            letterSpacing: "0.06em",
          }}
        >
          Anti-fraude · Pros
        </div>
        <h1 className="text-xl font-medium" style={{ letterSpacing: "-0.01em" }}>
          Signalements de professionnels
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-3)", maxWidth: 720 }}>
          Liste des signalements envoyés par les prospects depuis la modale de
          mise en relation. Trois motifs possibles : sollicitation multiple,
          faux compte, échange abusif. Marque un signalement « traité » quand
          tu as vérifié et tranché.
        </p>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="À traiter" value={kpis.open} />
        <Kpi label="Traités 30 j" value={kpis.resolved30d} />
        <Kpi label={`Total ${periodLabel(period)}`} value={kpis.totalPeriod} />
        <div
          className="rounded-lg p-4 flex flex-col gap-1"
          style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
        >
          <div
            className="text-[11px] uppercase"
            style={{
              color: "var(--ink-4)",
              fontFamily: "var(--mono)",
              letterSpacing: "0.06em",
            }}
          >
            Répartition motifs
          </div>
          <div className="flex flex-wrap gap-2 mt-1 text-xs">
            <span>Multi: {kpis.byReason.sollicitation_multiple}</span>
            <span>Faux: {kpis.byReason.faux_compte}</span>
            <span>Abus: {kpis.byReason.echange_abusif}</span>
          </div>
        </div>
      </section>

      {/* Filtres */}
      <form
        method="GET"
        className="flex flex-wrap gap-2 items-end"
        style={{ color: "var(--ink-3)" }}
      >
        <Select name="status" value={status} options={STATUS_OPTIONS} label="Statut" />
        <Select name="reason" value={reason} options={REASON_OPTIONS} label="Motif" />
        <Select name="period" value={period} options={PERIOD_OPTIONS} label="Période" />
        <button
          type="submit"
          className="text-xs rounded px-3 py-1.5 cursor-pointer"
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            border: "1px solid var(--ink)",
          }}
        >
          Filtrer
        </button>
      </form>

      {/* Liste */}
      <section className="space-y-3">
        {items.length === 0 ? (
          <div
            className="rounded-lg p-6 text-center text-sm"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              color: "var(--ink-3)",
            }}
          >
            Aucun signalement pour ces filtres.
          </div>
        ) : (
          items.map((r) => <ReportCard key={r.id} report={r} />)
        )}
      </section>

      {/* Pagination */}
      <nav className="flex justify-between items-center text-xs">
        {page > 0 ? (
          <a
            href={buildHref({ status, reason, period, page: page - 1 })}
            className="underline"
            style={{ color: "var(--ink)" }}
          >
            ← Page précédente
          </a>
        ) : (
          <span />
        )}
        {items.length === 50 && (
          <a
            href={buildHref({ status, reason, period, page: page + 1 })}
            className="underline"
            style={{ color: "var(--ink)" }}
          >
            Page suivante →
          </a>
        )}
      </nav>
    </div>
  );
}

function periodLabel(p: ReportPeriod): string {
  return p === "7d"
    ? "7 j"
    : p === "30d"
      ? "30 j"
      : p === "90d"
        ? "90 j"
        : "tout";
}

function buildHref(o: {
  status: ReportStatus;
  reason: ReportReason;
  period: ReportPeriod;
  page: number;
}): string {
  const u = new URLSearchParams();
  u.set("status", o.status);
  u.set("reason", o.reason);
  u.set("period", o.period);
  if (o.page > 0) u.set("page", String(o.page));
  return `/buupp-admin/signalements?${u.toString()}`;
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--paper)", border: "1px solid var(--line)" }}
    >
      <div
        className="text-[11px] uppercase mb-1"
        style={{
          color: "var(--ink-4)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div className="text-2xl" style={{ fontFamily: "var(--serif)" }}>
        {new Intl.NumberFormat("fr-FR").format(value)}
      </div>
    </div>
  );
}

function Select<T extends string>({
  name,
  value,
  options,
  label,
}: {
  name: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[10px] uppercase"
        style={{
          color: "var(--ink-4)",
          fontFamily: "var(--mono)",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="text-sm rounded px-2 py-1.5"
        style={{
          background: "var(--paper)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 4 : Vérification typecheck**

```bash
npx tsc --noEmit
```

Expected : pas d'erreur.

- [ ] **Step 5 : Commit**

```bash
git add app/buupp-admin/signalements
git commit -m "feat(signalements): page admin /buupp-admin/signalements"
```

---

## Task 9 : Entrée NAV admin + LiveFeed

**Files:**
- Modify: `app/buupp-admin/_components/AdminShell.tsx`
- Modify: `app/buupp-admin/_components/eventMeta.ts`

- [ ] **Step 1 : Ajouter l'entrée NAV**

Dans `app/buupp-admin/_components/AdminShell.tsx`, modifier le tableau `NAV` (lignes 10-20). Remplacer :

```ts
  { href: "/buupp-admin/non-atteint", label: "Non atteint" },
  { href: "/buupp-admin/pros", label: "Professionnels" },
```

par :

```ts
  { href: "/buupp-admin/non-atteint", label: "Non atteint" },
  { href: "/buupp-admin/signalements", label: "Signalements" },
  { href: "/buupp-admin/pros", label: "Professionnels" },
```

- [ ] **Step 2 : Ajouter l'entrée `eventMeta`**

Dans `app/buupp-admin/_components/eventMeta.ts`, dans l'objet `EVENT_META`, **avant** la ligne `// Ajoute ici d'autres types quand pertinents.`, ajouter :

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

- [ ] **Step 3 : Test bout-en-bout**

Lancer :

```bash
npm run dev
```

1. Ouvrir `/buupp-admin` connecté en admin → vérifier que « Signalements » apparaît dans la sidebar entre « Non atteint » et « Professionnels ».
2. Cliquer « Signalements » → la page charge, KPI affichés, filtres présents.
3. Dans un autre onglet, se connecter en prospect, signaler une relation (cf. Task 5 step 5).
4. Revenir sur `/buupp-admin` → le LiveFeed doit afficher la nouvelle entrée « Signalement prospect » avec subLine « Sollicitation multiple » / « Faux compte » / « Échange abusif », encadré ambre (warning). Cliquer dessus → redirige vers `/buupp-admin/signalements?status=open`.
5. Sur `/buupp-admin/signalements`, la carte apparaît en haut, statut « À traiter ».
6. Cliquer « Marquer traité », saisir une note, Confirmer → la carte bascule en « Traité » avec la note affichée et un bouton « Rouvrir ».
7. Changer le filtre statut à « Traités » et soumettre → la carte est toujours visible. Filtrer sur « À traiter » → liste vide.
8. Cliquer « Rouvrir » sur la carte traitée → elle redevient « À traiter ».

Arrêter le dev server.

- [ ] **Step 4 : Commit**

```bash
git add app/buupp-admin/_components/AdminShell.tsx app/buupp-admin/_components/eventMeta.ts
git commit -m "feat(signalements): nav admin + LiveFeed prospect.report"
```

---

## Task 10 : Vérification finale + tests

- [ ] **Step 1 : Lancer la suite de tests**

```bash
npm test
```

Expected : tous les tests passent, dont les 3 nouveaux fichiers (`reports.test.ts` admin queries, `reports.test.ts` prospect helper).

- [ ] **Step 2 : Lancer le lint et le typecheck**

```bash
npm run lint
npx tsc --noEmit
```

Expected : zéro warning / erreur.

- [ ] **Step 3 : Vérifier les invariants métier en SQL Editor**

Sur le Supabase distant :

```sql
-- 1 : la contrainte unique bloque bien un doublon
select count(*) from public.relation_reports;

-- 2 : pas de fuite de RLS
set role authenticated;
select * from public.relation_reports limit 1;  -- doit échouer / 0 rows
reset role;
```

Expected : pas de fuite RLS.

- [ ] **Step 4 : Commit de bouclage**

Si rien à modifier, terminer la branche selon la convention du repo (rebase, PR, ou merge direct selon préférence).

---

## Self-Review effectuée

- **Couverture spec** : section 2.1 (parcours prospect) → Task 5 · 2.2 (parcours admin) → Tasks 8-9 · 3 (modèle data) → Task 1 · 4 (API) → Tasks 3, 4, 7 · 5 (UI prospect) → Task 5 · 6 (UI admin) → Tasks 8-9 · 7 (sécu) → Tasks 1, 4, 7 · 8 (découpage) → matérialisé par l'ordre des tasks · 9 (risques) → mitigation 409 = succès dans Task 5, migration manuelle dans Task 1.
- **Placeholders** : aucun `TBD` / `TODO` ; chaque step a son code complet et une commande exécutable.
- **Cohérence des types** : `ReportListItem`, `ReportsKpis`, `ReportStatus`, `ReportReason`, `ReportPeriod` définis dans Task 6 et réutilisés sans renommage dans Tasks 7 et 8.
- **Champs DB** : `relation_id`, `prospect_id`, `pro_account_id`, `reason`, `comment`, `resolved_at`, `resolved_by_clerk_id`, `resolved_note`, `created_at` — alignés migration ↔ types ↔ queries ↔ API ↔ UI.
- **Event type unique** : `prospect.report` (côté signalement) et `admin.report_resolved` / `admin.report_reopened` (côté action admin) — utilisés tels quels dans Tasks 4, 7 et 9.
