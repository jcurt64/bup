import { describe, it, expect, vi } from "vitest";

const counters = {
  waitlist: 124,
  prospects: 33,
  pros: 5,
  activeCampaigns: 4,
  campaignsCreated: 7,
  relationsSent: 50,
  relationsAccepted: 18,
  budgetCents: 200_00,
  spentCents: 80_00,
  creditedCents: 40_00,
  topupCents: 250_00,
  campaignChargeCents: 100_00,
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    rpc: vi.fn(async (fn: string) => {
      if (fn === "admin_overview_kpis") return { data: counters, error: null };
      return { data: null, error: { message: "unknown rpc " + fn } };
    }),
  }),
}));

import { fetchOverviewKpis } from "@/lib/admin/queries/overview";
import { rangeFor } from "@/lib/admin/periods";

describe("fetchOverviewKpis", () => {
  it("agrège la sortie de la RPC + applique le take-rate", async () => {
    process.env.BUUPP_TAKE_RATE = "0.20";
    const r = rangeFor("30d", new Date("2026-05-10T12:00:00Z"));
    const out = await fetchOverviewKpis(r);
    expect(out.waitlist).toBe(124);
    expect(out.prospects).toBe(33);
    expect(out.pros).toBe(5);
    expect(out.acceptanceRatePct).toBe(36);
    expect(out.estimatedRevenueCents).toBe(2000);
  });

  it("ne casse pas si BUUPP_TAKE_RATE absent (fallback 0.20)", async () => {
    delete process.env.BUUPP_TAKE_RATE;
    const r = rangeFor("30d", new Date("2026-05-10T12:00:00Z"));
    const out = await fetchOverviewKpis(r);
    expect(out.estimatedRevenueCents).toBe(2000);
  });
});
