# Facturation électronique — étude d'implémentation BUUPP

> Réforme française de la facturation électronique (loi de finances 2022, art. 26).
> Étude réalisée le 21/06/2026. Vérifier le calendrier officiel avant le lancement.

## 1. Cadre légal

Trois briques :
- **e-invoicing** : les factures **B2B domestiques** (entreprises FR ↔ entreprises FR) doivent transiter sous forme **structurée** via une **plateforme agréée par l'État** (« PDP » — Plateforme de Dématérialisation Partenaire). ⚠️ Le portail public gratuit (PPF) a été recentré en 2024 : il ne fait **plus** la transmission gratuite → **passage par une PDP obligatoire** (payante).
- **e-reporting** : transmission à l'administration des données des ventes **B2C** et **internationales**.
- **statuts du cycle de vie** : suivi obligatoire (déposée, reçue, encaissée, refusée…).

### Calendrier
| Date | Obligation |
|---|---|
| **1ᵉʳ sept. 2026** | **Recevoir** des e-factures (toutes entreprises) + **émettre** (grandes entreprises & ETI) + e-reporting |
| **1ᵉʳ sept. 2027** | **Émettre** étendu à **PME / TPE / micro** |

**Conséquence pour Majelink (TPE/micro, franchise en base — cf. mention « TVA non applicable art. 293 B » des factures actuelles) :**
- obligation d'**émettre** = **1ᵉʳ sept. 2027** ;
- obligation de **recevoir** = **1ᵉʳ sept. 2026** (via une PDP).
- ⚠️ À confirmer (taille + régime TVA) car ça fixe l'échéance réelle.

## 2. Quelles factures sont concernées
La **vente B2B** de Majelink au pro = **la commission BUUPP (10 %)** (et l'éventuel accès au service). 
- Recharges de wallet (`topup`) = approvisionnement, **pas** une vente.
- Récompenses prospects = paiements sortants B2C → relèvent de l'**e-reporting**, pas de l'e-invoicing.

👉 L'e-facture = **la facture de commission émise au pro**.

## 3. Principe directeur : déléguer à une PDP via API
**Ne pas construire** : transmission, annuaire SIREN, statuts de cycle de vie, e-reporting, archivage à valeur probante (lourd + réglementé).
**Brancher une PDP agréée « API-first »** (ex. B2Brouter, Open Bee, Pennylane, Sellsy, Tiime…) : BUUPP envoie les **données de facture** (JSON), la PDP génère le **Factur-X** (PDF/A-3 + XML CII) et le transmet.

BUUPP garde : la **donnée** (qui facture qui, quoi, combien) + l'**UX** (afficher facture + statut). La PDP fait le reste.

## 4. Plan par phases

### Phase 0 — fondation données & mentions (sans dépendance externe) ✅ en cours
- `pro_accounts.numero_tva` (n° TVA intracom de l'acheteur).
- Table `invoices` persistée (numéro légal séquentiel **sans trou**, HT/TVA/TTC, snapshots vendeur/acheteur figés, lignes, champs PDP réservés) + fonction `next_invoice_number()`.
- 4 **nouvelles mentions** obligatoires sur la facture : SIREN émetteur **et** client, adresse de livraison, **type d'opération** (biens/services), option « TVA sur les débits ».

### Phase 1 — réception (échéance 2026)
- Choisir la PDP, créer le compte, clés API.
- Webhook de **réception** des factures fournisseurs + affichage espace pro/admin.

### Phase 2 — émission (échéance 2027, activable avant)
- À chaque facture de commission : POST données → PDP → Factur-X transmis.
- Stocker `pdp_invoice_id` + **statut cycle de vie** (webhook) et l'afficher au pro.
- e-reporting des flux B2C/encaissements via la PDP.

### Réutilisable tel quel
`lib/invoices/pdf.ts` (PDF lisible = représentation visuelle du Factur-X), données société `pro_accounts`, flux `transactions`.

## 5. Recommandation
**PDP en marque blanche via API + couche `invoices` propre côté BUUPP.** Effort moyen (1 intégration API + 1 table + UI statut), risque faible (conformité portée par la PDP). Construire la transmission soi-même = à proscrire.

## 6. Décisions ouvertes
1. **Taille / régime TVA de Majelink** → fixe l'échéance d'émission (2026 vs 2027) + le traitement TVA.
2. **Choix PDP** (tarif, DX, marque blanche) — comparer 2–3.
3. **Périmètre facturé au pro** : commission seule, ou plus ?
