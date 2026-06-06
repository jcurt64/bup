import { describe, expect, it } from "vitest";
import { renderFounderBonusEmail } from "@/lib/email/founder-bonus";

describe("renderFounderBonusEmail", () => {
  it("personnalise et mentionne le montant", () => {
    const { subject, text, html } = renderFounderBonusEmail({ prenom: "Léa" });
    expect(subject).toContain("bonus fondateur");
    expect(text).toContain("Léa");
    expect(text).toContain("5,00 €");
    expect(html).toContain("5,00 €");
  });

  it("gère un prénom absent", () => {
    const { text } = renderFounderBonusEmail({ prenom: null });
    expect(text).toContain("Bonjour");
    expect(text).not.toContain("null");
  });

  it("échappe le prénom dans le HTML (anti-XSS)", () => {
    const { html } = renderFounderBonusEmail({ prenom: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
