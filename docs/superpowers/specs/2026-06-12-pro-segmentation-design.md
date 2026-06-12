# Atelier de segmentation pro — Design (sous-projet 1/3)

**Date** : 2026-06-12
**Statut** : Design validé, prêt pour plan d'implémentation
**Périmètre** : Backend + UI **web**. Mobile = passe dédiée ultérieure.

## Contexte & problème

Un pro qui lance une campagne à **500 contacts** (et jusqu'à **5 paliers de données** par contact) se retrouve noyé : l'onglet « Mes contacts » est un **tableau ligne-par-ligne** (groupé par campagne, 3 filtres simples, une fiche détaillée par prospect). Naviguer 500 lignes pour comprendre et exploiter son audience est impraticable.

Positionnement produit confirmé : BUUPP vend de la **donnée qualifiée pour cibler** (usage **B = segmentation** + **C = marketing de masse**). La donnée doit servir à **décider/cibler**, jamais à être exportée.

Ce document couvre **uniquement le sous-projet 1 : l'atelier de segmentation** — la fondation. Deux sous-projets suivront (specs séparées) :
- **SP2 — Diffusion médiée Brevo** : broadcast email/SMS/WhatsApp sur un segment (le pro ne voit jamais l'email/le numéro ; BUUPP envoie via Brevo).
- **SP3 — Durcissement anti-exfil** : appel vocal en **révélation contrôlée** (rate-limit + audit ; Brevo ne sait pas masquer la voix par API → compromis acté), watermark/dissuasion copie.

L'architecture d'ensemble (« Segment & Broadcast ») et le compromis voix ont été validés en amont.

## Objectif du sous-projet 1

Transformer « Mes contacts » en **atelier de segmentation** :
1. **Comprendre** son audience d'un coup d'œil (distributions agrégées).
2. **Filtrer** finement via des **facettes structurées** + **recherche texte**.
3. **Enregistrer** des **segments** réutilisables.

La couche **ne révèle aucune donnée brute supplémentaire** → neutre côté exfiltration. Elle s'ajoute **par-dessus** la liste et les actions de contact existantes (qui restent inchangées). Le **segment** produit sera l'unité consommée par SP2.

## Décisions structurantes (validées)

1. **Audience par campagne** (pas de pooling inter-campagnes en v1). Les paliers accessibles dépendent de ce que le pro a payé *par campagne* (`campaign.targeting.requiredTiers`) → segmenter à l'intérieur d'une campagne est cohérent. Inter-campagnes = évolution future.
2. **Facettes structurées + recherche texte**. Beaucoup de champs paliers sont **déclaratifs en texte libre** (sports, poste, projets, secteur) → cardinalité ingérable en facette. On facette le **structuré** (score, région/CP, revenus, épargne, logement, statut pro, foyer, véhicule, animaux, statut « atteint ») et on offre une **recherche texte** plein-texte pour le reste.
3. **Segment = critères** (pas une liste figée d'IDs). On stocke la **définition de filtres** (JSON) → réévaluée à l'ouverture. Reste juste tant que la campagne reste clôturée (audience fixe).

## Contexte technique (existant vérifié)

- **Gating clôture** : `proCanSeeContacts(campaignStatus) === (status === "completed")` (`lib/pro/campaign-access.ts`). Aucune donnée contact avant clôture. **Inchangé**.
- **Liste contacts** : `GET /api/pro/contacts` (`app/api/pro/contacts/route.ts`) renvoie ≤200 lignes **masquées** (email `prenom•••@domain`, tel `XX •• •• •• XX`, nom `Prénom N.`), uniquement pour les campagnes `completed`.
- **Détail par contact** : `GET /api/pro/contacts/[relationId]/details` — paliers limités à `requiredTiers`, hors `removed_tiers`/`hidden_tiers` du prospect ; email watermarké.
- **Paliers & champs** : `schemas/tiers.ts` + `schemas/prospects.ts` ; tables Supabase séparées par palier (`prospect_identity`, `prospect_localisation`, `prospect_vie`, `prospect_pro`, `prospect_patrimoine`). Le mapping champ→palier de référence existe dans `app/api/pro/contacts/[relationId]/details/route.ts` (constante `TIER_FIELDS`).
- **UI** : `public/prototype/components/Pro.jsx`, section « Mes contacts » (table groupée par campagne + filtres `score≥720 / atteint / palier 2`).

## Architecture

```
Pro ouvre l'atelier d'une campagne (completed)
        │
        ├─ GET /api/pro/campaigns/[id]/audience
        │     → agrège les contacts acceptés en distributions (facettes),
        │       limité aux paliers achetés, hors paliers masqués/supprimés
        │     → { total, availableTiers, facets, savedSegments? }
        │
        ├─ Le pro applique facettes + recherche texte
        │     → GET /api/pro/contacts?campaignId=&filters=&q=
        │       → liste masquée filtrée + count (réutilise masking/gating existants)
        │
        └─ « Enregistrer ce filtre » → POST /api/pro/segments
              GET/DELETE pour charger/supprimer
```

Logique pure (scoring/agrégation/filtrage) isolée en libs testables ; les routes API restent fines (auth/gating/IO).

## Composants

### 1. `lib/pro/segmentation/facets.ts` *(nouveau, pur, testé)*

Construit les distributions à partir des lignes contacts décodées + la liste des paliers autorisés.

- `buildFacets(contacts: SegmentContact[], allowedTiers: TierKey[]): AudienceFacets`
- `SegmentContact` = forme normalisée d'un contact : `{ relationId, score, reached, identity?, localisation?, vie?, pro?, patrimoine? }` (chaque bloc présent seulement si palier autorisé ET non masqué).
- `AudienceFacets` = `{ total, score: Bucket[], region: Count[], revenus: Count[], epargne: Count[], logement: Count[], statutPro: Count[], foyer: Count[], vehicule: Count[], animaux: Count[], reached: Count[] }` — chaque clé n'est peuplée que si le palier source est autorisé.
- Buckets score : `[<600, 600–719, ≥720]`. Comptages catégoriels : `{ value, count }` triés par count desc (top N + « Autres » au-delà de N=12).

### 2. `lib/pro/segmentation/filter.ts` *(nouveau, pur, testé)*

- `SegmentFilters` = `{ scoreMin?, scoreMax?, regions?: string[], revenus?: string[], epargne?: string[], logement?: string[], statutPro?: string[], foyer?: string[], vehicule?: string[], animaux?: 'oui'|'non', reached?: 'atteint'|'non_atteint', q?: string }`.
- `matchesFilters(contact: SegmentContact, f: SegmentFilters): boolean` — ET logique entre critères ; `q` = recherche insensible casse/accents sur les champs texte libre des paliers autorisés (sports, poste, secteur, projets, ville, etc.).
- `sanitizeFilters(raw: unknown): SegmentFilters` — whitelist/borne les entrées client (réutilisable par l'API et la persistance segment).

### 3. `GET /api/pro/campaigns/[id]/audience` *(nouveau)*

- Vérifs : pro propriétaire de la campagne, campagne `completed` (`proCanSeeContacts`).
- Charge les relations `accepted|settled` de la campagne + les blocs paliers des prospects (limités à `requiredTiers`, hors `removed_tiers`/`hidden_tiers`).
- Décode en `SegmentContact[]`, appelle `buildFacets`.
- Réponse : `{ total, availableTiers, facets, savedSegments }` (`savedSegments` = segments du pro pour cette campagne).

### 4. `GET /api/pro/contacts` *(étendu)*

Ajoute des query params optionnels : `campaignId`, `filters` (JSON encodé ou params plats), `q`. Si présents : filtre côté serveur via `matchesFilters` avant le masking/troncature, renvoie `{ rows, count }`. **Sans** ces params : comportement actuel inchangé (rétro-compatible). Le **masking et le gating `completed` restent identiques**.

### 5. Segments enregistrés — table + `GET/POST/DELETE /api/pro/segments`

- Migration : `pro_segments (id uuid pk, pro_account_id uuid fk, campaign_id uuid fk, name text, filters jsonb not null default '{}', created_at timestamptz default now())` + index `(pro_account_id, campaign_id)` + RLS (un pro ne voit que ses segments).
- `POST` : `{ campaignId, name, filters }` (filters passés par `sanitizeFilters`) → crée.
- `GET ?campaignId=` : liste les segments du pro pour la campagne.
- `DELETE /api/pro/segments/[id]` : supprime (ownership vérifié).

### 6. UI — `Pro.jsx`, section Contacts *(modifié)*

- **Panneau Audience** en tête (quand une campagne `completed` est sélectionnée) : mini-distributions lisibles (barres score, top régions, paliers remplis, attributs clés) à partir de `facets`.
- **Barre de facettes** (chips/selects par champ structuré disponible) + **champ de recherche texte** → met à jour le compteur « N contacts » et la **liste existante** (qui devient le résultat filtré). Les facettes absentes (palier non acheté) ne s'affichent pas.
- **Segments** : bouton « Enregistrer ce filtre » (nom) ; liste déroulante « Mes segments » pour charger ; suppression.
- Les **actions de contact existantes** (appel/email/SMS/WhatsApp/détails) restent **inchangées** sur chaque ligne.

## Cas limites

- Campagne non clôturée → atelier indisponible (gating existant).
- Aucun palier structuré acheté (ex. seulement palier 1 « identité ») → facettes limitées au score + statut atteint ; recherche texte sur nom/prénom uniquement ; pas de panneau vide cassé.
- Palier masqué/supprimé par le prospect → ce contact n'est pas compté sur les champs de ce palier (et n'est pas matché par un filtre sur ces champs).
- Filtre ne renvoyant rien → état vide « Aucun contact pour ce filtre » + reset.
- Segment référant une campagne devenue non clôturée (annulée) → masqué/inactif.

## Non-objectifs (hors SP1)

- **Diffusion/broadcast** (SP2), **voix / anti-exfil / watermark** (SP3).
- **Pooling inter-campagnes**.
- **Faceting des champs texte libre** (couverts par la recherche).
- **Mobile** (passe dédiée).
- Aucune modification du masking, du gating clôture, ou de la révélation par champ existants.

## Tests

- **Unitaires** `lib/pro/segmentation/facets.ts` (vitest) : buckets score, comptages catégoriels + tri + « Autres », exclusion des paliers non autorisés, audience vide.
- **Unitaires** `lib/pro/segmentation/filter.ts` : ET entre critères, ranges score, multiselect, `q` insensible casse/accents sur champs autorisés uniquement, `sanitizeFilters` (whitelist/bornes).
- **API** : gating `completed`, ownership campagne, respect `requiredTiers`/masqués, forme `audience`, filtrage de `/api/pro/contacts` (rétro-compat sans params), CRUD segments + RLS.
- **Manuel web** : panneau audience, facettes live + compteur, recherche, save/load/delete segment, états vides.

## Fichiers touchés (prévision)

- `lib/pro/segmentation/facets.ts` + `facets.test.ts` *(nouveaux)*
- `lib/pro/segmentation/filter.ts` + `filter.test.ts` *(nouveaux)*
- `app/api/pro/campaigns/[id]/audience/route.ts` *(nouveau)*
- `app/api/pro/contacts/route.ts` *(étendu — params de filtre, rétro-compatible)*
- `app/api/pro/segments/route.ts` + `app/api/pro/segments/[id]/route.ts` *(nouveaux)*
- `supabase/migrations/<ts>_pro_segments.sql` *(nouveau — table + RLS)*
- `public/prototype/components/Pro.jsx` *(modifié — panneau audience, facettes, recherche, segments)*

Migration `pro_segments` à appliquer via SQL Editor + `migration repair` (jamais `db push`), conformément au process Supabase du projet.
