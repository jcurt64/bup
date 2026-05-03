/**
 * POST /api/waitlist — inscription à la liste d'attente.
 *
 * Endpoint public (pas d'auth Clerk). Insère une ligne dans `public.waitlist`
 * via le client `service_role` (bypass RLS, la table n'a aucune policy).
 * Retourne les compteurs agrégés à jour pour mise à jour live de l'UI.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendWaitlistConfirmation } from "@/lib/email/waitlist";
import crypto from "node:crypto";

export const runtime = "nodejs";

type WaitlistPayload = {
  prenom?: string;
  nom?: string;
  email?: string;
  ville?: string;
  interests?: string[];
  refCode?: string | null;
};

const TRIM_MAX = 80;

function clean(input: unknown, max = TRIM_MAX): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (!v || v.length > max) return null;
  return v;
}

function isValidEmail(v: string): boolean {
  // Validation pragmatique : 1 caractère + @ + 1 caractère + . + 2+ caractères.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export async function POST(req: Request) {
  let body: WaitlistPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const prenom = clean(body.prenom);
  const nom = clean(body.nom);
  const email = clean(body.email, 255);
  const ville = clean(body.ville);
  const refCode = clean(body.refCode ?? null, 32);

  if (!prenom || !nom || !email || !ville) {
    return NextResponse.json(
      { error: "Champs requis manquants : prenom, nom, email, ville" },
      { status: 400 },
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  const interests = Array.isArray(body.interests)
    ? body.interests.filter((i): i is string => typeof i === "string" && i.length <= 60).slice(0, 50)
    : [];

  // IP hash pour anti-spam léger sans stocker l'IP en clair (RGPD).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "";
  const ipHash = ip
    ? crypto.createHash("sha256").update(ip + (process.env.WAITLIST_IP_SALT ?? "buupp")).digest("hex").slice(0, 32)
    : null;

  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;

  const supabase = createSupabaseAdminClient();

  // Calcule le rang d'un email donné = position chronologique parmi les
  // inscrits (1 = premier inscrit). Utilise `created_at <=` pour rester
  // déterministe même si plusieurs lignes partagent la même horloge.
  async function rankFor(targetEmail: string): Promise<number> {
    const { data: row } = await supabase
      .from("waitlist")
      .select("created_at")
      .ilike("email", targetEmail)
      .single();
    if (!row?.created_at) return 0;
    const { count } = await supabase
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .lte("created_at", row.created_at);
    return count ?? 0;
  }

  const { error } = await supabase.from("waitlist").insert({
    email,
    prenom,
    nom,
    ville,
    interests,
    ref_code: refCode,
    ip_hash: ipHash,
    user_agent: userAgent,
  });

  if (error) {
    // Code Postgres 23505 = violation d'unicité (email déjà inscrit).
    if (error.code === "23505") {
      const [statsRes, rank] = await Promise.all([
        supabase.rpc("waitlist_stats").single(),
        rankFor(email),
      ]);
      return NextResponse.json(
        {
          ok: true,
          alreadyRegistered: true,
          rank,
          stats: statsRes.data ?? { total: 0, villes: 0 },
        },
        { status: 200 },
      );
    }
    console.error("[/api/waitlist] insert error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  const [statsRes, rank] = await Promise.all([
    supabase.rpc("waitlist_stats").single(),
    rankFor(email),
  ]);

  // Envoi du mail de confirmation en arrière-plan — on ne bloque pas la
  // réponse HTTP sur la latence SMTP. Les erreurs d'envoi sont loggées
  // par sendWaitlistConfirmation, jamais propagées au client.
  sendWaitlistConfirmation({ email, prenom, ville, rank }).catch((err) =>
    console.error("[/api/waitlist] confirmation mail failed:", err),
  );

  return NextResponse.json(
    {
      ok: true,
      alreadyRegistered: false,
      rank,
      stats: statsRes.data ?? { total: 0, villes: 0 },
    },
    { status: 201 },
  );
}
