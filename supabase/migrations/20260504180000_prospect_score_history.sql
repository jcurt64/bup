-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Historique journalier du BUUPP Score
-- ════════════════════════════════════════════════════════════════════
-- Stocke un snapshot du score (et de ses 3 axes) par jour et par
-- prospect. Alimenté en upsert par /api/prospect/score à chaque
-- recalcul ; l'API /api/prospect/score/history en dérive les courbes
-- 1M / 3M / 6M / 12M affichées dans le panel "Évolution".
-- ════════════════════════════════════════════════════════════════════

create table public.prospect_score_history (
  prospect_id uuid not null
    references public.prospects(id) on delete cascade,
  snapshot_date date not null,
  score int not null check (score >= 0 and score <= 1000),
  completeness_pct int not null default 0
    check (completeness_pct between 0 and 100),
  freshness_pct int not null default 0
    check (freshness_pct between 0 and 100),
  acceptance_pct int not null default 0
    check (acceptance_pct between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (prospect_id, snapshot_date)
);

create index prospect_score_history_prospect_date_idx
  on public.prospect_score_history (prospect_id, snapshot_date desc);

alter table public.prospect_score_history enable row level security;

-- Lecture owner-only ; les inserts passent par la route serveur
-- (service_role) → pas besoin de policy WITH CHECK pour authenticated.
create policy prospect_score_history_owner_select
  on public.prospect_score_history
  for select to authenticated
  using (
    exists (
      select 1 from public.prospects p
      where p.id = prospect_score_history.prospect_id
        and p.clerk_user_id = public.clerk_user_id()
    )
  );
