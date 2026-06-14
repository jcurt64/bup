"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Système d'apparition au défilement (scroll-reveal) global de l'application.
 *
 * Tout élément portant l'attribut `data-reveal` est masqué au départ (via le CSS
 * sous `html.reveal-ready`, cf. globals.css) puis révélé en fondu + léger
 * glissement quand il entre dans le viewport. Un parent `data-reveal-group`
 * fait apparaître ses enfants `data-reveal` les uns APRÈS les autres (stagger),
 * pour l'effet « cartes d'une même section qui se succèdent ».
 *
 * Détails pro :
 *  - SSR-safe + anti-flash : un script inline (layout) ajoute `reveal-ready`
 *    avant peinture ; sans JS, rien n'est masqué (contenu visible).
 *  - Respecte `prefers-reduced-motion` (révélation immédiate, sans transition).
 *  - Ré-observe les nouveaux éléments à chaque changement de route.
 *  - Révélation « one-shot » (pas de fade-out au scroll-up : élégant, non abusif).
 */
const STAGGER_MS = 70;
const STAGGER_MAX = 8;

export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Signale au garde-fou inline (layout) que le JS de reveal est actif :
    // il n'enlèvera donc PAS la classe `reveal-ready` au bout de 6 s.
    (window as unknown as { __revealActive?: boolean }).__revealActive = true;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Cibles = éléments [data-reveal] explicites + enfants directs d'un
    // [data-reveal-group] (animés automatiquement, sans marquer chaque carte).
    const collect = () => {
      const set = new Set<HTMLElement>();
      document
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((e) => set.add(e));
      document.querySelectorAll<HTMLElement>("[data-reveal-group]").forEach((g) => {
        Array.from(g.children).forEach((c) => set.add(c as HTMLElement));
      });
      return Array.from(set).filter((e) => !e.hasAttribute("data-reveal-seen"));
    };

    const reveal = (el: HTMLElement) => {
      // Stagger pour les enfants directs d'un groupe (cartes qui se succèdent).
      const group = el.parentElement?.closest<HTMLElement>("[data-reveal-group]");
      if (group && el.parentElement === group) {
        const i = Array.from(group.children).indexOf(el);
        if (i > 0) el.style.transitionDelay = `${Math.min(i, STAGGER_MAX) * STAGGER_MS}ms`;
      }
      el.classList.add("reveal-in");
    };

    const els = collect();
    els.forEach((el) => el.setAttribute("data-reveal-seen", ""));

    // Pas d'animation si reduced-motion OU si l'API n'est pas dispo : on
    // révèle tout de suite (le contenu ne doit JAMAIS rester masqué).
    if (reduce || typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("reveal-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            reveal(e.target as HTMLElement);
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    const vh = window.innerHeight;
    const pending = new Set<HTMLElement>();
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      // Déjà (presque) visible au chargement → révélation immédiate avec stagger
      // pour une intro fluide ; sinon, on observe le défilement.
      if (r.top < vh * 0.92 && r.bottom > 0) reveal(el);
      else {
        pending.add(el);
        io.observe(el);
      }
    });

    // Filet de sécurité (sans compromis UX) : un balayage au défilement révèle
    // tout élément en attente RÉELLEMENT entré dans le viewport, même si
    // l'IntersectionObserver ne s'est pas déclenché. On ne pré-révèle jamais le
    // contenu hors écran → l'animation au scroll reste intacte pour tous.
    const sweep = () => {
      const h = window.innerHeight;
      pending.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < h * 0.95 && r.bottom > 0) {
          reveal(el);
          pending.delete(el);
        }
      });
      if (pending.size === 0) window.removeEventListener("scroll", sweep);
    };
    window.addEventListener("scroll", sweep, { passive: true });
    // Capte les éléments déjà visibles après stabilisation du layout (polices, etc.).
    const t1 = window.setTimeout(sweep, 1500);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", sweep);
      window.clearTimeout(t1);
    };
  }, [pathname]);

  return null;
}
