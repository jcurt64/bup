// Définitions statiques des formules (features) — le prix et les caps
// viennent de /api/pro/plan (table plan_pricing). Aligné sur le web.
export type PlanId = "starter" | "pro";

export const PLAN_DEFS: {
  id: PlanId;
  label: string;
  badge?: string;
  features: string[];
}[] = [
  {
    id: "starter",
    label: "Starter",
    features: [
      "Jusqu'à 50 prospects par campagne",
      "2 campagnes par cycle",
      "Ciblage par paliers 1 à 3",
    ],
  },
  {
    id: "pro",
    label: "Pro",
    badge: "Recommandé",
    features: [
      "Jusqu'à 500 prospects par campagne",
      "10 campagnes par cycle",
      "Tous les paliers 1 à 5",
      "Accès anticipé aux nouvelles fonctionnalités",
    ],
  },
];
