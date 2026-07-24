import { describe, expect, it } from "vitest";
import { renderWaitlistBroadcastHtml } from "@/lib/email/waitlist-broadcast";

const BASE = {
  title: "BUUPP ouvre officiellement",
  body: "Ligne 1\nLigne 2",
  prenom: "Marianne",
};

const V1 = {
  url: "https://www.buupp.com/tutoriels#video-1",
  thumbnailUrl: "https://www.buupp.com/videos/pre-inscription-1.jpg",
  label: "S'inscrire sur la liste d'attente",
};
const V2 = {
  url: "https://www.buupp.com/tutoriels#video-2",
  thumbnailUrl: "https://www.buupp.com/videos/pre-inscription-2.jpg",
  label: "Parrainer et suivre sa place",
};

describe("renderWaitlistBroadcastHtml", () => {
  it("rend les deux vignettes vidéo, numérotées et légendées", () => {
    const html = renderWaitlistBroadcastHtml({ ...BASE, videos: [V1, V2] });
    expect(html).toContain(V1.url);
    expect(html).toContain(V2.url);
    expect(html).toContain(V1.thumbnailUrl);
    expect(html).toContain(V2.thumbnailUrl);
    expect(html).toContain("1. S&#39;inscrire sur la liste d&#39;attente");
    expect(html).toContain("2. Parrainer et suivre sa place");
    expect(html).toContain("En vidéo");
  });

  it("ignore une vidéo sans miniature (aucun client mail ne lit la vidéo)", () => {
    const html = renderWaitlistBroadcastHtml({
      ...BASE,
      videos: [V1, { url: V2.url, thumbnailUrl: "", label: "Sans miniature" }],
    });
    expect(html).toContain(V1.url);
    expect(html).not.toContain(V2.url);
    // Une seule vidéo → pas de numérotation ni de pluriel.
    expect(html).toContain("La vidéo");
    expect(html).not.toContain("1. S&#39;inscrire");
  });

  it("n'affiche aucun bloc vidéo quand la liste est vide", () => {
    const html = renderWaitlistBroadcastHtml({ ...BASE, videos: [] });
    expect(html).not.toContain("En vidéo");
    expect(html).not.toContain("La vidéo");
  });

  it("plafonne à deux vignettes", () => {
    const V3 = { ...V1, url: "https://www.buupp.com/tutoriels#video-3", label: "Troisième" };
    const html = renderWaitlistBroadcastHtml({ ...BASE, videos: [V1, V2, V3] });
    expect(html).not.toContain("#video-3");
  });

  it("utilise le CTA personnalisé quand libellé + lien sont fournis", () => {
    const html = renderWaitlistBroadcastHtml({
      ...BASE,
      ctaLabel: "Retrouver ma place →",
      ctaUrl: "https://www.buupp.com/liste-attente",
    });
    expect(html).toContain("https://www.buupp.com/liste-attente");
    expect(html).toContain("Retrouver ma place");
    // Le bouton par défaut et son sous-titre disparaissent.
    expect(html).not.toContain("Créer mon compte");
    expect(html).not.toContain("Inscription en 2 minutes");
  });

  it("échappe le HTML du corps et du titre", () => {
    const html = renderWaitlistBroadcastHtml({
      ...BASE,
      title: "<script>alert(1)</script>",
      body: "a & b <b>gras</b>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b &lt;b&gt;gras&lt;/b&gt;");
  });
});
