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

const PLAN_TONE: Record<string, { bg: string; fg: string }> = {
  starter: { bg: "rgba(15,23,42,0.06)", fg: "var(--ink-2)" },
  pro: { bg: "rgba(184,134,11,0.10)", fg: "var(--gold)" },
};
const BILLING_TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: "rgba(21,128,61,0.10)", fg: "var(--good)" },
  trialing: { bg: "rgba(79,70,229,0.10)", fg: "var(--accent-ink)" },
  past_due: { bg: "rgba(180,83,9,0.10)", fg: "var(--warn)" },
  canceled: { bg: "rgba(185,28,28,0.10)", fg: "var(--danger)" },
};

function Badge({ tone, children }: { tone: { bg: string; fg: string }; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center text-[11px] font-bold uppercase rounded px-2 py-0.5"
      style={{
        background: tone.bg,
        color: tone.fg,
        fontFamily: "var(--mono)",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}

export default function ProsTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/admin/stats/pros/list?page=1&size=50")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-sm" style={{ color: "var(--ink-4)" }}>Chargement…</div>;
  if (rows.length === 0)
    return <div className="text-sm" style={{ color: "var(--ink-4)" }}>Aucun pro.</div>;

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm border-collapse min-w-[720px]">
        <thead>
          <tr style={{ background: "var(--ivory-2)" }}>
            {["Raison sociale", "SIREN", "Secteur", "Ville", "Plan", "Billing", "Solde €"].map((h, i) => (
              <th
                key={h}
                className={`text-[11px] font-bold uppercase px-3 py-2 ${i === 6 ? "text-right" : "text-left"}`}
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
                  href={`/buupp-admin/pros/${r.id}`}
                  className="underline"
                  style={{ color: "var(--accent-ink)" }}
                >
                  {r.raison_sociale}
                </Link>
              </td>
              <td
                className="px-3 py-2 text-xs"
                style={{ color: "var(--ink-3)", fontFamily: "var(--mono)" }}
              >
                {r.siren ?? "—"}
              </td>
              <td className="px-3 py-2" style={{ color: "var(--ink-2)" }}>{r.secteur ?? "—"}</td>
              <td className="px-3 py-2" style={{ color: "var(--ink-2)" }}>{r.ville ?? "—"}</td>
              <td className="px-3 py-2">
                <Badge tone={PLAN_TONE[r.plan] ?? PLAN_TONE.starter}>{r.plan}</Badge>
              </td>
              <td className="px-3 py-2">
                <Badge tone={BILLING_TONE[r.billing_status] ?? BILLING_TONE.active}>
                  {r.billing_status}
                </Badge>
              </td>
              <td
                className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap"
                style={{ color: "var(--ink)" }}
              >
                {(r.wallet_balance_cents / 100).toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
