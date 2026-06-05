import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_TYPE_LABELS,
  CATEGORY_LABELS,
  sanitizeCampaignTypeLabels,
  sanitizeCategoryLabels,
  campaignLabelsToEnum,
  buildPreferencesPatch,
  rowToPreferences,
} from "@/lib/prospect/preferences";

describe("sanitizeCampaignTypeLabels", () => {
  it("ne garde que les libellés connus, dédoublonne et borne", () => {
    expect(
      sanitizeCampaignTypeLabels([
        "Prise de contact",
        "Prise de contact", // doublon
        "INCONNU", // hors liste
        "Promotion",
        42, // type invalide
      ]),
    ).toEqual(["Prise de contact", "Promotion"]);
  });
  it("renvoie [] pour une entrée non-tableau", () => {
    expect(sanitizeCampaignTypeLabels("Promotion")).toEqual([]);
    expect(sanitizeCampaignTypeLabels(null)).toEqual([]);
  });
});

describe("sanitizeCategoryLabels", () => {
  it("ne garde que les catégories connues", () => {
    expect(
      sanitizeCategoryLabels(["Bien-être", "Finance", "PasUneCatégorie"]),
    ).toEqual(["Bien-être", "Finance"]);
  });
});

describe("campaignLabelsToEnum", () => {
  it("projette 6 libellés → 4 valeurs enum (collapse + dédup)", () => {
    // Événement / Téléchargement / Promotion → tous prise_de_contact
    expect(campaignLabelsToEnum(["Événement", "Téléchargement", "Promotion"])).toEqual([
      "prise_de_contact",
    ]);
  });
  it("mappe correctement chaque libellé canonique", () => {
    expect(campaignLabelsToEnum(["Prise de rendez-vous"])).toEqual(["prise_de_rendez_vous"]);
    expect(campaignLabelsToEnum(["Enquête & avis"])).toEqual(["information_sondage"]);
  });
  it("ignore les libellés inconnus", () => {
    expect(campaignLabelsToEnum(["nimporte quoi"])).toEqual([]);
  });
});

describe("buildPreferencesPatch", () => {
  it("mappe allCampaignTypes booléen", () => {
    expect(buildPreferencesPatch({ allCampaignTypes: true })).toEqual({
      all_campaign_types: true,
    });
    expect(buildPreferencesPatch({ allCampaignTypes: false })).toEqual({
      all_campaign_types: false,
    });
  });

  it("écrit campaign_objectives (libellés) ET campaign_types (enum projeté)", () => {
    expect(
      buildPreferencesPatch({ campaignTypes: ["Prise de contact", "Enquête & avis"] }),
    ).toEqual({
      campaign_objectives: ["Prise de contact", "Enquête & avis"],
      campaign_types: ["prise_de_contact", "information_sondage"],
    });
  });

  it("mappe allCategories + categories (libellés bruts)", () => {
    expect(
      buildPreferencesPatch({ allCategories: false, categories: ["Finance", "Auto"] }),
    ).toEqual({
      all_categories: false,
      categories: ["Finance", "Auto"],
    });
  });

  it("ignore les champs absents ou de type invalide (anti mass-assignment)", () => {
    expect(buildPreferencesPatch({ allCampaignTypes: "true" as unknown })).toEqual({});
    expect(buildPreferencesPatch({})).toEqual({});
    expect(buildPreferencesPatch({ foo: 1 } as never)).toEqual({});
  });
});

describe("rowToPreferences", () => {
  it("défaut opt-out : null/colonnes absentes ⇒ tout accepté", () => {
    expect(rowToPreferences(null)).toEqual({
      allCampaignTypes: true,
      campaignTypes: [],
      allCategories: true,
      categories: [],
    });
  });

  it("restitue fidèlement une sélection partielle", () => {
    expect(
      rowToPreferences({
        all_campaign_types: false,
        campaign_objectives: ["Prise de contact", "Promotion", "GLITCH"],
        all_categories: false,
        categories: ["Finance", "BAD"],
      }),
    ).toEqual({
      allCampaignTypes: false,
      campaignTypes: ["Prise de contact", "Promotion"],
      allCategories: false,
      categories: ["Finance"],
    });
  });

  it("expose les listes de référence non vides", () => {
    expect(CAMPAIGN_TYPE_LABELS.length).toBe(6);
    expect(CATEGORY_LABELS.length).toBeGreaterThan(0);
  });
});
