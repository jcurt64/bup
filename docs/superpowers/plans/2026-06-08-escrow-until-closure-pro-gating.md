# Séquestre jusqu'à clôture + masquage données pro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La récompense d'un prospect reste en séquestre jusqu'à la clôture de la campagne (date de fin courante, prolongation incluse), et le pro ne voit les données des prospects acceptés qu'après clôture (compteurs visibles avant).

**Architecture:** Tout est gaté sur `campaigns.status = 'completed'` (posé à `ends_at` par `close_campaign_settle`). La RPC de settlement ne libère que les relations de campagnes closes ; les routes pro masquent les données par prospect tant que la campagne n'est pas close ; la clôture est fiabilisée (cron + accès pro) en réutilisant `settleRipeRelationsAndNotify`.

**Tech Stack:** Next.js (route handlers nodejs), Supabase (Postgres RPC, PostgREST `!inner`), Vitest, prototype iframe `.jsx`.

**Branche :** `feat/escrow-until-closure-pro-gating` (créée, spec committé).

**Spec :** `docs/superpowers/specs/2026-06-08-escrow-until-closure-pro-gating-design.md`

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `supabase/migrations/<ts>_settle_on_campaign_closure.sql` | RPC `settle_ripe_relations` gatée sur `c.status='completed'` | Créer |
| `lib/pro/campaign-access.ts` | Helper pur `proCanSeeContacts(status)` | Créer |
| `tests/lib/pro/campaign-access.test.ts` | Test du helper | Créer |
| `app/api/admin/digest/route.ts` | Cron : déclenche clôture+settle (backstop) | Modifier |
| `app/api/pro/campaigns/[id]/route.ts` | Gate contacts + trigger clôture | Modifier |
| `app/api/pro/contacts/route.ts` | Campagnes closes seulement + trigger | Modifier |
| `app/api/pro/acceptances/route.ts` | Campagnes closes seulement + trigger | Modifier |
| `app/api/pro/contacts/[relationId]/reveal/route.ts` | 403 si campagne non close | Modifier |
| `app/api/pro/contacts/[relationId]/details/route.ts` | 403 si campagne non close | Modifier |
| `public/prototype/components/Pro.jsx` | État verrouillé (détail campagne + contacts) | Modifier |
| `<écran pro mobile>` (worktree) | État verrouillé mobile | Modifier (Phase 2) |

---

## Task 1 : Migration — settlement gaté sur la clôture

**Files:**
- Create: `supabase/migrations/20260716120000_settle_on_campaign_closure.sql`

> Procédure projet : appliquer via MCP Supabase / SQL Editor, committer le fichier. Pas de `db push`.

- [ ] **Step 1 : Créer le fichier de migration**

Confirmer le timestamp postérieur au dernier : `ls supabase/migrations/ | sort | tail -2` (dernier = `20260715120000_founder_signup_bonus.sql`, donc `20260716120000` convient).

```sql
-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Séquestre libéré À LA CLÔTURE de la campagne (et non 3 min après
-- le lancement). settle_ripe_relations ne settle plus que les relations
-- dont la campagne est `completed`. La prolongation (extend → ends_at
-- décalé → clôture plus tard) est donc gérée nativement (aucun snapshot).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.settle_ripe_relations()
returns table (
  relation_id     uuid,
  campaign_id     uuid,
  prospect_id     uuid,
  prospect_email  text,
  prospect_prenom text,
  pro_name        text,
  reward_cents    bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with ripe as (
    select r.id            as rid,
           r.pro_account_id,
           r.prospect_id,
           r.campaign_id,
           r.reward_cents
      from relations r
      join campaigns c on c.id = r.campaign_id
     where r.status = 'accepted'
       and c.status = 'completed'
     for update of r
  ),
  settled as (
    update relations r
       set status      = 'settled',
           settled_at  = now()
      from ripe
     where r.id = ripe.rid
    returning r.id              as rid,
             r.pro_account_id,
             r.prospect_id,
             r.campaign_id,
             r.reward_cents
  ),
  tx_update as (
    update transactions t
       set type        = 'credit',
           status      = 'completed',
           description = case
                           when t.description like 'Bonus parrain%'
                             then 'Bonus parrain crédité — campagne clôturée'
                           else 'Crédité — campagne clôturée'
                         end
      from settled s
     where t.relation_id  = s.rid
       and t.account_kind = 'prospect'
       and t.type         = 'escrow'
       and t.status       = 'pending'
    returning t.id
  )
  select s.rid,
         s.campaign_id,
         s.prospect_id,
         pi.email,
         pi.prenom,
         a.raison_sociale,
         s.reward_cents
    from settled s
    left join prospect_identity pi on pi.prospect_id = s.prospect_id
    left join pro_accounts      a  on a.id           = s.pro_account_id;
end;
$$;

revoke execute on function public.settle_ripe_relations() from public, anon;
grant  execute on function public.settle_ripe_relations() to authenticated, service_role;
```

(Seule différence avec l'existant : `c.created_at <= now() - interval '3 minutes'` → `c.status = 'completed'`, + libellés « campagne clôturée ».)

- [ ] **Step 2 : Appliquer sur le remote (MCP `execute_sql`, projet `yalgztstdmytviiyvixz`)**

Exécuter le contenu du fichier.

- [ ] **Step 3 : Vérifier le comportement (MCP, lecture seule)**

```sql
-- Une relation 'accepted' d'une campagne NON close ne doit PAS être settlable :
select count(*) as accepted_sur_campagnes_actives
from relations r join campaigns c on c.id=r.campaign_id
where r.status='accepted' and c.status <> 'completed';
-- (ce nombre doit rester inchangé après un appel à settle_ripe_relations)
select * from public.settle_ripe_relations();  -- ne doit settler QUE des relations de campagnes completed
```

- [ ] **Step 4 : Enregistrer dans l'historique migrations (MCP)**

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20260716120000', 'settle_on_campaign_closure') on conflict (version) do nothing;
```

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260716120000_settle_on_campaign_closure.sql
git commit -m "feat(db): settle escrow à la clôture de campagne (status=completed)"
```

---

## Task 2 : Helper pur `proCanSeeContacts`

**Files:**
- Create: `lib/pro/campaign-access.ts`
- Test: `tests/lib/pro/campaign-access.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
// tests/lib/pro/campaign-access.test.ts
import { describe, expect, it } from "vitest";
import { proCanSeeContacts } from "@/lib/pro/campaign-access";

describe("proCanSeeContacts", () => {
  it("autorise uniquement quand la campagne est clôturée", () => {
    expect(proCanSeeContacts("completed")).toBe(true);
    expect(proCanSeeContacts("active")).toBe(false);
    expect(proCanSeeContacts("paused")).toBe(false);
    expect(proCanSeeContacts("draft")).toBe(false);
    expect(proCanSeeContacts("canceled")).toBe(false);
    expect(proCanSeeContacts(null)).toBe(false);
    expect(proCanSeeContacts(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer (échec)** — `npx vitest run tests/lib/pro/campaign-access.test.ts` → FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

```ts
// lib/pro/campaign-access.ts
/**
 * Règle d'accès pro aux données par prospect : le pro ne voit les contacts
 * (liste, noms, révélation, détails) d'une campagne qu'une fois celle-ci
 * CLÔTURÉE (status='completed'). Avant clôture, seuls les compteurs sont
 * exposés. Cf. spec 2026-06-08-escrow-until-closure-pro-gating.
 */
export function proCanSeeContacts(
  campaignStatus: string | null | undefined,
): boolean {
  return campaignStatus === "completed";
}
```

- [ ] **Step 4 : Lancer (succès)** — `npx vitest run tests/lib/pro/campaign-access.test.ts` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add lib/pro/campaign-access.ts tests/lib/pro/campaign-access.test.ts
git commit -m "feat(pro): helper proCanSeeContacts (accès données après clôture)"
```

---

## Task 3 : Cron — fiabiliser la clôture (backstop)

**Files:**
- Modify: `app/api/admin/digest/route.ts`

- [ ] **Step 1 : Importer le helper de settlement**

Ajouter aux imports (après `sweepExpiredNonResponseRestrictions`) :

```ts
import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";
```

- [ ] **Step 2 : Appeler dans le bloc `daily`**

Dans le `if (mode === "daily") { ... }`, après le bloc `founderBonus` (try/catch), ajouter :

```ts
    // Piggyback : clôture des campagnes échues + libération des séquestres
    // (backstop fiable, indépendant des visites prospect). Idempotent.
    // Cf. lib/settle/ripe.ts + lib/lifecycle/campaign.ts.
    try {
      await settleRipeRelationsAndNotify(admin);
    } catch (err) {
      console.error("[/api/admin/digest] settle/lifecycle failed", err);
    }
```

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit` (clean) et `npx vitest run` (suite verte — la route digest n'a pas de test dédié, on vérifie juste qu'on n'a rien cassé).

- [ ] **Step 4 : Commit**

```bash
git add app/api/admin/digest/route.ts
git commit -m "feat(cron): clôture campagnes + settle séquestres en backstop quotidien"
```

---

## Task 4 : Route détail campagne — masquer les contacts avant clôture

**Files:**
- Modify: `app/api/pro/campaigns/[id]/route.ts`

- [ ] **Step 1 : Imports (helper + trigger clôture)**

Ajouter aux imports du fichier :

```ts
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";
```

- [ ] **Step 2 : Déclencher la clôture à l'accès pro**

Juste après la création du client admin (`const admin = createSupabaseAdminClient();`, repérer la ligne ; elle précède la lecture de la campagne `camp`), ajouter un best-effort :

```ts
  // À l'accès pro : clôture les campagnes échues (ends_at dépassé) pour que
  // les données apparaissent dès la fin. Best-effort, idempotent.
  try {
    await settleRipeRelationsAndNotify(admin);
  } catch (err) {
    console.error("[/api/pro/campaigns/GET] lifecycle trigger failed", err);
  }
```

(Important : ce déclenchement DOIT être avant la lecture de `camp` pour que `camp.status` reflète une éventuelle clôture qui vient d'avoir lieu. Si la lecture de `camp` est faite plus haut dans le fichier, relire `camp.status`/`camp.ends_at` après ce trigger — déplacer le trigger juste avant la requête qui charge `camp`.)

- [ ] **Step 3 : Gater la liste des contacts (≈ lignes 240-244)**

Remplacer :

```ts
  const contacts = filterCampaignContacts(allContacts, {
    status: contactStatus,
    scoreMin: contactScoreMin,
    period: contactPeriod,
  }).slice(0, 50);
```

par :

```ts
  // Données par prospect masquées tant que la campagne n'est pas clôturée :
  // le pro ne voit que les compteurs (funnel) avant la clôture.
  const contactsUnlocked = proCanSeeContacts(camp.status);
  const contacts = contactsUnlocked
    ? filterCampaignContacts(allContacts, {
        status: contactStatus,
        scoreMin: contactScoreMin,
        period: contactPeriod,
      }).slice(0, 50)
    : [];
```

- [ ] **Step 4 : Exposer le flag de verrouillage dans la réponse**

Dans l'objet `NextResponse.json({ ... })` final de la route (repérer le `return NextResponse.json({`), ajouter les champs :

```ts
    contactsLocked: !contactsUnlocked,
    lockedUntil: contactsUnlocked ? null : (camp.ends_at ?? null),
```

(Garder `funnel`, `acceptanceRate`, `activity` inchangés — les compteurs restent visibles. Si `activity` contient des noms de prospects, le masquer aussi quand `!contactsUnlocked` : remplacer `activity` par `[]` dans ce cas — vérifier le contenu de `activity` lignes ~246-260 et masquer si des identités y figurent.)

- [ ] **Step 5 : Vérifier**

Run: `npx tsc --noEmit` (clean), `npx vitest run` (vert), `npx eslint app/api/pro/campaigns/[id]/route.ts`.

- [ ] **Step 6 : Commit**

```bash
git add app/api/pro/campaigns/[id]/route.ts
git commit -m "feat(pro/campaign): masquer contacts avant clôture (compteurs conservés)"
```

---

## Task 5 : Route liste contacts — campagnes closes uniquement

**Files:**
- Modify: `app/api/pro/contacts/route.ts`

- [ ] **Step 1 : Trigger clôture + filtre campagnes closes**

Ajouter l'import :

```ts
import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";
```

Après `const admin = createSupabaseAdminClient();` (avant la requête relations, ≈ ligne 51), ajouter :

```ts
  try {
    await settleRipeRelationsAndNotify(admin);
  } catch (err) {
    console.error("[/api/pro/contacts] lifecycle trigger failed", err);
  }
```

- [ ] **Step 2 : Restreindre la requête aux campagnes `completed`**

Dans la requête `admin.from("relations").select(...)` (≈ lignes 61-73), passer le join campaigns en **inner** + filtrer sur le status :

Remplacer le bloc select/filtres :

```ts
    .select(
      `id, decided_at, status, campaign_id, evaluation, evaluated_at,
       campaigns ( id, name, targeting ),
       prospects:prospect_id ( id, bupp_score,
         prospect_identity ( prenom, nom, email, telephone )
       )`,
    )
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .order("decided_at", { ascending: false })
    .limit(200);
```

par :

```ts
    .select(
      `id, decided_at, status, campaign_id, evaluation, evaluated_at,
       campaigns!inner ( id, name, status, targeting ),
       prospects:prospect_id ( id, bupp_score,
         prospect_identity ( prenom, nom, email, telephone )
       )`,
    )
    .eq("pro_account_id", proId)
    .in("status", ["accepted", "settled"])
    .eq("campaigns.status", "completed")
    .order("decided_at", { ascending: false })
    .limit(200);
```

(Le `!inner` + `.eq("campaigns.status","completed")` filtre les relations dont la campagne est close. Les acceptés de campagnes en cours n'apparaissent plus dans la liste Contacts. Le type `Row.campaigns` gagne un champ `status: string` — l'ajouter à l'interface `Row` ligne ~87 : `campaigns: { id: string; name: string; status: string; targeting: ... } | null`.)

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit`, `npx vitest run`, `npx eslint app/api/pro/contacts/route.ts`.

- [ ] **Step 4 : Commit**

```bash
git add app/api/pro/contacts/route.ts
git commit -m "feat(pro/contacts): n'exposer que les campagnes clôturées"
```

---

## Task 6 : Route acceptances — campagnes closes uniquement

**Files:**
- Modify: `app/api/pro/acceptances/route.ts`

- [ ] **Step 1 : Trigger clôture**

Ajouter l'import `import { settleRipeRelationsAndNotify } from "@/lib/settle/ripe";` et, après `const admin = createSupabaseAdminClient();` (≈ ligne 47) :

```ts
  try {
    await settleRipeRelationsAndNotify(admin);
  } catch (err) {
    console.error("[/api/pro/acceptances] lifecycle trigger failed", err);
  }
```

- [ ] **Step 2 : Filtrer aux campagnes `completed`**

Dans la requête (≈ lignes 48-61), passer campaigns en inner + filtre :

Remplacer :

```ts
      `id, status, reward_cents, decided_at,
       campaigns ( name, targeting ),
       prospects:prospect_id ( bupp_score,
         prospect_identity ( prenom, nom )
       )`,
```

par :

```ts
      `id, status, reward_cents, decided_at,
       campaigns!inner ( name, status, targeting ),
       prospects:prospect_id ( bupp_score,
         prospect_identity ( prenom, nom )
       )`,
```

et ajouter après `.in("status", ["accepted", "settled"])` :

```ts
    .eq("campaigns.status", "completed")
```

(Ajouter `status: string` au type `Row.campaigns` ligne ~72.)

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit`, `npx vitest run`, `npx eslint app/api/pro/acceptances/route.ts`.

- [ ] **Step 4 : Commit**

```bash
git add app/api/pro/acceptances/route.ts
git commit -m "feat(pro/acceptances): n'exposer que les campagnes clôturées"
```

---

## Task 7 : reveal + details — 403 si campagne non close (garde-fou)

**Files:**
- Modify: `app/api/pro/contacts/[relationId]/reveal/route.ts`
- Modify: `app/api/pro/contacts/[relationId]/details/route.ts`

- [ ] **Step 1 : reveal — ajouter le status campagne au select + garde**

Dans `reveal/route.ts`, importer le helper :

```ts
import { proCanSeeContacts } from "@/lib/pro/campaign-access";
```

Modifier le select de la relation (≈ lignes 60-69) pour inclure la campagne :

```ts
    .select(
      `id, status, pro_account_id,
       campaigns:campaign_id ( status ),
       prospects:prospect_id (
         prospect_identity ( email, telephone, prenom, nom )
       )`,
    )
```

Étendre le type `Row` (≈ ligne 80) avec `campaigns: { status: string } | null;`.

Après la garde `if (row.status !== "accepted" && row.status !== "settled")` (≈ ligne 92-94), ajouter :

```ts
  if (!proCanSeeContacts(row.campaigns?.status)) {
    return NextResponse.json({ error: "campaign_not_closed" }, { status: 403 });
  }
```

- [ ] **Step 2 : details — même garde**

Dans `details/route.ts` : importer `proCanSeeContacts`, ajouter `campaigns:campaign_id ( status )` au select de la relation, étendre le type, et après la vérification `status ∈ {accepted, settled}` ajouter la même garde 403 `campaign_not_closed`. (Lire le fichier pour repérer le select + la garde de status existante et insérer juste après.)

- [ ] **Step 3 : Vérifier**

Run: `npx tsc --noEmit`, `npx vitest run`, `npx eslint "app/api/pro/contacts/[relationId]/reveal/route.ts" "app/api/pro/contacts/[relationId]/details/route.ts"`.

- [ ] **Step 4 : Commit**

```bash
git add "app/api/pro/contacts/[relationId]/reveal/route.ts" "app/api/pro/contacts/[relationId]/details/route.ts"
git commit -m "feat(pro/reveal): 403 tant que la campagne n'est pas clôturée"
```

---

## Task 8 : UI web Pro — état verrouillé

**Files:**
- Modify: `public/prototype/components/Pro.jsx`

> Prototype JSX (Babel navigateur, pas de tsc/vitest). Vérification visuelle. Cache busté au déploiement.

- [ ] **Step 1 : Détail campagne — bloc contacts verrouillé**

Lire la zone du détail campagne qui rend la liste des contacts (consomme `/api/pro/campaigns/[id]` ; chercher où `contacts` / `contactsCount` est rendu, ≈ lignes 1240-1300). Quand la réponse a `contactsLocked === true`, remplacer le rendu de la liste des contacts par un encart verrouillé, en gardant les compteurs déjà affichés (acceptés/refusés du funnel) :

```jsx
{data.contactsLocked ? (
  <div className="card" style={{ padding: 20, textAlign: 'center' }}>
    <Icon name="lock" size={20} />
    <div className="serif" style={{ fontSize: 16, marginTop: 8 }}>
      Données des prospects disponibles à la clôture
    </div>
    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
      {data.lockedUntil
        ? 'Déblocage le ' + new Date(data.lockedUntil).toLocaleDateString('fr-FR')
        : 'Déblocage à la clôture de la campagne'}
    </div>
    <div className="row center gap-4" style={{ marginTop: 12 }}>
      <span><strong>{data.funnel?.accepted ?? 0}</strong> acceptés</span>
      <span><strong>{data.funnel?.refused ?? 0}</strong> refusés</span>
    </div>
  </div>
) : (
  /* rendu existant de la liste des contacts */
)}
```

Vérifier que l'icône `lock` existe dans le composant `Icon` (cf. `Shell.jsx`) ; sinon utiliser une icône présente (`'lockClosed'`, `'shield'`…) ou l'emoji 🔒.

- [ ] **Step 2 : Section Contacts — note campagnes en cours**

Dans le composant `Contacts()` (≈ ligne 5080), comme l'API ne renvoie plus que les campagnes closes, ajouter une note discrète en tête de liste : « Les campagnes en cours apparaîtront ici à leur clôture. » (Texte simple, pas de logique.)

- [ ] **Step 3 : Vérification visuelle locale**

Run: `npm run dev` ; en pro, ouvrir une campagne **active** ayant des acceptés → voir l'encart verrouillé + compteurs ; ouvrir une campagne **clôturée** → voir la liste des contacts (comportement actuel).

- [ ] **Step 4 : Commit**

```bash
git add public/prototype/components/Pro.jsx
git commit -m "feat(pro/web): état verrouillé des contacts avant clôture de campagne"
```

---

## Task 9 : Prospect web — vérification libellés (séquestre)

**Files:**
- Modify (si besoin): `public/prototype/components/Prospect.jsx`

- [ ] **Step 1 : Vérifier la carte « En séquestre » + la date de dispo**

Lire la zone `Portefeuille` (≈ lignes 2335-2463) : la carte « En séquestre » (sous-titre « Déblocage à la clôture de la campagne ») et `availableAt` (= `relation.campaigns.ends_at`) sont déjà corrects (lisent la date courante → gèrent la prolongation). Confirmer qu'aucun libellé ne mentionne un délai fixe (« 3 min », « 72h ») pour le séquestre.

- [ ] **Step 2 : Ajuster uniquement si un libellé trompeur existe**

Si un libellé évoque un délai fixe, le remplacer par « Déblocage à la clôture de la campagne ». Sinon, **aucun changement** (ne pas inventer de modif).

- [ ] **Step 3 : Commit (seulement si modifié)**

```bash
git add public/prototype/components/Prospect.jsx
git commit -m "fix(prospect/web): libellé séquestre = déblocage à la clôture"
```

---

## Task 10 : Finalisation Phase 1 (web) — suite + push + migration

- [ ] **Step 1 : Suite complète**

Run: `npx vitest run && npx tsc --noEmit && npx eslint`
Expected: tout vert.

- [ ] **Step 2 : Vérifier la migration appliquée (MCP)**

Confirmer que `settle_ripe_relations` contient bien `c.status = 'completed'` :
```sql
select pg_get_functiondef('public.settle_ripe_relations()'::regprocedure) ilike '%c.status = ''completed''%' as ok;
```

- [ ] **Step 3 : Push + déploiement**

```bash
git push -u origin feat/escrow-until-closure-pro-gating
```
Puis merge vers `main` (PR ou merge direct selon préférence) → Vercel déploie.

- [ ] **Step 4 : Vérif post-déploiement (santé routes)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://www.buupp.com/api/pro/contacts"   # 401 attendu (route saine)
```

---

## Task 11 (Phase 2) : Mobile — état verrouillé

> Branche `worktree-mobile-app` (worktree `.claude/worktrees/mobile-app`). Le back gate déjà via l'API ; seule l'UI mobile doit afficher l'état verrouillé.

- [ ] **Step 1 : Localiser les écrans pro mobile**

Dans le worktree mobile :
Run: `grep -rln "contactsLocked\|/api/pro/campaigns\|/api/pro/contacts\|acceptés\|En séquestre" mobile/app mobile/lib --include=*.tsx`
Identifier l'écran détail campagne pro et l'écran/liste contacts pro.

- [ ] **Step 2 : Détail campagne — encart verrouillé**

Quand `contactsLocked` est vrai (champ renvoyé par `/api/pro/campaigns/[id]`), afficher un encart « Données disponibles à la clôture » + compteurs acceptés/refusés, en réutilisant le thème (`useTheme().c`) et les patterns de cartes existants. Pas de liste, pas de révélation.

- [ ] **Step 3 : Liste contacts**

L'API ne renvoyant que les campagnes closes, la liste se vide naturellement pour les campagnes en cours ; ajouter une note « apparaîtront à la clôture » si pertinent.

- [ ] **Step 4 : Types mobiles**

Ajouter `contactsLocked?: boolean` et `lockedUntil?: string | null` au type de la réponse campagne pro dans `mobile/lib/queries.ts` (optionnels).

- [ ] **Step 5 : Vérifier + commit**

Run (worktree): `npx tsc --noEmit` + `npx eslint <fichiers>` ; vérif visuelle (Expo) ; commit sur `worktree-mobile-app`.

---

## Self-Review (couverture spec)

- Spec §A (settle à la clôture) → Task 1. ✔
- Spec §B (fiabiliser clôture : cron + accès pro) → Task 3 (cron) + Tasks 4/5/6 (trigger dans les routes pro). ✔
- Spec §C (gating pro) → Task 4 (campaign detail + contactsLocked), Task 5 (contacts), Task 6 (acceptances), Task 7 (reveal/details 403). ✔
- Spec §D (UI web pro) → Task 8. ✔
- Spec §E (prospect web) → Task 9. ✔
- Spec §F (mobile) → Task 11. ✔
- Spec §G (tests) → helper testé (Task 2) ; RPC vérifiée MCP (Task 1/10) ; routes vérifiées tsc/eslint + santé (les routes pro complexes ne sont pas mockées intégralement, conforme aux normes du repo ; le helper pur porte la logique de gating testable). Prolongation : couverte par le gating sur `completed` (pas de snapshot) + vérif MCP. ✔

Cohérence des types/noms : `proCanSeeContacts(status)` défini Task 2, consommé Tasks 4/7 ; champs `contactsLocked`/`lockedUntil` produits Task 4, consommés Tasks 8/11 ; `settleRipeRelationsAndNotify` réutilisé Tasks 3/4/5/6 ; `campaigns!inner` + `.eq("campaigns.status","completed")` Tasks 5/6.

Note tests : les routes pro complexes (campaigns/[id], contacts, acceptances) ne reçoivent pas de test vitest mocké intégral (chaînes Supabase lourdes, non couvertes ailleurs dans le repo) ; le gating est porté par le helper pur testé + vérif MCP + revue. C'est un choix assumé, à signaler en revue.
