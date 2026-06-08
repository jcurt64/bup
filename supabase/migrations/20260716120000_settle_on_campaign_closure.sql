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
