// Achats in-app (recharge du crédit pro, carte enregistrée, recharge auto).
//
// App Store Review Guidelines 3.1.1 / 3.1.3(g) : acheter de la visibilité
// consommée dans la même app (campagnes diffusées aux prospects BUUPP) doit
// passer par l'In-App Purchase d'Apple ; Google Play impose une règle
// comparable (Play Billing pour les biens numériques). Décision produit
// (25/09/2026) : AUCUN achat dans l'app, ni iOS ni Android — le pro garde
// son solde, ses campagnes et ses factures, et recharge depuis le site
// (Stripe, sans commission de store).
//
// Pour réactiver les achats sur une plateforme, passer le drapeau à true.
import { Linking, Platform } from "react-native";

const IOS_PURCHASES_ALLOWED = false;
const ANDROID_PURCHASES_ALLOWED = false;

export const PURCHASES_ENABLED =
  Platform.OS === "ios"
    ? IOS_PURCHASES_ALLOWED
    : Platform.OS === "android"
      ? ANDROID_PURCHASES_ALLOWED
      : true;

// Texte informatif affiché À LA PLACE des boutons de recharge quand les
// achats sont masqués. Volontairement neutre (App Store 3.1.1 / Play) :
// aucun lien, aucun bouton, aucun prix, aucune incitation à acheter ailleurs.
export const BALANCE_SOURCE_NOTE =
  "Votre solde s'approvisionne depuis votre espace professionnel sur le web.";

// Lien sortant « Recharger mon crédit » vers l'espace pro du SITE (Stripe).
// Décision produit (24/10/2026) : le pro peut ouvrir son espace web depuis
// l'appli pour recharger. ⚠️ Un lien vers un achat hors In-App Purchase
// peut être refusé par Apple (3.1.1, hors exceptions selon le pays) et par
// Google Play (paiements tiers) : passer le drapeau de la plateforme à
// false si la relecture le refuse — la mention neutre reprend sa place.
const IOS_WEB_RECHARGE_LINK = true;
const ANDROID_WEB_RECHARGE_LINK = true;

export const WEB_RECHARGE_LINK_ENABLED =
  !PURCHASES_ENABLED &&
  (Platform.OS === "ios"
    ? IOS_WEB_RECHARGE_LINK
    : Platform.OS === "android"
      ? ANDROID_WEB_RECHARGE_LINK
      : false);

const WEB_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://www.buupp.com";
export const WEB_RECHARGE_URL = `${WEB_BASE}/pro?recharge=1`;

// Texte affiché avec le bouton (version « lien sortant » de la mention).
export const BALANCE_WEB_LINK_NOTE =
  "Le crédit se recharge depuis votre espace professionnel sur buupp.com.";

/** Ouvre l'espace pro du site sur la fenêtre de recharge (navigateur). */
export function openWebRecharge() {
  void Linking.openURL(WEB_RECHARGE_URL).catch(() => {});
}
