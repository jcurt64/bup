import { describe, it, expect } from "vitest";
import {
  ALREADY_ACCEPTED_PRO_MESSAGE,
  defaultExcludePastAcceptors,
  excludesPastAcceptors,
  hasAcceptedProRecently,
  isPastAcceptorRelation,
  pastAcceptorCutoffIso,
  pastAcceptorProspectIds,
} from "@/lib/campaigns/past-acceptors";
import { classifyExcludePastAcceptorsWiden } from "@/lib/campaigns/edit-targeting";

const NOW = new Date("2026-10-24T12:00:00.000Z");
const CUTOFF = pastAcceptorCutoffIso(NOW);

describe("pastAcceptorCutoffIso", () => {
  it("recule de 12 mois", () => {
    expect(CUTOFF).toBe("2025-10-24T12:00:00.000Z");
  });
});

describe("defaultExcludePastAcceptors", () => {
  it("coché par défaut pour contact et rdv seulement", () => {
    expect(defaultExcludePastAcceptors("contact")).toBe(true);
    expect(defaultExcludePastAcceptors("rdv")).toBe(true);
    expect(defaultExcludePastAcceptors("evt")).toBe(false);
    expect(defaultExcludePastAcceptors(null)).toBe(false);
  });
});

describe("excludesPastAcceptors", () => {
  it("seul true active l'option (absent ⇒ false)", () => {
    expect(excludesPastAcceptors({ excludePastAcceptors: true })).toBe(true);
    expect(excludesPastAcceptors({ excludePastAcceptors: "true" })).toBe(false);
    expect(excludesPastAcceptors({})).toBe(false);
    expect(excludesPastAcceptors(null)).toBe(false);
  });
});

describe("isPastAcceptorRelation", () => {
  const base = { status: "accepted", decided_at: "2026-05-01T00:00:00Z", campaign_id: "C1" };
  it("accepted/settled récents d'une autre campagne → true", () => {
    expect(isPastAcceptorRelation(base, { cutoffIso: CUTOFF, excludeCampaignId: "C2" })).toBe(true);
    expect(isPastAcceptorRelation({ ...base, status: "settled" }, { cutoffIso: CUTOFF })).toBe(true);
  });
  it("autres statuts → false", () => {
    for (const status of ["pending", "refused", "expired", null]) {
      expect(isPastAcceptorRelation({ ...base, status }, { cutoffIso: CUTOFF })).toBe(false);
    }
  });
  it("décidée il y a plus de 12 mois ou sans date → false", () => {
    expect(
      isPastAcceptorRelation({ ...base, decided_at: "2025-10-23T00:00:00Z" }, { cutoffIso: CUTOFF }),
    ).toBe(false);
    expect(isPastAcceptorRelation({ ...base, decided_at: null }, { cutoffIso: CUTOFF })).toBe(false);
  });
  it("même campagne exclue → false", () => {
    expect(isPastAcceptorRelation(base, { cutoffIso: CUTOFF, excludeCampaignId: "C1" })).toBe(false);
  });
});

/** Mock chaînable minimal de la requête PostgREST sur `relations`. */
function makeAdmin(rows: Record<string, unknown>[]) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "gte", "neq", "order", "range", "limit"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
  return { admin: { from: () => builder } as never, calls };
}

describe("pastAcceptorProspectIds", () => {
  it("renvoie les prospects distincts et filtre par pro / fenêtre / campagne", async () => {
    const { admin, calls } = makeAdmin([
      { prospect_id: "P1", status: "accepted", decided_at: "2026-09-01T00:00:00Z", campaign_id: "C1" },
      { prospect_id: "P1", status: "settled", decided_at: "2026-08-01T00:00:00Z", campaign_id: "C3" },
      { prospect_id: "P2", status: "settled", decided_at: "2026-01-01T00:00:00Z", campaign_id: "C1" },
      // Ligne hors fenêtre renvoyée par erreur : re-filtrée par le prédicat.
      { prospect_id: "P3", status: "accepted", decided_at: "2024-01-01T00:00:00Z", campaign_id: "C1" },
    ]);
    const ids = await pastAcceptorProspectIds(admin, "PRO", "CNEW", NOW);
    expect([...ids].sort()).toEqual(["P1", "P2"]);
    expect(calls).toContainEqual({ method: "eq", args: ["pro_account_id", "PRO"] });
    expect(calls).toContainEqual({ method: "in", args: ["status", ["accepted", "settled"]] });
    expect(calls).toContainEqual({ method: "gte", args: ["decided_at", CUTOFF] });
    expect(calls).toContainEqual({ method: "neq", args: ["campaign_id", "CNEW"] });
  });
});

describe("hasAcceptedProRecently", () => {
  it("true si une autre campagne du pro a été acceptée récemment", async () => {
    const { admin } = makeAdmin([
      { status: "accepted", decided_at: "2026-09-01T00:00:00Z", campaign_id: "C1" },
    ]);
    await expect(
      hasAcceptedProRecently(admin, { prospectId: "P", proAccountId: "PRO", campaignId: "C2", now: NOW }),
    ).resolves.toBe(true);
  });
  it("false sans relation éligible", async () => {
    const { admin } = makeAdmin([]);
    await expect(
      hasAcceptedProRecently(admin, { prospectId: "P", proAccountId: "PRO", campaignId: "C2", now: NOW }),
    ).resolves.toBe(false);
  });
  it("message serveur stable (contrat API)", () => {
    expect(ALREADY_ACCEPTED_PRO_MESSAGE).toBe(
      "Vous avez déjà accepté une campagne de ce professionnel : cette offre ne vous est pas destinée.",
    );
  });
});

describe("classifyExcludePastAcceptorsWiden (désactiver seulement)", () => {
  it("autorise true → false et false → false", () => {
    expect(classifyExcludePastAcceptorsWiden(true, false)).toEqual({ ok: true, value: false });
    expect(classifyExcludePastAcceptorsWiden(false, false)).toEqual({ ok: true, value: false });
    expect(classifyExcludePastAcceptorsWiden(true, true)).toEqual({ ok: true, value: true });
  });
  it("refuse l'activation en cours de campagne", () => {
    expect(classifyExcludePastAcceptorsWiden(false, true)).toEqual({
      ok: false,
      error: "exclude_past_acceptors_not_widening",
    });
    expect(classifyExcludePastAcceptorsWiden(undefined, true)).toEqual({
      ok: false,
      error: "exclude_past_acceptors_not_widening",
    });
  });
  it("refuse une valeur non booléenne", () => {
    expect(classifyExcludePastAcceptorsWiden(true, "false")).toEqual({
      ok: false,
      error: "exclude_past_acceptors_invalid",
    });
  });
});
