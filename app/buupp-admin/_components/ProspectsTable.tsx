"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function ProspectsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/prospects/list?page=1&size=50")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-sm" style={{ color: "var(--ink-4)" }}>Chargement…</div>;
  if (rows.length === 0)
    return <div className="text-sm" style={{ color: "var(--ink-4)" }}>Aucun prospect.</div>;

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm border-collapse min-w-[680px]">
        <thead>
          <tr style={{ background: "var(--ivory-2)" }}>
            {["Email", "Prénom", "Ville", "Score", "Vérif", "Founder", "Créé le"].map((h, i) => (
              <th
                key={h}
                className={`text-[11px] font-bold uppercase px-3 py-2 ${i === 3 ? "text-right" : "text-left"}`}
                style={{
                  color: "var(--accent-ink)",
                  fontFamily: "var(--mono)",
                  letterSpacing: "0.06em",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                {h}
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
  );
}
