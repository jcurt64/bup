import { describe, it, expect } from "vitest";
import {
  parseContactChannels,
  readContactChannels,
  nomInitial,
  identityCoversChannels,
} from "@/lib/campaigns/contact-channels";

describe("parseContactChannels", () => {
  it("valide, dédoublonne et ordonne", () => {
    expect(parseContactChannels(["email", "phone", "email"])).toEqual(["phone", "email"]);
    expect(parseContactChannels(["email"])).toEqual(["email"]);
  });
  it("rejette vide / inconnu / non-tableau", () => {
    expect(parseContactChannels([])).toBeNull();
    expect(parseContactChannels(["sms"])).toBeNull();
    expect(parseContactChannels("phone")).toBeNull();
    expect(parseContactChannels(undefined)).toBeNull();
  });
});

describe("readContactChannels", () => {
  it("retombe sur phone+email si absent/invalide", () => {
    expect(readContactChannels(null)).toEqual(["phone", "email"]);
    expect(readContactChannels(["fax"])).toEqual(["phone", "email"]);
    expect(readContactChannels(["email"])).toEqual(["email"]);
  });
});

describe("nomInitial", () => {
  it("première lettre en majuscule, accent conservé", () => {
    expect(nomInitial("dupont")).toBe("D");
    expect(nomInitial("  élodie")).toBe("É");
    expect(nomInitial("")).toBeNull();
    expect(nomInitial(null)).toBeNull();
  });
});

describe("identityCoversChannels", () => {
  const base = { prenom: "Léa", nom: "M", email: "a@b.fr", telephone: null };
  it("exige prénom + initiale + coordonnée(s) du canal", () => {
    expect(identityCoversChannels(base, ["email"])).toBe(true);
    expect(identityCoversChannels(base, ["phone"])).toBe(false);
    expect(identityCoversChannels({ ...base, nom: "" }, ["email"])).toBe(false);
    expect(identityCoversChannels(null, ["email"])).toBe(false);
  });
});
