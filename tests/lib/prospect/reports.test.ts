import { describe, it, expect, vi } from "vitest";
import { reportedRelationIds } from "@/lib/prospect/reports";

function fakeAdmin(rows: Array<{ relation_id: string }>) {
  const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: inFn,
        }),
      }),
    }),
    _inFn: inFn,
  };
}

describe("reportedRelationIds", () => {
  it("renvoie un Set vide quand aucune relation passée", async () => {
    const admin = fakeAdmin([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await reportedRelationIds(admin as any, "p1", []);
    expect(result.size).toBe(0);
  });

  it("renvoie l'ensemble des relation_id signalés", async () => {
    const admin = fakeAdmin([
      { relation_id: "r1" },
      { relation_id: "r3" },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await reportedRelationIds(admin as any, "p1", ["r1", "r2", "r3"]);
    expect([...result].sort()).toEqual(["r1", "r3"]);
  });

  it("renvoie un Set vide si l'admin retourne null", async () => {
    const inFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const admin = {
      from: () => ({ select: () => ({ eq: () => ({ in: inFn }) }) }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await reportedRelationIds(admin as any, "p1", ["r1"]);
    expect(result.size).toBe(0);
  });
});
