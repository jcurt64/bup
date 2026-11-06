import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getPublicStudy } from "@/lib/studies/repo";
import StudyDetail from "../_components/StudyDetail";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ participer?: string }> };

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

export default async function StudyPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await getPublicStudy(createSupabaseAdminClient(), id);
  if (!s) notFound();
  return <StudyDetail initial={s} autoJoin={sp.participer === "1"} />;
}
