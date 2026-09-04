import { describe, it, expect } from "vitest";
import { sendLaunchEmailsIfDue } from "@/lib/waitlist/launch-email";

const LAUNCH = "2026-09-05T12:00:00+00:00";
const T = Date.parse(LAUNCH);
const JOUR = 24 * 3_600_000;

/**
 * Faux client admin : ne connaît que `app_config` (une ligne) et
 * `waitlist` (vide). Toute lecture de `waitlist` est comptée, ce qui
 * permet de vérifier que le garde-fou coupe AVANT de lire la liste.
 */
function fakeAdmin(launchAt: string | null) {
  let waitlistReads = 0;
  // `collectWaitlistAudience` enchaîne select/not/order/is/limit puis
  // `await`e la requête : le stub doit donc être à la fois chaînable et
  // « thenable ».
  const chain: Record<string, unknown> = {
    select: () => chain,
    not: () => chain,
    is: () => chain,
    limit: () => chain,
    order: () => chain,
    then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
  };
  const admin = {
    from(table: string) {
      if (table === "app_config") {
        return {
          select: () => ({
            maybeSingle: async () => ({ data: { launch_at: launchAt }, error: null }),
          }),
        };
      }
      if (table === "waitlist") {
        waitlistReads += 1;
        return chain;
      }
      throw new Error(`table inattendue: ${table}`);
    },
  };
  return { admin, reads: () => waitlistReads };
}

describe("sendLaunchEmailsIfDue — fenêtre du filet quotidien", () => {
  it("ne fait rien avant l'heure du lancement, sans lire la liste", async () => {
    const f = fakeAdmin(LAUNCH);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await sendLaunchEmailsIfDue(f.admin as any, T - 60_000);
    expect(r).toBeNull();
    expect(f.reads()).toBe(0);
  });

  it("ne fait rien plus d'une semaine après, sans lire la liste", async () => {
    const f = fakeAdmin(LAUNCH);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await sendLaunchEmailsIfDue(f.admin as any, T + 8 * JOUR);
    expect(r).toBeNull();
    expect(f.reads()).toBe(0);
  });

  it("regarde la liste dans la semaine qui suit le lancement", async () => {
    const f = fakeAdmin(LAUNCH);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await sendLaunchEmailsIfDue(f.admin as any, T + JOUR);
    // Liste vide → rien à signaler, mais elle a bien été consultée.
    expect(r).toBeNull();
    expect(f.reads()).toBeGreaterThan(0);
  });

  it("ne fait rien si launch_at est absente ou illisible", async () => {
    for (const bad of [null, "pas une date"]) {
      const f = fakeAdmin(bad);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(await sendLaunchEmailsIfDue(f.admin as any, T + JOUR)).toBeNull();
      expect(f.reads()).toBe(0);
    }
  });
});
