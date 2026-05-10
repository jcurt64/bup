import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

import { sendAdminCriticalAlert } from "@/lib/email/admin-alert";
vi.mock("@/lib/email/admin-alert", () => ({
  sendAdminCriticalAlert: vi.fn(async () => {}),
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
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "critical", type: "system.cron_failed" }),
    );
    err.mockRestore();
  });

  it("envoie un mail critical quand severity = critical", async () => {
    await recordEvent({
      type: "system.cron_failed",
      severity: "critical",
      payload: { what: "settle" },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(sendAdminCriticalAlert).toHaveBeenCalledWith({
      type: "system.cron_failed",
      payload: { what: "settle" },
      createdAt: expect.any(String),
    });
  });

  it("n'envoie PAS de mail pour severity info ou warning", async () => {
    (sendAdminCriticalAlert as unknown as { mockClear: () => void }).mockClear();
    await recordEvent({ type: "prospect.signup" });
    await recordEvent({ type: "relation.expired", severity: "warning" });
    await new Promise((r) => setTimeout(r, 0));
    expect(sendAdminCriticalAlert).not.toHaveBeenCalled();
  });

  it("ne déclenche JAMAIS de mail pour system.email_failed (anti-boucle)", async () => {
    (sendAdminCriticalAlert as unknown as { mockClear: () => void }).mockClear();
    await recordEvent({ type: "system.email_failed", severity: "warning" });
    await new Promise((r) => setTimeout(r, 0));
    expect(sendAdminCriticalAlert).not.toHaveBeenCalled();
  });
});
