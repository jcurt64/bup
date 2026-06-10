import { describe, it, expect } from "vitest";
import { generateSeed, hashSeed, drawWinners, verifyDraw } from "@/lib/freebuupp/draw";

const nums = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("freebuupp/draw", () => {
  it("hashSeed est déterministe et = sha256 hex 64 chars", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("drawWinners renvoie le bon nombre de gagnants distincts", () => {
    const seed = "deadbeef";
    const r = drawWinners({ seed, participants: nums(30), winnersCount: 5 });
    expect(r.winners).toHaveLength(5);
    expect(new Set(r.winners).size).toBe(5);
    r.winners.forEach((w) => expect(nums(30)).toContain(w));
  });

  it("est déterministe : même seed + mêmes participants => mêmes gagnants", () => {
    const a = drawWinners({ seed: "s1", participants: nums(50), winnersCount: 10 });
    const b = drawWinners({ seed: "s1", participants: nums(50), winnersCount: 10 });
    expect(a.winners).toEqual(b.winners);
  });

  it("seeds différents => tirages (généralement) différents", () => {
    const a = drawWinners({ seed: "s1", participants: nums(80), winnersCount: 10 });
    const b = drawWinners({ seed: "s2", participants: nums(80), winnersCount: 10 });
    expect(a.winners).not.toEqual(b.winners);
  });

  it("plafonne les gagnants au nombre de participants", () => {
    const r = drawWinners({ seed: "s", participants: nums(3), winnersCount: 5 });
    expect(r.winners).toHaveLength(3);
  });

  it("0 participant => aucun gagnant", () => {
    const r = drawWinners({ seed: "s", participants: [], winnersCount: 5 });
    expect(r.winners).toEqual([]);
  });

  it("verifyDraw confirme un tirage honnête et rejette un trucage", () => {
    const seed = generateSeed();
    const participants = nums(50);
    const r = drawWinners({ seed, participants, winnersCount: 5 });
    expect(verifyDraw({
      seed, seedHash: hashSeed(seed), participants, winnersCount: 5, claimedWinners: r.winners,
    })).toBe(true);
    expect(verifyDraw({
      seed, seedHash: hashSeed("autre"), participants, winnersCount: 5, claimedWinners: r.winners,
    })).toBe(false);
    const tampered = [...r.winners.slice(0, -1), 999];
    expect(verifyDraw({
      seed, seedHash: hashSeed(seed), participants, winnersCount: 5, claimedWinners: tampered,
    })).toBe(false);
  });
});
