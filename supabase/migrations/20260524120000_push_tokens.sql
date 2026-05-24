-- Table des tokens push Expo, un par device. Plusieurs rows possibles
-- pour un même user_id (multi-device toléré). RLS activée mais sans
-- policy : seul le service role lit/écrit (le client passe par
-- /api/me/push-token, jamais directement sur la table).

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,
  expo_token    text NOT NULL UNIQUE,
  platform      text NOT NULL CHECK (platform IN ('ios','android')),
  app_version   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
