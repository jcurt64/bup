-- ════════════════════════════════════════════════════════════════════
-- BUUPP — Settlement automatique des relations matures (3 minutes)
-- ════════════════════════════════════════════════════════════════════
-- 3 minutes après le lancement d'une campagne (campaigns.created_at),
-- les relations 'accepted' associées passent automatiquement à 'settled' :
--   1. relations.status: accepted → settled, settled_at = now()
--   2. transactions du prospect (relation_id, type='escrow', status='pending')
--      → type='credit', status='completed' afin que /api/prospect/wallet
--      les compte dans `lifetimeGains` et `available` (les fonds quittent
--      le séquestre pour devenir disponibles).
--
-- La RPC est appelée en lazy au top des endpoints prospect (wallet,
-- movements, relations, fiscal). Elle est idempotente :
--   - FOR UPDATE sur relations bloque les transitions concurrentes.
--   - Seules les relations effectivement transitionnées sont renvoyées,
--     ce qui permet à l'appelant Node de notifier les prospects une seule
--     fois par mail (sendRelationSettled).
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
       and c.created_at <= now() - interval '3 minutes'
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
  -- Convertit l'escrow prospect (pending) en credit completed pour que
  -- les fonds remontent dans lifetimeGains/available côté wallet API.
  -- Utilisé uniquement pour son effet de bord (PG exécute toute CTE
  -- modifiante même si le SELECT final ne la référence pas).
  tx_update as (
    update transactions t
       set type        = 'credit',
           status      = 'completed',
           description = 'Crédité — délai de validation écoulé'
      from settled s
     where t.relation_id  = s.rid
       and t.account_kind = 'prospect'
       and t.account_id   = s.prospect_id
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
