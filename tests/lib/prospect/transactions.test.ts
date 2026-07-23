import { describe, expect, it } from "vitest";
import {
  GAIN_TRANSACTION_TYPES,
  SIGNUP_BONUS_ORIGIN,
  statusLabel,
  statusChip,
} from "@/lib/prospect/transactions";

describe("transactions display contract", () => {
  it("inclut signup_bonus dans les types de gain", () => {
    expect(GAIN_TRANSACTION_TYPES).toContain("credit");
    expect(GAIN_TRANSACTION_TYPES).toContain("referral_bonus");
    expect(GAIN_TRANSACTION_TYPES).toContain("signup_bonus");
  });

  it("statusLabel : signup_bonus completed → Crédité", () => {
    expect(statusLabel("signup_bonus", "completed")).toBe("Crédité");
    expect(statusLabel("credit", "completed")).toBe("Crédité");
    expect(statusLabel("escrow", "pending")).toBe("En séquestre");
    expect(statusLabel("withdrawal", "completed")).toBe("Exécuté");
  });

  it("statusChip : signup_bonus completed → good", () => {
    expect(statusChip("signup_bonus", "completed")).toBe("good");
    expect(statusChip("escrow", "pending")).toBe("warn");
    expect(statusChip("refund", "completed")).toBe("");
  });

  it("expose le libellé canonique du bonus", () => {
    expect(SIGNUP_BONUS_ORIGIN).toBe("Bonus fondateur 🎁");
  });
});

describe("bonus fondateur verrouillé", () => {
  it("libelle un signup_bonus pending comme en attente de déblocage", () => {
    expect(statusLabel("signup_bonus", "pending")).toBe("En attente de déblocage");
  });

  it("garde le libellé « Crédité » une fois débloqué", () => {
    expect(statusLabel("signup_bonus", "completed")).toBe("Crédité");
  });

  it("affiche un chip orange tant que le bonus est verrouillé", () => {
    expect(statusChip("signup_bonus", "pending")).toBe("warn");
  });

  it("affiche un chip vert une fois le bonus débloqué", () => {
    expect(statusChip("signup_bonus", "completed")).toBe("good");
  });
});
