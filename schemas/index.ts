/**
 * Schémas partagés BUUPP — types canoniques côté front ET côté back
 * (route handlers, server actions, Supabase clients typés).
 *
 * Ces types décrivent la forme métier ; le mapping vers les colonnes
 * Supabase se fera dans `lib/supabase/types.ts` (regénéré via
 * `supabase gen types typescript --linked > lib/supabase/types.ts`).
 */

export * from "./tiers";
export * from "./prospects";
export * from "./pros";
export * from "./campaigns";
export * from "./relations";
export * from "./transactions";
