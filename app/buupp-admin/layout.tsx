/**
 * Layout du back-office BUUPP. Garde admin re-checkée côté RSC (le
 * middleware fait déjà la même chose — ceinture + bretelles, en cas de
 * config matcher cassée). Métadonnées `noindex, nofollow` pour éviter
 * toute indexation accidentelle.
 */
import type { Metadata } from "next";
import { requireAdminUserOrNotFound } from "@/lib/admin/access";
import AdminShell from "./_components/AdminShell";

export const metadata: Metadata = {
  title: "BUUPP Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default async function BuuppAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await requireAdminUserOrNotFound();
  return <AdminShell adminEmail={email}>{children}</AdminShell>;
}
