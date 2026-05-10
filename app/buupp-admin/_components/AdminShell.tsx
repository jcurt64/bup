"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PeriodPicker from "./PeriodPicker";
import NotificationBell from "./NotificationBell";

const NAV = [
  { href: "/buupp-admin", label: "Vue d'ensemble" },
  { href: "/buupp-admin/prospects", label: "Prospects" },
  { href: "/buupp-admin/pros", label: "Professionnels" },
  { href: "/buupp-admin/campagnes", label: "Campagnes" },
  { href: "/buupp-admin/transactions", label: "Transactions" },
  { href: "/buupp-admin/waitlist", label: "Waitlist" },
  { href: "/buupp-admin/sante", label: "Santé" },
];

export default function AdminShell({
  adminEmail,
  adminUserId,
  children,
}: {
  adminEmail: string;
  adminUserId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 grid grid-cols-[240px_1fr]">
      <aside className="border-r border-neutral-200 bg-white p-4 flex flex-col gap-2">
        <div className="font-semibold mb-4">BUUPP Admin</div>
        {NAV.map((item) => {
          const active =
            item.href === "/buupp-admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-2 text-sm ${active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="mt-auto text-xs text-neutral-500 pt-4">{adminEmail}</div>
      </aside>
      <main className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">{NAV.find((n) => n.href === pathname)?.label ?? "Admin"}</h1>
          <div className="flex items-center gap-2">
            <NotificationBell adminUserId={adminUserId} />
            <PeriodPicker />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
