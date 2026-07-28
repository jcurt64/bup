/**
 * Constantes d'affichage du gel des accès, isolées du lecteur serveur.
 *
 * `lib/app-config/access.ts` importe le client Supabase admin et
 * `unstable_cache` : l'importer depuis un composant client embarquerait du
 * code serveur dans le bundle. Ce module-ci ne contient que des littéraux,
 * il est donc sûr des deux côtés.
 */

/** Infobulle affichée au survol d'un bouton gelé. */
export const ACCESS_FROZEN_TOOLTIP = "Actif au lancement";
