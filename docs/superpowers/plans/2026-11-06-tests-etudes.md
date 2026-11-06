# Tests & Études — plan d'implémentation (web)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Module de campagnes rémunérées « tout ou rien » (sondage via lien, test site/appli, visite) : publication par le pro avec réservation, inscriptions publiques, preuve par code individuel, validation/paiement, contestation, signalement.

**Architecture:** Tables dédiées `study_*` + RPC plpgsql atomiques pour tout mouvement d'argent ; logique pure (validation, budget, états, badges, département) dans `lib/studies/*` testée en Vitest ; transitions d'échéance appliquées paresseusement à chaque lecture + balayage quotidien greffé sur le cron digest. UI : pages Next publiques `/tests-etudes`, onglets prototype dans un nouveau fichier `Studies.jsx` chargé par les routes prospect et pro, page admin Next.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), Supabase (PostgREST + RPC), Clerk, Brevo (via `lib/email/transport.ts`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-tests-etudes-design.md`

## Global Constraints

- Commission : `commissionCents(reward)` de `lib/pricing/commission.ts` (10 %, min 0,30 €). Pas de multiplicateur.
- Bornes : reward ≥ 100 c ; min ≥ 5 ; max ≤ 500 ; min ≤ max ; signup_deadline ∈ [J+2, J+60] ; completion_deadline ∈ [signup + 3 j, signup + 60 j] ; `visit` ⇒ scope `department`.
- Délais : revue pro 7 j ; contestation 7 j ; approbation pro tardive jusqu'à completion_deadline + 7 j ; purge codes/commentaires à closed + 30 j.
- Révélé au pro : prénom, alias, code, statut, commentaire. Jamais : nom, e-mail réel, téléphone, département.
- Migrations : fichier dans `supabase/migrations/`, appliqué en prod via SQL (Management API / SQL Editor) puis `supabase migration repair --status applied <version>` ; **jamais `db push`**.
- Flag `app_config.studies_enabled` (défaut false) : 404 pages publiques + API publiques, onglets masqués.
- Mention exacte : « Participation rémunérée via BUUPP ».
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Double paiement par lectures concurrentes qui balaient la même campagne → RPC verrouillent la ligne (`for update`) et vérifient le statut ; test d'idempotence de l'approbation (appel 2× = un seul débit).
2. Inscription au-delà du max (courses) → l'insert passe par RPC `join_study_tx` qui compte sous verrou ; test : join quand inscrits = max → `full`.
3. Prospect hors département / sans code postal → refus `out_of_area` ; test sur `departmentFromPostalCode` (64000→64, 20000→2A, 20200→2B, 97400→974, null→null).
4. Fuite de données au pro → la route détail pro sélectionne explicitement prénom/alias/code ; test du mapper `toProParticipant` (aucune clé email/nom/tel/departement).
5. Pro sans solde disponible → 402 `insufficient_funds` avec `missingCents` ; test de `studyBudgetMaxCents` et du garde.

---

### Task 1: Domaine pur `lib/studies`

**Files:**
- Create: `lib/studies/constants.ts`, `lib/studies/validate.ts`, `lib/studies/budget.ts`, `lib/studies/department.ts`, `lib/studies/status.ts`, `lib/studies/codes.ts`, `lib/studies/mappers.ts`
- Test: `tests/lib/studies/*.test.ts`

**Interfaces (Produces):**
- `STUDY_TYPES = ['survey','product_test','visit'] as const`; `StudyType`; `STUDY_TYPE_LABELS: Record<StudyType,string>` (« Sondage en ligne », « Test et avis sur un site ou une appli », « Visite en magasin ou rendez-vous d'échange »)
- `REJECT_REASONS` (clés `code_missing|code_invalid|incomplete|fraud|other` + libellés spec), `REPORT_REASONS` (`scam|payment|personal_data|forbidden_product|misleading|other`)
- `REVIEW_DAYS=7`, `DISPUTE_DAYS=7`, `LATE_APPROVAL_DAYS=7`, `PURGE_DAYS=30`, `MIN_REWARD_CENTS=100`, `MIN_PARTICIPANTS=5`, `MAX_PARTICIPANTS=500`, `REMINDER_HOURS=48`, `REPORT_ALERT_THRESHOLD=3`
- `validateStudyInput(raw: unknown, now: Date): {ok:true, value: StudyInput} | {ok:false, error: string}` ; `StudyInput = {type, title(3–120), description(20–4000), estimatedMinutes(1–600), externalUrl: string|null (https only), address: string|null, rewardCents, minParticipants, maxParticipants, scope:'department'|'national', department: string|null, signupDeadline: string, completionDeadline: string}`
- `studyUnitCostCents(reward) = reward + commissionCents(reward)` ; `studyBudgetMaxCents(max, reward)`
- `departmentFromPostalCode(cp: string|null): string|null`
- `studyBadge(c: {status, joinedCount, min, max}): {key:'open'|'remaining'|'validated'|'full'|'canceled'|'closed', label}`
- `generateParticipationCode(): string` → `BU-` + 4 chars de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- `toProParticipant(row)` → `{id, prenom, alias, code, status, doneComment, doneAt, reviewDueAt}`

- [ ] Step 1: tests — `validateStudyInput` rejette visit+national (`visit_requires_department`), min>max (`min_gt_max`), max 501, reward 99, signup J+1, completion < signup+3 j, url `http://` (`url_not_https`) ; accepte l'exemple spec (survey national 50–200, 200 c). `studyBudgetMaxCents(200,200)=46000`. `studyUnitCostCents(200)=230`, `(1000)=1100`. Badges : published 12/50/200 → `remaining` « Plus que 38 participants » ; 50/50/200 → `open` « Inscriptions ouvertes » ; 200/50/200 → `full` « Complète ». Département (cas Review Focus 3). `toProParticipant` sans clés sensibles. Code : regex `^BU-[A-HJ-NP-Z2-9]{4}$`.
- [ ] Step 2: `npx vitest run tests/lib/studies` → FAIL
- [ ] Step 3: implémenter
- [ ] Step 4: → PASS
- [ ] Step 5: commit `feat(studies): domaine pur (validation, budget, badges, département)`

### Task 2: Schéma + RPC (migration `20261107120000_studies_module.sql`)

**Files:** Create migration ; Modify `lib/supabase/types.ts` (ajout manuel des tables/colonnes/RPC).

**Schéma:**
- `study_campaigns(id, pro_account_id fk, type text check, title, description, estimated_minutes, external_url, address, reward_cents, commission_cents, min_participants, max_participants, scope text check, department text, signup_deadline, completion_deadline, status text check in (draft,published,validated,canceled,closed) default draft, cancel_reason text, budget_reserved_cents bigint default 0, fraud_terms_accepted_at, published_at, validated_at, canceled_at, closed_at, purged_at, created_at, updated_at)` ; index (status, signup_deadline), (pro_account_id).
- `study_participations(id, campaign_id fk cascade, prospect_id fk cascade, status text check in (joined,confirmed,done,approved,rejected,disputed,rejected_final,not_done), code text unique, done_at, done_comment, review_due_at, approved_at, approved_by text check in (pro,auto,admin), rejected_at, reject_reason, reject_note, disputed_at, dispute_note, resolved_at, reminder_sent_at, consent_at, created_at)`, unique (campaign_id, prospect_id).
- `study_reports(id, campaign_id, prospect_id, reason, note, created_at, unique(campaign_id,prospect_id))`
- `study_notifications(id, prospect_id, campaign_id, kind text, created_at, read_at)` index (prospect_id, created_at desc)
- `prospects.studies_email_digest boolean default false`, `prospects.studies_digest_sent_at timestamptz`
- `app_config.studies_enabled boolean default false`
- `transactions.study_participation_id uuid fk set null`
- `relation_email_aliases`: `relation_id` nullable, `study_participation_id uuid unique fk cascade`, check `num_nonnulls(relation_id, study_participation_id) = 1`
- RLS activée, aucune policy (accès service_role uniquement).

**RPC (security definer, `for update` sur la campagne, erreurs via `raise exception '<code>'`):**
- `publish_study_tx(p_id)` : draft→published ; budget = max × (reward+commission) ; exige solde−réservé ≥ budget sinon `insufficient_funds` ; `wallet_reserved += budget`.
- `join_study_tx(p_campaign, p_prospect)` : exige published & now < signup_deadline ; compte joined < max sinon `full` ; insert ; si count+1 = max → appelle validation.
- `validate_study_tx(p_id)` : published→validated ; participations joined→confirmed avec code (généré en SQL même alphabet, retry sur collision).
- `cancel_study_tx(p_id, p_reason)` : published|draft→canceled ; delete participations ; libère réservation. Pour `admin_suspended` sur validated : delete joined/confirmed/not_done, garde done/rejected/disputed, réservation réduite à (nb gardées × coût unitaire).
- `approve_study_participation_tx(p_participation, p_by)` : statut ∈ (confirmed,done,rejected,disputed,not_done) sinon no-op retourne false ; débit pro reward (`campaign_charge`) + commission (`buupp_commission`), `wallet_balance −=`, `wallet_reserved −=`, `budget_reserved −=` ; crédit prospect `credit completed` ; descriptions « Tests & Études — <titre> ».
- `close_study_tx(p_id)` : validated→closed si aucune participation en (confirmed,done,rejected,disputed) en attente ; libère `budget_reserved` résiduel.

- [ ] Step 1: écrire la migration + types
- [ ] Step 2: appliquer en prod (Management API `POST /v1/projects/{ref}/database/query` avec `SUPABASE_ACCESS_TOKEN`), vérifier les objets, `migration repair`
- [ ] Step 3: `npx tsc --noEmit` → OK ; commit `feat(studies): schéma + RPC`

### Task 3: Serveur — dépôt, flag, balayage

**Files:** Create `lib/studies/flag.ts`, `lib/studies/sweep.ts`, `lib/studies/repo.ts`, `lib/studies/notify.ts` ; Test `tests/lib/studies/sweep.test.ts`

**Interfaces:**
- `getStudiesEnabled(): Promise<boolean>` (unstable_cache 60 s, tag `app-config:studies`, fail-closed)
- `planTransitions(c, participations, now): Transition[]` (pur) ; `Transition = {kind:'validate'|'cancel'|'not_done'|'auto_approve'|'reject_final'|'close'|'purge', id}` — règles : published & now ≥ signup → validate si joined ≥ min sinon cancel ; validated : confirmed & now ≥ completion → not_done ; done & now ≥ review_due → auto_approve ; rejected & now ≥ rejected_at+7 j → reject_final ; not_done éligible à approbation tardive jusqu'à completion+7 j ; close quand plus rien d'ouvert et now ≥ completion+7 j ; purge si closed & now ≥ closed+30 j & !purged.
- `sweepStudy(admin, id)` / `sweepAllStudies(admin)` : charge, `planTransitions`, exécute RPC/updates, déclenche `notify*` (after-safe, jamais bloquant).
- `repo.ts` : `listPublicStudies(admin, filters)`, `getPublicStudy(admin, id)` (avec pro raison_sociale, counts), `prospectContext(admin, clerkId)` → `{prospectId, prenom, email, department}`.

- [ ] Step 1: tests `planTransitions` (chaque règle + aucun doublon + exemple complet) → FAIL
- [ ] Step 2: implémenter → PASS ; commit

### Task 4: API publique + pages `/tests-etudes`

**Files:** `app/api/studies/route.ts` (GET liste, filtres `department,type,minReward,deadlineBefore`), `app/api/studies/[id]/route.ts` (GET), `app/tests-etudes/page.tsx`, `app/tests-etudes/[id]/page.tsx`, `app/tests-etudes/_components/*`, Modify `proxy.ts` (routes publiques), `app/_components/SiteChrome.tsx` (menu + footer si flag), `app/sitemap.ts`.

- Fiche : tous les champs spec §11 ; lien externe/adresse jamais dans la réponse publique ; boutons Participer (POST join ; anonyme → `/connexion?redirect=`), Partager, Signaler.
- [ ] vérif : `curl localhost/api/studies` (flag off → 404) ; rendu page en local flag on ; commit

### Task 5: API prospect + onglet prospect

**Files:** `app/api/prospect/studies/route.ts` (GET mes participations + notifications non lues), `app/api/studies/[id]/join|withdraw|done|dispute|report/route.ts` (POST), `app/api/prospect/studies/prefs/route.ts` (GET/PATCH `studies_email_digest`), `app/api/studies/unsubscribe/route.ts` (GET signé HMAC `prospectId`), Create `public/prototype/components/Studies.jsx` (`ProspectStudiesPanel`, `ProStudiesPanel`), Modify `public/prototype/shell.html` (charger Studies avant Prospect/Pro), `Prospect.jsx` (section `etudes` « Tests & Études » + rendu), `lib/prospect/transactions.ts` (libellé).

- join : consentement `consent: true` requis ; palier 1 (prénom + e-mail) sinon `tier1_incomplete` ; département ; `join_study_tx`.
- withdraw : seulement statut joined & campagne published.
- done : confirmed & now < completion ; commentaire ≤ 500.
- dispute : rejected & now < rejected_at + 7 j ; note ≤ 1000 ; alerte admin.
- [ ] tests unitaires des gardes (fonctions pures `canWithdraw/canMarkDone/canDispute` dans `lib/studies/status.ts`) ; commit

### Task 6: API pro + onglet pro

**Files:** `app/api/pro/studies/route.ts` (GET liste, POST créer brouillon/publier), `app/api/pro/studies/[id]/route.ts` (GET détail + participants si validated, PATCH brouillon, POST `action: publish|cancel`), `app/api/pro/studies/[id]/participations/route.ts` (POST `{ids, action:'approve'|'reject', reason, note}`), Modify `Pro.jsx` (section `etudes`).
- Publication : `fraudTermsAccepted: true` requis ; 402 `{error:'insufficient_funds', missingCents}`.
- Approve tardif : autorisé jusqu'à completion+7 j ; reject seulement statut done|confirmed avant review_due.
- [ ] commit

### Task 7: Admin

**Files:** `app/buupp-admin/tests-etudes/page.tsx` (+ `_components`), `app/api/admin/studies/[id]/suspend/route.ts`, `app/api/admin/studies/participations/[id]/resolve/route.ts` (`decision: approve|reject_final`), lien dans `AdminShell`.
- [ ] commit

### Task 8: E-mails, notifications, cron

**Files:** `lib/email/studies.ts` (un module, une fonction par mail du spec §10), Modify `app/api/admin/digest/route.ts` (appel `sweepAllStudies` + digest e-mail prospects + rappels J-2 avant le digest), `lib/studies/notify.ts`.
- Publication → insert `study_notifications` pour prospects éligibles (département via code postal, palier 1).
- [ ] commit

### Task 9: Alias e-mail participations

**Files:** Modify `lib/aliases/relation-email.ts` (`getOrCreateStudyAlias(admin, participationId)`, `resolveAlias` gère les deux), `app/api/inbound/brevo/route.ts` (header `X-BUUPP-Study`). Test : `tests/lib/aliases` si mockable, sinon vérif E2E.
- [ ] commit

### Task 10: Textes légaux

**Files:** `app/cgv`, `app/cgu`, `app/rgpd` (+ `page-versions.ts` si versionné).
- [ ] commit

### Task 11: Vérification de bout en bout

- `npx tsc --noEmit`, `npm run lint` (pas de nouvelle erreur), `npx vitest run`.
- Script E2E prod sur données `[TEST]` @example.invalid (même modèle que `e2e-exclude-past.ts`) : publication/réservation, join ×5, validation, done, approve (idempotence), reject → dispute → admin approve, cancel libère, close libère ; nettoyage complet.
- Vérif visuelle localhost (flag on en local via override env `STUDIES_FORCE_ENABLED=1` en dev uniquement).
- Push main (flag off en prod).
