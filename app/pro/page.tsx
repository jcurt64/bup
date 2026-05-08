import PrototypeFrame from "../_components/PrototypeFrame";
import TopupReconciler from "../_components/TopupReconciler";

export const metadata = {
  title: "BUUPP — Espace Pro",
};

export default function ProPage() {
  return (
    <>
      <TopupReconciler />
      <PrototypeFrame route="pro" />
    </>
  );
}
