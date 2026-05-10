"use client";
import { useEffect, useState } from "react";

type Tx = {
  id: string;
  account_kind: string;
  type: string;
  status: string;
  amount_cents: number;
  description: string;
  created_at: string;
  campaign_id: string | null;
};

export default function TransactionsTable() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [accountKind, setAccountKind] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ page: "1", size: "50" });
    if (accountKind) params.set("accountKind", accountKind);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    fetch(`/api/admin/stats/transactions?${params}`).then((r) => r.json()).then((d) => setRows(d.rows ?? []));
  }, [accountKind, type, status]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={accountKind} onChange={(e) => setAccountKind(e.target.value)} className="border px-2 py-1 text-sm rounded">
          <option value="">Tous comptes</option><option value="prospect">Prospect</option><option value="pro">Pro</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="border px-2 py-1 text-sm rounded">
          <option value="">Tous types</option>
          {["credit", "escrow", "withdrawal", "topup", "campaign_charge", "referral_bonus", "refund"].map((t) =>
            <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border px-2 py-1 text-sm rounded">
          <option value="">Tous statuts</option>
          {["pending", "completed", "failed", "canceled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-neutral-500 uppercase">
          <tr><th>Quand</th><th>Compte</th><th>Type</th><th>Statut</th><th className="text-right">Montant €</th><th>Description</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-neutral-100">
              <td className="py-1 text-xs text-neutral-500">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
              <td>{r.account_kind}</td>
              <td>{r.type}</td>
              <td>{r.status}</td>
              <td className="text-right tabular-nums">{(r.amount_cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="truncate max-w-md">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
