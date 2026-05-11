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

const TYPES = ["credit", "escrow", "withdrawal", "topup", "campaign_charge", "referral_bonus", "refund"];
const STATUSES = ["pending", "completed", "failed", "canceled"];

// Couleur des badges « type » — alignée sur la sémantique métier.
const TYPE_TONE: Record<string, { bg: string; fg: string }> = {
  credit: { bg: "rgba(21,128,61,0.10)", fg: "var(--good)" },
  escrow: { bg: "rgba(79,70,229,0.10)", fg: "var(--accent-ink)" },
  withdrawal: { bg: "rgba(180,83,9,0.10)", fg: "var(--warn)" },
  topup: { bg: "rgba(184,134,11,0.10)", fg: "var(--gold)" },
  campaign_charge: { bg: "rgba(15,23,42,0.06)", fg: "var(--ink-2)" },
  referral_bonus: { bg: "rgba(21,128,61,0.10)", fg: "var(--good)" },
  refund: { bg: "rgba(185,28,28,0.10)", fg: "var(--danger)" },
};
const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "rgba(180,83,9,0.10)", fg: "var(--warn)" },
  completed: { bg: "rgba(21,128,61,0.10)", fg: "var(--good)" },
  failed: { bg: "rgba(185,28,28,0.10)", fg: "var(--danger)" },
  canceled: { bg: "rgba(15,23,42,0.06)", fg: "var(--ink-4)" },
};
const KIND_TONE: Record<string, { bg: string; fg: string }> = {
  prospect: { bg: "rgba(79,70,229,0.10)", fg: "var(--accent-ink)" },
  pro: { bg: "rgba(184,134,11,0.10)", fg: "var(--gold)" },
};

const SELECT_STYLE = {
  background: "var(--paper)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  fontFamily: "var(--sans)",
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

export default function TransactionsTable() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountKind, setAccountKind] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", size: "50" });
    if (accountKind) params.set("accountKind", accountKind);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    fetch(`/api/admin/stats/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }, [accountKind, type, status]);

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <select
          value={accountKind}
          onChange={(e) => setAccountKind(e.target.value)}
          className="admin-select rounded-md text-sm h-10 px-3 cursor-pointer"
          style={SELECT_STYLE}
        >
          <option value="">Tous comptes</option>
          <option value="prospect">Prospect</option>
          <option value="pro">Pro</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="admin-select rounded-md text-sm h-10 px-3 cursor-pointer"
          style={SELECT_STYLE}
        >
          <option value="">Tous types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="admin-select rounded-md text-sm h-10 px-3 cursor-pointer"
          style={SELECT_STYLE}
        >
          <option value="">Tous statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div
          className="ml-auto text-xs self-center font-medium tabular-nums"
          style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}
        >
          {loading ? "…" : `${rows.length} ligne${rows.length > 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Card englobante */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderLeft: "3px solid var(--accent)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        {/* Wrapper scroll horizontal mobile */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[720px]">
            <thead>
              <tr style={{ background: "var(--ivory-2)" }}>
                {["Quand", "Compte", "Type", "Statut", "Montant €", "Description"].map((h, i) => (
                  <th
                    key={h}
                    className={`text-[11px] font-bold uppercase px-3 py-2 ${i === 4 ? "text-right" : "text-left"}`}
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
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm"
                    style={{ color: "var(--ink-4)" }}
                  >
                    Chargement…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm"
                    style={{ color: "var(--ink-4)" }}
                  >
                    Aucune transaction sur les filtres en cours.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r, i) => {
                  const amount = r.amount_cents / 100;
                  const amountColor =
                    amount > 0 ? "var(--good)" : amount < 0 ? "var(--danger)" : "var(--ink)";
                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: i % 2 === 1 ? "var(--ivory)" : "transparent",
                        borderBottom: "1px solid var(--line)",
                      }}
                    >
                      <td
                        className="px-3 py-2 text-xs whitespace-nowrap"
                        style={{ color: "var(--ink-4)", fontFamily: "var(--mono)" }}
                      >
                        {new Date(r.created_at).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={KIND_TONE[r.account_kind] ?? KIND_TONE.prospect}>
                          {r.account_kind}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={TYPE_TONE[r.type] ?? TYPE_TONE.escrow}>{r.type}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={STATUS_TONE[r.status] ?? STATUS_TONE.canceled}>
                          {r.status}
                        </Badge>
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap"
                        style={{ color: amountColor }}
                      >
                        {amount > 0 ? "+" : ""}
                        {amount.toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className="px-3 py-2 truncate max-w-md text-sm"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {r.description}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
