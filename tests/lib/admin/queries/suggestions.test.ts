import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { fetchSuggestionsList } from "@/lib/admin/queries/suggestions";

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

describe("fetchSuggestionsList", () => {
  it("status=unread → is(read_at, null)", async () => {
    await fetchSuggestionsList({ status: "unread", period: "all", page: 0 });
    expect(builderState.filters).toEqual(
      expect.arrayContaining([["read_at", null]]),
    );
  });

  it("status=resolved → not(resolved_at, is, null)", async () => {
    await fetchSuggestionsList({ status: "resolved", period: "all", page: 0 });
    expect(builder.not).toHaveBeenCalled();
  });

  it("status=all → ni is(read_at) ni not(resolved_at)", async () => {
    await fetchSuggestionsList({ status: "all", period: "all", page: 0 });
    expect(builder.is).not.toHaveBeenCalled();
    expect(builder.not).not.toHaveBeenCalled();
  });

  it("period=7d → gte sur created_at ~7j", async () => {
    await fetchSuggestionsList({ status: "all", period: "7d", page: 0 });
    expect(builderState.gte).not.toBeNull();
    const ageMs = Date.now() - new Date(builderState.gte!).getTime();
    expect(ageMs).toBeGreaterThanOrEqual(7 * 86_400_000 - 5000);
    expect(ageMs).toBeLessThanOrEqual(7 * 86_400_000 + 5000);
  });

  it("pagination via range(page*50, page*50+49)", async () => {
    await fetchSuggestionsList({ status: "all", period: "all", page: 2 });
    expect(builderState.range).toEqual([100, 149]);
  });

  it("mappe snake_case → camelCase", async () => {
    resultRowsRef.rows = [
      {
        id: "s1",
        from_email: "a@b.c",
        from_name: "Atelier",
        from_role: "pro",
        subject: "Idée",
        message: "Coucou",
        email_sent_at: "2026-05-19T10:00:00.000Z",
        email_message_id: "mid-1",
        read_at: null,
        read_by_clerk_id: null,
        resolved_at: null,
        resolved_by_clerk_id: null,
        resolved_note: null,
        created_at: "2026-05-19T09:00:00.000Z",
      },
    ];
    const out = await fetchSuggestionsList({ status: "all", period: "all", page: 0 });
    expect(out).toEqual([
      {
        id: "s1",
        fromEmail: "a@b.c",
        fromName: "Atelier",
        fromRole: "pro",
        subject: "Idée",
        message: "Coucou",
        emailSentAt: "2026-05-19T10:00:00.000Z",
        readAt: null,
        readByClerkId: null,
        resolvedAt: null,
        resolvedByClerkId: null,
        resolvedNote: null,
        createdAt: "2026-05-19T09:00:00.000Z",
      },
    ]);
  });

  it("retourne [] si erreur Supabase", async () => {
    builder.range.mockImplementationOnce(((a: number, b: number) => {
      builderState.range = [a, b];
      return Promise.resolve({ data: null, error: { message: "boom" } });
    }) as unknown as Parameters<typeof builder.range.mockImplementationOnce>[0]);
    const out = await fetchSuggestionsList({ status: "all", period: "all", page: 0 });
    expect(out).toEqual([]);
  });
});
