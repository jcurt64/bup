"use client";

import { useEffect, useState } from "react";
import PrivacyByDesignTable from "./PrivacyByDesignTable";

/**
 * Bouton « En savoir plus » + modale expliquant la pseudonymisation des données.
 *
 * Le contenu du tableau est désormais factorisé dans PrivacyByDesignTable (réutilisé
 * en ligne sur la page « À propos »). Cette modale n'est qu'un cadre scrollable
 * autour de ce tableau.
 */
export default function AnonymizationModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn-accent" onClick={() => setOpen(true)}>
        En savoir plus sur la pseudonymisation
      </button>

      {open && (
        <div
          className="anon-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="anon-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="anon-card">
            <div className="anon-hd">
              <div className="eb">CONFIDENTIALITÉ PAR CONCEPTION</div>
              <h3 id="anon-title">Comment vos données sont pseudonymisées</h3>
              <div className="sub">
                Palier par palier&nbsp;: ce que vous renseignez, la transformation
                appliquée par buupp, et ce qui parvient réellement au professionnel.
              </div>
              <button type="button" className="anon-close" aria-label="Fermer" onClick={() => setOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="anon-body">
              <PrivacyByDesignTable />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
