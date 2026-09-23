// Achats in-app (recharge du crédit pro, carte enregistrée, recharge auto).
//
// App Store Review Guidelines 3.1.1 / 3.1.3(g) : acheter de la visibilité
// consommée dans la même app (campagnes diffusées aux prospects BUUPP) doit
// passer par l'In-App Purchase d'Apple — un paiement Stripe exposerait l'app
// à un refus. Sur iOS, on masque donc tous les points d'achat (sans renvoyer
// vers le web, interdit hors storefront US) : le pro garde son solde, ses
// campagnes et ses factures ; il recharge depuis le site.
// Android et le web ne sont pas concernés.
//
// Pour réactiver les achats sur iOS (ex. après accord d'App Review), passer
// IOS_PURCHASES_ALLOWED à true.
import { Platform } from "react-native";

const IOS_PURCHASES_ALLOWED = false;

export const PURCHASES_ENABLED = Platform.OS !== "ios" || IOS_PURCHASES_ALLOWED;
