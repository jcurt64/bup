import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

import { recordEvent } from "@/lib/admin/events/record";

describe("recordEvent", () => {
  beforeEach(() => {
    insertMock.mockReset();
    insertMock.mockResolvedValue({ data: null, error: null });
  });

  it("insert avec les champs minimums (type + severity par défaut info)", async () => {
    await recordEvent({ type: "prospect.signup" });
    expect(insertMock).toHaveBeenCalledWith({
      type: "prospect.signup",
      severity: "info",
      payload: {},
      prospect_id: null,
      pro_account_id: null,
      campaign_id: null,
      relation_id: null,
      transaction_id: null,
    });
  });

  it("propage severity, payload et toutes les FK fournies", async () => {
    await recordEvent({
      type: "campaign.created",
      severity: "warning",
      payload: { name: "X" },
      proAccountId: "p1",
      campaignId: "c1",
    });
    expect(insertMock).toHaveBeenCalledWith({
      type: "campaign.created",
      severity: "warning",
      payload: { name: "X" },
      prospect_id: null,
      pro_account_id: "p1",
      campaign_id: "c1",
      relation_id: null,
      transaction_id: null,
    });
  });

  it("ne throw jamais — log et avale en cas d'erreur DB", async () => {
    insertMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordEvent({ type: "system.cron_failed", severity: "critical" }),
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
