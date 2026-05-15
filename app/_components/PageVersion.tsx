import {
  getCurrentVersion,
  type PageSlug,
} from "./page-versions";

/**
 * Petit badge "Version 1.0" inséré dans les pages des sections
 * Ressources et Légal du footer (bareme, aide, status, accessibilite,
 * minimisation, cgu, cgv, rgpd, cookies, contact-dpo).
 *
 * Préférer l'API `<PageVersion page="rgpd" />` : la version et la date
 * sont alors lues depuis le registre central `page-versions.ts`, ce qui
 * garantit que le badge et le tableau "Versionning" du Centre d'aide
 * restent synchronisés.
 *
 * L'API legacy `<PageVersion version="1.0" updatedAt="…" />` reste
 * supportée pour les cas hors registre.
 */
type Props =
  | { page: PageSlug; version?: never; updatedAt?: never }
  | { page?: never; version?: string; updatedAt?: string };

export default function PageVersion(props: Props) {
  let version: string;
  let updatedAt: string | undefined;

  if (props.page) {
    const current = getCurrentVersion(props.page);
    version = current.version;
    updatedAt = current.date;
  } else {
    version = props.version ?? "1.0";
    updatedAt = props.updatedAt;
  }

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
