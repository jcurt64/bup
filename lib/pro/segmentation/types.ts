/** Types partagés de l'atelier de segmentation pro. */

export type TierKey = "identity" | "localisation" | "vie" | "pro" | "patrimoine";

/** Contact normalisé pour la segmentation. Chaque bloc palier n'est présent
 *  que si le palier est acheté pour la campagne ET non masqué par le prospect.
 *  Aucune donnée de contact sensible (email/téléphone) n'y figure : on ne
 *  segmente que sur des attributs, jamais sur des identifiants. */
export type SegmentContact = {
  relationId: string;
  score: number;
  reached: "atteint" | "non_atteint" | null;
  identity?: { prenom: string | null; nom: string | null };
  localisation?: { region: string | null; ville: string | null; codePostal: string | null; adresse: string | null };
  vie?: { foyer: string | null; sports: string | null; animaux: string | null; vehicule: string | null; logement: string | null; mobilite: string | null };
  pro?: { poste: string | null; statut: string | null; secteur: string | null; revenus: string | null };
  patrimoine?: { residence: string | null; epargne: string | null; projets: string | null };
};

/** Champs catégoriels facettables + leur palier source. */
export type CategoricalKey = "region" | "revenus" | "epargne" | "logement" | "statutPro" | "foyer" | "vehicule" | "animaux";

export type SegmentFilters = {
  scoreMin?: number;
  scoreMax?: number;
  reached?: "atteint" | "non_atteint";
  q?: string;
  region?: string[];
  revenus?: string[];
  epargne?: string[];
  logement?: string[];
  statutPro?: string[];
  foyer?: string[];
  vehicule?: string[];
  animaux?: string[];
};

export type FacetCount = { value: string; count: number };
export type ScoreBucket = { label: string; count: number };

export type AudienceFacets = {
  total: number;
  score: ScoreBucket[];
  reached: FacetCount[];
} & Partial<Record<CategoricalKey, FacetCount[]>>;
