import { describe, expect, it } from "vitest";
import { channelsFromSubTypes } from "@/lib/campaigns/contact-channels";

describe("channelsFromSubTypes — le canal de l'étape 1 fait foi", () => {
  it("e-mail seul → e-mail", () => {
    expect(channelsFromSubTypes(["email"])).toEqual(["email"]);
  });
  it("SMS / appel / WhatsApp → téléphone", () => {
    expect(channelsFromSubTypes(["sms"])).toEqual(["phone"]);
    expect(channelsFromSubTypes(["phone", "wa"])).toEqual(["phone"]);
  });
  it("e-mail + SMS → les deux", () => {
    expect(channelsFromSubTypes(["sms", "email"])).toEqual(["phone", "email"]);
  });
  it("sous-type sans canal (webinar, Autres) → null (étape 3 demandée)", () => {
    expect(channelsFromSubTypes(["webinar"])).toBeNull();
    expect(channelsFromSubTypes(["autres"])).toBeNull();
    expect(channelsFromSubTypes([])).toBeNull();
  });
});
