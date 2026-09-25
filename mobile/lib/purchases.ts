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
import { Platform } from "react-native";

const IOS_PURCHASES_ALLOWED = false;
const ANDROID_PURCHASES_ALLOWED = false;

export const PURCHASES_ENABLED =
  Platform.OS === "ios"
    ? IOS_PURCHASES_ALLOWED
    : Platform.OS === "android"
      ? ANDROID_PURCHASES_ALLOWED
      : true;
