import { describe, it, expect } from "vitest";
import {
  PERIOD_KEYS,
  rangeFor,
  previousRangeOf,
  bucketize,
  type PeriodKey,
} from "@/lib/admin/periods";

const REF = new Date("2026-05-10T12:00:00Z");

describe("rangeFor", () => {
  it("today = aujourd'hui 00:00 → maintenant", () => {
    const r = rangeFor("today", REF);
    expect(r.start.toISOString()).toBe("2026-05-10T00:00:00.000Z");
    expect(r.end.toISOString()).toBe(REF.toISOString());
  });

  it("7d = J-7 00:00 → maintenant", () => {
    const r = rangeFor("7d", REF);
    expect(r.start.toISOString()).toBe("2026-05-03T00:00:00.000Z");
  });

  it("30d = J-30 00:00 → maintenant", () => {
    const r = rangeFor("30d", REF);
    expect(r.start.toISOString()).toBe("2026-04-10T00:00:00.000Z");
  });

  it("quarter = début trimestre courant → maintenant", () => {
    const r = rangeFor("quarter", REF);
    expect(r.start.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("12m = il y a 12 mois → maintenant", () => {
    const r = rangeFor("12m", REF);
    expect(r.start.toISOString()).toBe("2025-05-10T00:00:00.000Z");
  });

  it("all = epoch → maintenant", () => {
    const r = rangeFor("all", REF);
    expect(r.start.getTime()).toBe(0);
  });
});

describe("previousRangeOf", () => {
  it("renvoie une fenêtre de même durée juste avant", () => {
    const cur = rangeFor("30d", REF);
    const prev = previousRangeOf(cur);
    expect(prev.end.getTime()).toBe(cur.start.getTime());
    expect(cur.start.getTime() - prev.start.getTime()).toBe(
      cur.end.getTime() - cur.start.getTime(),
    );
  });
});

describe("bucketize", () => {
  it("≤30 j → buckets jour (label YYYY-MM-DD)", () => {
    const buckets = bucketize(rangeFor("7d", REF));
    expect(buckets).toHaveLength(8);
    expect(buckets[0].label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(buckets.at(-1)!.label).toBe("2026-05-10");
  });

  it("30d → buckets jour (cas charnière, span = 31 jours inclusif)", () => {
    const buckets = bucketize(rangeFor("30d", REF));
    expect(buckets).toHaveLength(31);
    expect(buckets[0].label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(buckets.at(-1)!.label).toBe("2026-05-10");
  });

  it("≤90 j → buckets semaine (label W##)", () => {
    const buckets = bucketize(rangeFor("quarter", REF));
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.length).toBeLessThanOrEqual(14);
    expect(buckets[0].label).toMatch(/^W\d{1,2}$/);
  });

  it("12m → buckets mois (label YYYY-MM)", () => {
    const buckets = bucketize(rangeFor("12m", REF));
    expect(buckets).toHaveLength(13);
    expect(buckets[0].label).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("PERIOD_KEYS", () => {
  it("contient les 6 valeurs canoniques", () => {
    const expected: PeriodKey[] = ["today", "7d", "30d", "quarter", "12m", "all"];
    expect([...PERIOD_KEYS]).toEqual(expected);
  });
});
