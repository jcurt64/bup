"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Row = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  ville: string | null;
  score: number;
  verification: string;
  founder: boolean;
  createdAt: string;
};

type Facets = { villes: string[]; verifications: string[] };

type SortKey = "date_desc" | "date_asc" | "score_desc" | "score_asc";

const PERIODS: { label: string; days: number }[] = [
  { label: "Tout", days: 0 },
  { label: "7 derniers jours", days: 7 },
  { label: "30 derniers jours", days: 30 },
  { label: "90 derniers jours", days: 90 },
];

const PAGE_SIZE = 50;

const SELECT_STYLE: React.CSSProperties = {
  background: "var(--paper)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
};

export default function ProspectsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [facets, setFacets] = useState<Facets>({ villes: [], verifications: [] });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [ville, setVille] = useState("");
  const [minScore, setMinScore] = useState("");
  const [days, setDays] = useState(0);
  const [verification, setVerification] = useState("");
  const [founder, setFounder] = useState("");
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [page, setPage] = useState(1);

  // Debounce du champ score (saisie libre) pour ne pas spammer l'API.
  const [minScoreDebounced, setMinScoreDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setMinScoreDebounced(minScore), 400);
    return () => clearTimeout(t);
  }, [minScore]);

  // Tout changement de filtre ramène en page 1.
  useEffect(() => {
    setPage(1);
  }, [ville, minScoreDebounced, days, verification, founder, sort]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("size", String(PAGE_SIZE));
    p.set("sort", sort);
    if (ville) p.set("ville", ville);
    if (minScoreDebounced) p.set("minScore", minScoreDebounced);
    if (days > 0) p.set("days", String(days));
    if (verification) p.set("verification", verification);
    if (founder) p.set("founder", founder);
    return p.toString();
  }, [page, sort, ville, minScoreDebounced, days, verification, founder]);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`/api/admin/stats/prospects/list?${queryString}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
        if (d.facets) setFacets(d.facets);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setRows([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [queryString]);

  const resetFilters = useCallback(() => {
    setVille("");
    setMinScore("");
    setDays(0);
    setVerification("");
    setFounder("");
    setSort("date_desc");
    setPage(1);
  }, []);

  const hasFilters =
    !!ville || !!minScore || days > 0 || !!verification || !!founder || sort !== "date_desc";

  const toggleSort = (base: "date" | "score") => {
    setSort((s) => {
      if (base === "date") return s === "date_desc" ? "date_asc" : "date_desc";
      return s === "score_desc" ? "score_asc" : "score_desc";
    });
  };
  const sortArrow = (base: "date" | "score") => {
    if (base === "date") return sort === "date_asc" ? "▲" : sort === "date_desc" ? "▼" : "";
    return sort === "score_asc" ? "▲" : sort === "score_desc" ? "▼" : "";
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      {/* Barre de filtres — responsive : 2 colonnes mobile → flex desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2">
        <label className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
            Ville
          </span>
          <select
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            className="text-sm rounded px-2 py-1.5"
            style={SELECT_STYLE}
          >
            <option value="">Toutes les villes</option>
            {facets.villes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
            Score min.
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="0"
            className="text-sm rounded px-2 py-1.5 w-full"
            style={SELECT_STYLE}
          />
        </label>

        <label className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
            Inscrit·e
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm rounded px-2 py-1.5"
            style={SELECT_STYLE}
          >
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
            Vérif
          </span>
          <select
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
            className="text-sm rounded px-2 py-1.5"
            style={SELECT_STYLE}
          >
            <option value="">Toutes</option>
            {facets.verifications.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
            Founder
          </span>
          <select
            value={founder}
            onChange={(e) => setFounder(e.target.value)}
            className="text-sm rounded px-2 py-1.5"
            style={SELECT_STYLE}
          >
            <option value="">Tous</option>
            <option value="true">Founders ★</option>
            <option value="false">Non founders</option>
          </select>
        </label>

        <label className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-bold uppercase" style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
            Tri
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-sm rounded px-2 py-1.5"
            style={SELECT_STYLE}
          >
            <option value="date_desc">Date ↓ (récents)</option>
            <option value="date_asc">Date ↑ (anciens)</option>
            <option value="score_desc">Score ↓</option>
            <option value="score_asc">Score ↑</option>
          </select>
        </label>

        {hasFilters && (
          <div className="flex items-end col-span-2 sm:col-span-1">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-bold uppercase rounded px-3 py-1.5 w-full lg:w-auto"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent-ink)",
                fontFamily: "var(--mono)",
                border: "1px solid var(--line)",
              }}
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* Compteur du résultat filtré (ex. nb d'inscrits à X sur 7 j) */}
      <div className="text-xs" style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
        {loading ? (
          "Chargement…"
        ) : (
          <>
            <strong style={{ color: "var(--ink)" }}>{total}</strong> prospect
            {total > 1 ? "s" : ""}
            {ville ? ` à « ${ville} »` : ""}
            {days > 0 ? ` · ${PERIODS.find((p) => p.days === days)?.label.toLowerCase()}` : ""}
            {minScoreDebounced ? ` · score ≥ ${minScoreDebounced}` : ""}
          </>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--ink-4)" }}>
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--ink-4)" }}>
          Aucun prospect ne correspond à ces filtres.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm border-collapse min-w-[680px]">
            <thead>
              <tr style={{ background: "var(--ivory-2)" }}>
                {(
                  [
                    { h: "Email", sortable: null, align: "left" },
                    { h: "Prénom", sortable: null, align: "left" },
                    { h: "Ville", sortable: null, align: "left" },
                    { h: "Score", sortable: "score", align: "right" },
                    { h: "Vérif", sortable: null, align: "left" },
                    { h: "Founder", sortable: null, align: "center" },
                    { h: "Créé le", sortable: "date", align: "left" },
                  ] as const
                ).map(({ h, sortable, align }) => (
                  <th
                    key={h}
                    onClick={sortable ? () => toggleSort(sortable) : undefined}
                    className={`text-[11px] font-bold uppercase px-3 py-2 select-none ${
                      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
                    } ${sortable ? "cursor-pointer" : ""}`}
                    style={{
                      color: "var(--accent-ink)",
                      fontFamily: "var(--mono)",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--line)",
                    }}
                    title={sortable ? "Cliquer pour trier" : undefined}
                  >
                    {h}
                    {sortable ? (
                      <span className="ml-1">{sortArrow(sortable)}</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  style={{
                    background: i % 2 === 1 ? "var(--ivory)" : "transparent",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/buupp-admin/prospects/${r.id}`}
                      className="underline"
                      style={{ color: "var(--accent-ink)" }}
                    >
                      {r.email ?? "(sans email)"}
                    </Link>
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--ink-2)" }}>
                    {r.prenom ?? "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--ink-2)" }}>
                    {r.ville ?? "—"}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {r.score}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="text-[11px] font-bold uppercase rounded px-2 py-0.5"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent-ink)",
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {r.verification}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.founder ? (
                      <span style={{ color: "var(--gold)", fontWeight: 700 }}>★</span>
                    ) : (
                      <span style={{ color: "var(--ink-5)" }}>—</span>
                    )}
                  </td>
                  <td
                    className="px-3 py-2 text-xs whitespace-nowrap"
                    style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}
                  >
                    {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination — apparaît dès que le résultat filtré dépasse une page */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="text-xs font-bold uppercase rounded px-3 py-1.5 disabled:opacity-40"
            style={{
              background: "var(--paper)",
              color: "var(--accent-ink)",
              border: "1px solid var(--line)",
              fontFamily: "var(--mono)",
            }}
          >
            ‹ Précédent
          </button>
          <span className="text-xs" style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="text-xs font-bold uppercase rounded px-3 py-1.5 disabled:opacity-40"
            style={{
              background: "var(--paper)",
              color: "var(--accent-ink)",
              border: "1px solid var(--line)",
              fontFamily: "var(--mono)",
            }}
          >
            Suivant ›
          </button>
        </div>
      )}
    </div>
  );
}
