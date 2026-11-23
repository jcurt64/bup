/** Types partagés de l'atelier de segmentation pro.
 *
 * Pivot « mise en relation pure » : seules les données de contact
 * (prénom + initiale du nom) subsistent. Les anciens attributs des paliers
 * localisation / vie / pro / patrimoine ont disparu — les facettes
 * catégorielles sont donc toujours vides. Les clés restent déclarées pour
 * la compatibilité des segments enregistrés et des clients publiés. */

export type TierKey = "identity";

/** Contact normalisé pour la segmentation. Aucune donnée de contact
 *  sensible (email/téléphone) n'y figure. */
export type SegmentContact = {
  relationId: string;
  score: number;
  reached: "atteint" | "non_atteint" | null;
  /** Prénom + initiale du nom (toujours fournis à la personnalisation). */
  identity?: { prenom: string | null; nom: string | null };
};

/** Anciennes facettes catégorielles (données supprimées) — conservées
 *  comme clés connues mais toujours ignorées / vides. */
export type CategoricalKey = "region" | "distance" | "logement" | "statutPro" | "foyer" | "vehicule" | "animaux";

export type SegmentFilters = {
  scoreMin?: number;
  scoreMax?: number;
  reached?: "atteint" | "non_atteint";
  q?: string;
};

export type FacetCount = { value: string; count: number };
export type ScoreBucket = { label: string; count: number };

export type AudienceFacets = {
  total: number;
  score: ScoreBucket[];
  reached: FacetCount[];
} & Partial<Record<CategoricalKey, FacetCount[]>>;
