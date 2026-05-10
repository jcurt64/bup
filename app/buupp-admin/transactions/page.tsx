import TransactionsTable from "../_components/TransactionsTable";

export const dynamic = "force-dynamic";

export default function TransactionsAdminPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Journal financier consolidé (prospects + pros). Filtres en haut, 50 lignes max par page.
      </p>
      <TransactionsTable />
    </div>
  );
}
