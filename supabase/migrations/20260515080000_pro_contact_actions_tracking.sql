-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Suivi d'ouverture des emails pro→prospect (pixel transparent)
-- ════════════════════════════════════════════════════════════════════
-- Ajoute 2 colonnes à pro_contact_actions pour le pilier "tracking
-- d'ouverture" des emails envoyés via BUUPP :
--   - tracking_token : UUID embarqué dans le pixel 1×1 du HTML email.
--     Unique pour pouvoir retrouver la ligne au hit du pixel sans
--     exposer l'id réel.
--   - email_opened_at : timestamp du PREMIER hit (les hits suivants ne
--     l'écrasent pas — ce qui nous intéresse c'est la première ouverture).
--
-- Conformité CNIL (recommandations 2025 sur les pixels de tracking
-- email) : le pixel n'est inséré dans le HTML que si le prospect a
-- coché `prospect_identity.email_tracking_consent`. Cette logique vit
-- côté lib/email/pro-to-prospect — ici on stocke juste la donnée.
-- ════════════════════════════════════════════════════════════════════

alter table public.pro_contact_actions
  add column if not exists tracking_token uuid default gen_random_uuid(),
  add column if not exists email_opened_at timestamptz;

-- Index unique partiel sur les kinds 'email_sent' : un seul token par
-- envoi (les call_clicked ont aussi un token via le default mais on s'en
-- moque, on ne s'en sert pas).
create unique index if not exists pro_contact_actions_token_email_idx
  on public.pro_contact_actions (tracking_token)
  where kind = 'email_sent';
