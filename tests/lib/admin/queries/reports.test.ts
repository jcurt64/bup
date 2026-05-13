import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock des supabase queries. On ne teste pas l'aller-retour PostgREST,
// juste la composition des filtres et la forme du retour.
const builderState: {
  filters: Array<[string, unknown]>;
  gte: string | null;
  range: [number, number] | null;
  orderDesc: boolean;
} = { filters: [], gte: null, range: null, orderDesc: false };
const resultRowsRef: { rows: unknown[] } = { rows: [] };

const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn((col: string, val: unknown) => {
    builderState.filters.push([col, val]);
    return builder;
  }),
  is: vi.fn((col: string, val: unknown) => {
    builderState.filters.push([col, val]);
    return builder;
  }),
  not: vi.fn((col: string, _op: string, val: unknown) => {
    builderState.filters.push([col, val]);
    return builder;
  }),
  gte: vi.fn((_col: string, val: string) => {
    builderState.gte = val;
    return builder;
  }),
  order: vi.fn(() => {
    builderState.orderDesc = true;
    return builder;
  }),
  range: vi.fn((a: number, b: number) => {
    builderState.range = [a, b];
    return Promise.resolve({ data: resultRowsRef.rows, error: null });
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => ({
    from: () => builder,
  }),
}));

import { fetchReportsList } from "@/lib/admin/queries/reports";

beforeEach(() => {
  builderState.filters = [];
  builderState.gte = null;
  builderState.range = null;
  builderState.orderDesc = false;
  resultRowsRef.rows = [];
  builder.select.mockClear();
  builder.eq.mockClear();
  builder.is.mockClear();
  builder.not.mockClear();
  builder.gte.mockClear();
  builder.order.mockClear();
  builder.range.mockClear();
});

describe("fetchReportsList", () => {
  it("filtre par status=open via is(resolved_at, null)", async () => {
    await fetchReportsList({ status: "open", reason: "all", period: "all", page: 0 });
    expect(builderState.filters).toEqual(
      expect.arrayContaining([["resolved_at", null]]),
    );
  });

  it("filtre par status=resolved via not(resolved_at, is, null)", async () => {
    await fetchReportsList({ status: "resolved", reason: "all", period: "all", page: 0 });
    expect(builder.not).toHaveBeenCalled();
  });

  it("filtre par motif quand reason != 'all'", async () => {
    await fetchReportsList({ status: "all", reason: "faux_compte", period: "all", page: 0 });
    expect(builderState.filters).toEqual(
      expect.arrayContaining([["reason", "faux_compte"]]),
    );
  });

  it("applique un gte sur created_at quand period=7d", async () => {
    await fetchReportsList({ status: "all", reason: "all", period: "7d", page: 0 });
    expect(builderState.gte).not.toBeNull();
    const ageMs = Date.now() - new Date(builderState.gte!).getTime();
    expect(ageMs).toBeGreaterThanOrEqual(7 * 86_400_000 - 5000);
    expect(ageMs).toBeLessThanOrEqual(7 * 86_400_000 + 5000);
  });

  it("paginate via range(page*50, page*50+49)", async () => {
    await fetchReportsList({ status: "all", reason: "all", period: "all", page: 2 });
    expect(builderState.range).toEqual([100, 149]);
  });
});
