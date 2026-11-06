import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getPublicStudy } from "@/lib/studies/repo";
import StudyDetail from "../_components/StudyDetail";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getPublicStudy(createSupabaseAdminClient(), id);
  if (!s) return { title: "Campagne introuvable" };
  return {
    title: `${s.title} — Tests & Études`,
    description: `${s.typeLabel} proposé par ${s.proName} · ${s.zone}. Participation rémunérée via BUUPP.`,
    alternates: { canonical: `/tests-etudes/${s.id}` },
  };
}

export default async function StudyPage({ params }: Props) {
  const { id } = await params;
  const s = await getPublicStudy(createSupabaseAdminClient(), id);
  if (!s) notFound();
  return (
    <>
      <Link href="/tests-etudes" style={{ fontSize: 14, color: "var(--ink-4)", textDecoration: "none" }}>
        ← Toutes les campagnes
      </Link>
      <StudyDetail initial={s} />
    </>
  );
}
