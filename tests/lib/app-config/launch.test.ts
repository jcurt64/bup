import { describe, it, expect } from "vitest";
import {
  launchReached,
  accessOpenFrom,
  waitlistOpenFrom,
  isWaitlistRoute,
} from "@/lib/app-config/launch";

// Lancement officiel : samedi 5 septembre 2026, 14 h 00 à Paris.
const LAUNCH = "2026-09-05T12:00:00+00:00";
const AVANT = Date.parse("2026-09-05T11:59:00+00:00");
const APRES = Date.parse("2026-09-05T12:00:01+00:00");

describe("launchReached", () => {
  it("est faux avant l'heure, vrai à partir de l'heure pile", () => {
    expect(launchReached(LAUNCH, AVANT)).toBe(false);
    expect(launchReached(LAUNCH, Date.parse(LAUNCH))).toBe(true);
    expect(launchReached(LAUNCH, APRES)).toBe(true);
  });

  it("ignore une date absente ou illisible plutôt que de basculer", () => {
    expect(launchReached(null, APRES)).toBe(false);
    expect(launchReached(undefined, APRES)).toBe(false);
    expect(launchReached("pas une date", APRES)).toBe(false);
  });
});

describe("accessOpenFrom — inscription / connexion", () => {
  it("reste fermé tant que le drapeau est false ET le lancement à venir", () => {
    expect(accessOpenFrom(false, LAUNCH, AVANT)).toBe(false);
  });

  it("s'ouvre tout seul dès l'heure du lancement, drapeau inchangé", () => {
    expect(accessOpenFrom(false, LAUNCH, APRES)).toBe(true);
  });

  it("respecte une ouverture manuelle en avance", () => {
    expect(accessOpenFrom(true, LAUNCH, AVANT)).toBe(true);
  });

  it("fail-open si la colonne manque", () => {
    expect(accessOpenFrom(null, LAUNCH, AVANT)).toBe(true);
    expect(accessOpenFrom(undefined, null, AVANT)).toBe(true);
  });
});

describe("waitlistOpenFrom — pré-inscription", () => {
  it("est ouverte avant le lancement", () => {
    expect(waitlistOpenFrom(true, LAUNCH, AVANT)).toBe(true);
  });

  it("expire d'elle-même à l'heure du lancement", () => {
    expect(waitlistOpenFrom(true, LAUNCH, APRES)).toBe(false);
  });

  it("reste fermée si le drapeau la ferme avant l'échéance", () => {
    expect(waitlistOpenFrom(false, LAUNCH, AVANT)).toBe(false);
  });

  it("est l'exact inverse de l'accès au moment du lancement", () => {
    expect(accessOpenFrom(false, LAUNCH, APRES)).toBe(true);
    expect(waitlistOpenFrom(true, LAUNCH, APRES)).toBe(false);
  });
});

describe("isWaitlistRoute — ce qui se ferme à l'échéance", () => {
  it("reconnaît la page de pré-inscription", () => {
    expect(isWaitlistRoute("/liste-attente")).toBe(true);
  });

  it("reconnaît le HTML statique encadré par l'iframe", () => {
    // Servi depuis /public : sans lui, l'URL directe resterait ouverte.
    expect(isWaitlistRoute("/prototype/waitlist.html")).toBe(true);
  });

  it("ne ferme pas le reste du site", () => {
    expect(isWaitlistRoute("/")).toBe(false);
    expect(isWaitlistRoute("/connexion")).toBe(false);
    expect(isWaitlistRoute("/prototype/index.html")).toBe(false);
  });

  it("ne se laisse pas contourner par un suffixe ou un sous-chemin", () => {
    expect(isWaitlistRoute("/liste-attente/")).toBe(false);
    expect(isWaitlistRoute("/liste-attente-bis")).toBe(false);
  });
});
