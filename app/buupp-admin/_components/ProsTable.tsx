// app/buupp-admin/_components/ProsTable.tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  raison_sociale: string;
  siren: string | null;
  secteur: string | null;
  ville: string | null;
  plan: string;
  billing_status: string;
  wallet_balance_cents: number;
  created_at: string;
};

export default function ProsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    fetch("/api/admin/stats/pros/list?page=1&size=50").then((r) => r.json()).then((d) => setRows(d.rows ?? []));
  }, []);
  if (rows.length === 0) return <div className="text-sm text-neutral-500">Aucun pro.</div>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-neutral-500 uppercase">
        <tr><th>Raison sociale</th><th>SIREN</th><th>Secteur</th><th>Ville</th><th>Plan</th><th>Billing</th><th className="text-right">Solde €</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-neutral-100">
            <td className="py-1"><Link className="underline" href={`/buupp-admin/pros/${r.id}`}>{r.raison_sociale}</Link></td>
            <td>{r.siren ?? "—"}</td>
            <td>{r.secteur ?? "—"}</td>
            <td>{r.ville ?? "—"}</td>
            <td>{r.plan}</td>
            <td>{r.billing_status}</td>
            <td className="text-right tabular-nums">{(r.wallet_balance_cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
