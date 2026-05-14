/**
 * Petit badge "Version 1.0" inséré dans les pages des sections
 * Ressources et Légal du footer (bareme, aide, status, accessibilite,
 * minimisation, cgu, cgv, rgpd, cookies, contact-dpo).
 *
 * Discret (mono caps, fond paper, bordure line) — n'écrase pas le hero
 * mais reste lisible pour les utilisateurs qui veulent savoir à quelle
 * version d'un document légal/référence ils se réfèrent.
 */
export default function PageVersion({
  version = "1.0",
  updatedAt,
}: {
  version?: string;
  updatedAt?: string;
}) {
  return (
    <div
      className="mono caps"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        marginBottom: 18,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 999,
        color: "var(--ink-4)",
        fontSize: 11,
        letterSpacing: "0.12em",
      }}
    >
      <span>Version {version}</span>
      {updatedAt && (
        <>
          <span aria-hidden="true" style={{ opacity: 0.4 }}>·</span>
          <span>Mise à jour : {updatedAt}</span>
        </>
      )}
    </div>
  );
}
