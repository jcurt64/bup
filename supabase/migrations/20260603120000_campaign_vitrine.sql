-- « La Vitrine » — option (2 €, OFFERTE à la 1re campagne du pro) qui ajoute le
-- lien du site web du pro sur l'annonce vue par les prospects et mesure les
-- clics. Deux colonnes sur `campaigns` + une table de clics (1 clic distinct
-- par prospect via la contrainte UNIQUE → ratio « X clics / Y acceptées »).
--
-- RLS activée sans policy : seul le service role écrit/lit (l'endpoint
-- /api/campaign/[id]/visit et le détail campagne passent par le client admin) ;
-- le client navigateur ne touche jamais la table directement.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS website_addon_paid_cents integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.campaign_website_clicks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  clicked_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS campaign_website_clicks_campaign_id_idx
  ON public.campaign_website_clicks (campaign_id);

ALTER TABLE public.campaign_website_clicks ENABLE ROW LEVEL SECURITY;
