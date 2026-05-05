-- Code unique d'authentification par campagne. Format actuel:
-- "BUUPP-XXXX-YYYY" généré au lancement; persisté ici pour pouvoir
-- l'afficher ultérieurement (cards "Mes campagnes", email d'acceptation
-- avec les 4 derniers caractères pour authentifier le pro auprès du prospect).
--
-- Nullable: les campagnes existantes n'ont pas (encore) de code.
alter table public.campaigns
  add column if not exists code text;
