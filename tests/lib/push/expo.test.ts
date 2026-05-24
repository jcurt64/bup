import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildClassicPayload, buildFlashPayload, sendBatch } from "@/lib/push/expo";

describe("buildClassicPayload", () => {
  it("compose le payload Expo classique avec emoji 👋", () => {
    const msg = buildClassicPayload({
      token: "ExponentPushToken[abc]",
      proName: "Coiffure Lola",
      rewardEur: 3.4,
      durationKey: "24h",
      relationId: "rel-1",
    });
    expect(msg).toEqual({
      to: "ExponentPushToken[abc]",
      title: "👋 Une nouvelle sollicitation",
      body: "Coiffure Lola · +3,40 € · expire dans 24h",
      data: { type: "classic", relationId: "rel-1", screen: "relations" },
      sound: "default",
      badge: 1,
      channelId: "solicitations-classic",
    });
  });

  it("formate les centimes en euros avec virgule française", () => {
    const msg = buildClassicPayload({
      token: "ExponentPushToken[abc]",
      proName: "X",
      rewardEur: 12,
      durationKey: "7d",
      relationId: "r",
    });
    expect(msg.body).toBe("X · +12,00 € · expire dans 7 jours");
  });
});

describe("buildFlashPayload", () => {
  it("compose le payload flash avec emoji ⚡, priority high, ttl 3600", () => {
    const msg = buildFlashPayload({
      token: "ExponentPushToken[xyz]",
      proName: "Garage Marc",
      rewardEur: 5.2,
      relationId: "rel-2",
      campaignId: "camp-9",
    });
    expect(msg).toEqual({
      to: "ExponentPushToken[xyz]",
      title: "⚡ Flash deal — 1h pour saisir",
      body: "Garage Marc · +5,20 € · prime ×2 jusqu'à la fin du flash",
      data: {
        type: "flash",
        relationId: "rel-2",
        campaignId: "camp-9",
        screen: "flash-deals",
      },
      sound: "default",
      badge: 1,
      channelId: "solicitations-flash",
      priority: "high",
      ttl: 3600,
    });
  });
});

describe("sendBatch", () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    global.fetch = realFetch;
    vi.useRealTimers();
  });

  function fakeAdmin(deleteSpy: ReturnType<typeof vi.fn>) {
    return {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          in: deleteSpy,
        }),
      }),
    };
  }

  it("envoie en chunks de 100, log les tickets ok, et delete les tokens DeviceNotRegistered", async () => {
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/push/send")) {
        return new Response(
          JSON.stringify({
            data: [
              { status: "ok", id: "t1" },
              { status: "error", message: "DeviceNotRegistered", details: { error: "DeviceNotRegistered" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/push/getReceipts")) {
        return new Response(
          JSON.stringify({ data: { t1: { status: "ok" } } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error("unexpected url " + url);
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const deleteSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const admin = fakeAdmin(deleteSpy);

    const messages = [
      { to: "ExponentPushToken[good]", title: "t", body: "b", data: {} },
      { to: "ExponentPushToken[bad]", title: "t", body: "b", data: {} },
    ];

    const promise = sendBatch(admin as never, messages);
    // Avancer le setTimeout 2s entre /send et /getReceipts.
    await vi.advanceTimersByTimeAsync(2100);
    await promise;

    // 2 appels fetch attendus.
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Token "bad" supprimé (par message ticket en erreur immédiate).
    expect(deleteSpy).toHaveBeenCalledWith("expo_token", ["ExponentPushToken[bad]"]);
  });
});
