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

  if (loading) return <div className="text-sm text-neutral-500">Chargement…</div>;
  if (rows.length === 0) return <div className="text-sm text-neutral-500">Aucun prospect.</div>;

  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-neutral-500 uppercase">
        <tr>
          <th className="py-2">Email</th>
          <th>Prénom</th>
          <th>Ville</th>
          <th className="text-right">Score</th>
          <th>Vérif</th>
          <th>Founder</th>
          <th>Créé le</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-neutral-100">
            <td className="py-1">
              <Link className="underline" href={`/buupp-admin/prospects/${r.id}`}>
                {r.email ?? "(sans email)"}
              </Link>
            </td>
            <td>{r.prenom ?? "—"}</td>
            <td>{r.ville ?? "—"}</td>
            <td className="text-right tabular-nums">{r.score}</td>
            <td>{r.verification}</td>
            <td>{r.founder ? "✓" : ""}</td>
            <td className="text-xs text-neutral-500">{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
