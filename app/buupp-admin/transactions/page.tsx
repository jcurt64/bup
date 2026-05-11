import TransactionsTable from "../_components/TransactionsTable";

export const dynamic = "force-dynamic";

export default function TransactionsAdminPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--ink-3)" }}>
        Journal financier consolidé (prospects + pros). Filtres ci-dessous, 50 lignes max par page.
      </p>
      <TransactionsTable />
    </div>
  );
}
