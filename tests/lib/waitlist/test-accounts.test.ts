import { describe, expect, it } from "vitest";
import {
  classifyWaitlistRecipient,
  partitionWaitlistRecipients,
} from "@/lib/waitlist/test-accounts";

describe("classifyWaitlistRecipient", () => {
  it("garde les adresses réelles", () => {
    for (const email of [
      "marianne.foucat@gmail.com",
      "olkainry_64@hotmail.com",
      "i_sanogo@yahoo.fr",
      "christinefoucat@hotmail.fr",
      "delimaelsa@hotmail.com",
      "contact@mon-asso.bzh",
      // Sous-adressage légitime : « +buupp » n'est pas un tag de test.
      "prenom.nom+buupp@gmail.com",
    ]) {
      expect(classifyWaitlistRecipient({ email }), email).toBeNull();
    }
  });

  it("exclut les domaines de test et les TLD réservés", () => {
    expect(classifyWaitlistRecipient({ email: "filleul-or-3@buupp-test.local" })).toBe(
      "test_domain",
    );
    expect(classifyWaitlistRecipient({ email: "a@example.com" })).toBe("test_domain");
    expect(classifyWaitlistRecipient({ email: "a@quelquechose.test" })).toBe("test_domain");
  });

  it("exclut nos domaines internes (honeypot, diagnostics)", () => {
    expect(classifyWaitlistRecipient({ email: "honeypot-check-1778812013@buupp.fr" })).toBe(
      "internal_domain",
    );
    expect(classifyWaitlistRecipient({ email: "diag-1778843153@buupp.com" })).toBe(
      "internal_domain",
    );
  });

  it("exclut les sous-adresses de test et les préfixes de fixtures", () => {
    expect(classifyWaitlistRecipient({ email: "jjlex64+clerk_test1@gmail.com" })).toBe(
      "test_local_part",
    );
    expect(classifyWaitlistRecipient({ email: "quelquun+test@gmail.com" })).toBe(
      "test_local_part",
    );
    expect(classifyWaitlistRecipient({ email: "seed-42@gmail.com" })).toBe("test_local_part");
    expect(classifyWaitlistRecipient({ email: "test@gmail.com" })).toBe("test_local_part");
  });

  it("ne confond pas un vrai nom avec un préfixe de test", () => {
    // « testament », « diagne », « qadir » commencent par un mot de test mais
    // ne sont pas suivis d'un séparateur → conservés.
    expect(classifyWaitlistRecipient({ email: "testament.leclerc@gmail.com" })).toBeNull();
    expect(classifyWaitlistRecipient({ email: "celeste.diagne@yahoo.fr" })).toBeNull();
    expect(classifyWaitlistRecipient({ email: "qadir.benali@free.fr" })).toBeNull();
  });

  it("exclut les webmails mal orthographiés (rebond garanti)", () => {
    expect(classifyWaitlistRecipient({ email: "bkoss2@hotmail.comb" })).toBe("typo_domain");
    expect(classifyWaitlistRecipient({ email: "x@gmail.con" })).toBe("typo_domain");
    // Domaine perso avec une extension exotique : on n'y touche pas.
    expect(classifyWaitlistRecipient({ email: "x@boulangerie.paris" })).toBeNull();
  });

  it("exclut les adresses syntaxiquement invalides", () => {
    expect(classifyWaitlistRecipient({ email: "pas-un-email" })).toBe("invalid_email");
    expect(classifyWaitlistRecipient({ email: "" })).toBe("invalid_email");
    expect(classifyWaitlistRecipient({ email: "a@b" })).toBe("invalid_email");
  });

  it("exclut les villes de fixture", () => {
    expect(
      classifyWaitlistRecipient({ email: "quelquun@gmail.com", ville: "Testville" }),
    ).toBe("test_city");
    expect(classifyWaitlistRecipient({ email: "quelquun@gmail.com", ville: "Pau" })).toBeNull();
  });
});

describe("partitionWaitlistRecipients", () => {
  it("sépare réels / fictifs et déduplique sur l'email", () => {
    const rows = [
      { email: "marianne.foucat@gmail.com", prenom: "Marianne" },
      { email: "MARIANNE.FOUCAT@gmail.com", prenom: "Marianne (doublon)" },
      { email: "filleul-or-1@buupp-test.local", prenom: "Filleul" },
      { email: "jjlex64+clerk_test1@gmail.com", prenom: "Test" },
      { email: "i_sanogo@yahoo.fr", prenom: "Issa" },
    ];

    const { included, excluded } = partitionWaitlistRecipients(rows);

    expect(included.map((r) => r.email)).toEqual([
      "marianne.foucat@gmail.com",
      "i_sanogo@yahoo.fr",
    ]);
    expect(excluded.map((e) => e.reason).sort()).toEqual([
      "duplicate",
      "test_domain",
      "test_local_part",
    ]);
    expect(excluded.every((e) => e.label.length > 0)).toBe(true);
  });

  it("laisse passer une liste entièrement légitime", () => {
    const rows = [{ email: "a@gmail.com" }, { email: "b@yahoo.fr" }];
    const { included, excluded } = partitionWaitlistRecipients(rows);
    expect(included).toHaveLength(2);
    expect(excluded).toHaveLength(0);
  });
});
