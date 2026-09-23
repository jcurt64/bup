-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Date de naissance : mois + année uniquement (MM/AAAA)
-- ════════════════════════════════════════════════════════════════════
-- Minimisation RGPD : le jour de naissance n'est pas nécessaire au
-- ciblage par tranche d'âge. On le supprime des données existantes et
-- l'API normalise désormais toute saisie en `MM/AAAA`.
--
-- La contrainte accepte encore `JJ/MM/AAAA` en transition (code déployé
-- avant la migration, clients mobiles pas encore mis à jour) ; l'API
-- tronque de toute façon avant écriture. À resserrer sur `^\d{2}/\d{4}$`
-- une fois le mobile mis à jour.
-- ════════════════════════════════════════════════════════════════════

alter table public.prospect_identity
  drop constraint if exists prospect_identity_naissance_format_chk;

update public.prospect_identity
set naissance = substring(naissance from 4)
where naissance ~ '^\d{2}/\d{2}/\d{4}$';

alter table public.prospect_identity
  add constraint prospect_identity_naissance_format_chk
  check (
    naissance is null
    or naissance ~ '^(\d{2}/)?\d{2}/\d{4}$'
  );
