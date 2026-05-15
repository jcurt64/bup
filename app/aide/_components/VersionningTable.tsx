import Link from "next/link";
import {
  PAGE_VERSIONS,
  type FooterSection,
  type PageMeta,
} from "../../_components/page-versions";

const SECTION_LABELS: Record<FooterSection, string> = {
  ressources: "Ressources",
  legal: "Légal",
};

function pagesBySection(section: FooterSection): PageMeta[] {
  return PAGE_VERSIONS.filter((p) => p.section === section);
}

function PageRow({ page }: { page: PageMeta }) {
  const current = page.history[page.history.length - 1];
  const previous = [...page.history].slice(0, -1).reverse();

  return (
    <tr style={{ borderTop: "1px solid var(--line)" }}>
      <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
        <Link
          href={page.href}
          style={{
            color: "var(--ink)",
            fontWeight: 500,
            textDecoration: "none",
            borderBottom: "1px dashed var(--line)",
          }}
        >
          {page.title}
        </Link>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-4)",
            marginTop: 4,
            letterSpacing: "0.04em",
          }}
        >
          {page.href}
        </div>
      </td>
      <td style={{ padding: "14px 16px", verticalAlign: "top", whiteSpace: "nowrap" }}>
        <span
          className="mono caps"
          style={{
            display: "inline-block",
            padding: "3px 10px",
            background: "var(--ivory-2)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            fontSize: 11,
            color: "var(--ink-3)",
            letterSpacing: "0.1em",
          }}
        >
          v{current.version}
        </span>
        <div
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}
        >
          {current.date}
        </div>
      </td>
      <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <li style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.5 }}>
            <span
              className="mono"
              style={{
                display: "inline-block",
                minWidth: 64,
                color: "var(--accent)",
                fontWeight: 600,
              }}
            >
              v{current.version}
            </span>
            {previous.length > 0 ? (
              <span style={{ color: "var(--ink-4)" }}>
                {" "}← v{previous[0].version}{" "}
              </span>
            ) : null}
            — {current.summary}
          </li>
          {previous.map((entry, idx) => {
            const olderIdx = page.history.length - 2 - (idx + 1);
            const older = olderIdx >= 0 ? page.history[olderIdx] : null;
            return (
              <li
                key={entry.version}
                style={{ fontSize: 13.5, color: "var(--ink-4)", lineHeight: 1.5 }}
              >
                <span
                  className="mono"
                  style={{ display: "inline-block", minWidth: 64, fontWeight: 500 }}
                >
                  v{entry.version}
                </span>
                {older ? <span> ← v{older.version} </span> : null}— {entry.summary}
                <span
                  className="mono"
                  style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}
                >
                  ({entry.date})
                </span>
              </li>
            );
          })}
        </ul>
      </td>
    </tr>
  );
}

function SectionTable({ section }: { section: FooterSection }) {
  const pages = pagesBySection(section);
  return (
    <div style={{ marginBottom: 28 }}>
      <h3
        className="serif"
        style={{
          fontSize: 20,
          marginBottom: 10,
          color: "var(--ink)",
        }}
      >
        {SECTION_LABELS[section]}
      </h3>
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "var(--sans)",
          }}
        >
          <thead>
            <tr
              className="mono caps"
              style={{
                background: "var(--ivory-2)",
                color: "var(--ink-4)",
                fontSize: 11,
                letterSpacing: "0.12em",
                textAlign: "left",
              }}
            >
              <th style={{ padding: "12px 16px", fontWeight: 500, width: "30%" }}>
                Page
              </th>
              <th style={{ padding: "12px 16px", fontWeight: 500, width: "15%" }}>
                Version actuelle
              </th>
              <th style={{ padding: "12px 16px", fontWeight: 500 }}>
                Historique des modifications
              </th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <PageRow key={p.slug} page={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VersionningTable() {
  return (
    <section id="versionning">
      <header style={{ marginBottom: 14 }}>
        <div
          className="row center"
          style={{ gap: 12, marginBottom: 4, alignItems: "center" }}
        >
          <span style={{ fontSize: 24 }} aria-hidden>
            🗂️
          </span>
          <h2
            className="serif"
            style={{ fontSize: "clamp(22px, 3vw, 28px)", lineHeight: 1.2 }}
          >
            Versionning des pages
          </h2>
        </div>
        <div style={{ fontSize: 14, color: "var(--ink-4)" }}>
          Suivi des versions des pages des sections{" "}
          <strong style={{ color: "var(--ink-3)" }}>Ressources</strong> et{" "}
          <strong style={{ color: "var(--ink-3)" }}>Légal</strong> du footer.
          Chaque mise à jour publiée est consignée ici avec un résumé des
          changements apportés.
        </div>
      </header>
      <SectionTable section="ressources" />
      <SectionTable section="legal" />
    </section>
  );
}
