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
import { refCodeFromEmail } from "@/lib/waitlist/ref-code";
import crypto from "node:crypto";

export const runtime = "nodejs";

function villeHashFor(ville: string): string {
  // 8 hex chars : suffisant pour distinguer les villes dans les logs
  // sans permettre de retrouver le nom (collision-tolérant à l'échelle).
  return crypto.createHash("sha256").update(ville.toLowerCase()).digest("hex").slice(0, 8);
}

type WaitlistPayload = {
  prenom?: string;
  nom?: string;
  email?: string;
  ville?: string;
  interests?: string[];
  referrerRefCode?: string;
};

const TRIM_MAX = 80;
const REFERRER_CAP = 10;

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

/**
 * Normalise une saisie utilisateur en code de parrainage 7 caractères
 * base36 majuscule. Accepte aussi bien le code brut (`MD8X4K0`) que
 * l'URL complète (`https://buupp.fr/ref/MD8X4K0`, `buupp.fr/r/MD8X4K0`).
 * Retourne null si l'entrée ne contient pas un code valide.
 */
function parseReferrerCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  // Dernier segment après un éventuel "/" → permet d'accepter une URL.
  const tail = raw.split(/[\\/?#]/).filter(Boolean).pop() ?? raw;
  const code = tail.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{7}$/.test(code) ? code : null;
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

  // Calcule le rang + récupère le ref_code persisté pour un email donné.
  // Le ref_code en base est la source de vérité : si un jour l'algo de
  // génération évolue, les anciens codes restent stables.
  async function rowFor(targetEmail: string): Promise<{ rank: number; refCode: string | null }> {
    const { data: row } = await supabase
      .from("waitlist")
      .select("created_at, ref_code")
      .ilike("email", targetEmail)
      .single();
    if (!row?.created_at) return { rank: 0, refCode: null };
    const { count } = await supabase
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .lte("created_at", row.created_at);
    return { rank: count ?? 0, refCode: row.ref_code };
  }

  // Code de parrainage déterministe depuis l'email — même email = même code,
  // toujours. Persisté à l'insert pour servir de source de vérité ; relu
  // pour les réinscriptions.
  const generatedRefCode = refCodeFromEmail(email);

  // Code du parrain (optionnel) : nettoyé/normalisé côté serveur. On
  // valide ici la présence du code en base ET le plafond avant insert
  // pour pouvoir renvoyer une 4xx explicite à l'UI ; le trigger Postgres
  // sert de filet ultime contre les inscriptions concurrentes.
  const referrerRefCode = parseReferrerCode(body.referrerRefCode);
  if (body.referrerRefCode != null && referrerRefCode === null) {
    return NextResponse.json(
      { error: "invalid_referrer", message: "Lien de parrainage invalide." },
      { status: 400 },
    );
  }

  if (referrerRefCode) {
    if (referrerRefCode === generatedRefCode) {
      return NextResponse.json(
        {
          error: "self_referral",
          message: "Vous ne pouvez pas être votre propre parrain.",
        },
        { status: 400 },
      );
    }

    const { count: refExists } = await supabase
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .eq("ref_code", referrerRefCode);
    if (!refExists) {
      return NextResponse.json(
        {
          error: "referrer_not_found",
          message: "Ce lien de parrainage n'existe pas.",
        },
        { status: 404 },
      );
    }

    const { count: filleulCount } = await supabase
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .eq("referrer_ref_code", referrerRefCode);
    if ((filleulCount ?? 0) >= REFERRER_CAP) {
      return NextResponse.json(
        {
          error: "referrer_cap_reached",
          message: `Nombre maximal de filleul déjà atteint (${REFERRER_CAP}).`,
        },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase.from("waitlist").insert({
    email,
    prenom,
    nom,
    ville,
    interests,
    ref_code: generatedRefCode,
    referrer_ref_code: referrerRefCode,
    ip_hash: ipHash,
    user_agent: userAgent,
  });

  if (error) {
    // Plafond filleul atteint au moment de l'INSERT (race condition
    // résolue par le trigger BEFORE INSERT côté Postgres).
    if (error.code === "P0001" && /referrer_cap_reached/.test(error.message)) {
      return NextResponse.json(
        {
          error: "referrer_cap_reached",
          message: `Nombre maximal de filleul déjà atteint (${REFERRER_CAP}).`,
        },
        { status: 409 },
      );
    }
    if (error.code === "P0001" && /self_referral/.test(error.message)) {
      return NextResponse.json(
        {
          error: "self_referral",
          message: "Vous ne pouvez pas être votre propre parrain.",
        },
        { status: 400 },
      );
    }
    // Code Postgres 23505 = violation d'unicité (email déjà inscrit).
    if (error.code === "23505") {
      const [statsRes, info] = await Promise.all([
        supabase.rpc("waitlist_stats").single(),
        rowFor(email),
      ]);
      return NextResponse.json(
        {
          ok: true,
          alreadyRegistered: true,
          rank: info.rank,
          // Code persisté ; fallback sur recalcul si manquant (lignes
          // antérieures à cette feature).
          refCode: info.refCode ?? generatedRefCode,
          stats: statsRes.data ?? { total: 0, villes: 0 },
        },
        { status: 200 },
      );
    }
    console.error("[/api/waitlist] insert error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  const [statsRes, info] = await Promise.all([
    supabase.rpc("waitlist_stats").single(),
    rowFor(email),
  ]);

  void (async () => {
    const { recordEvent } = await import("@/lib/admin/events/record");
    await recordEvent({
      type: "waitlist.signup",
      payload: {
        emailDomain: email.split("@")[1] ?? null,
        villeHash: villeHashFor(ville),
      },
    });
  })();

  // Envoi du mail de confirmation : on AWAIT (avec timeout de sécurité)
  // pour garantir que SMTP termine avant que la fonction Next.js soit
  // suspendue (en serverless le runtime peut couper l'event loop dès
  // que la réponse est renvoyée). Échecs loggés, jamais propagés.
  try {
    await Promise.race([
      sendWaitlistConfirmation({ email, prenom, ville, rank: info.rank }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SMTP timeout (10s)")), 10_000),
      ),
    ]);
  } catch (err) {
    console.error("[/api/waitlist] confirmation mail failed:", err);
  }

  return NextResponse.json(
    {
      ok: true,
      alreadyRegistered: false,
      rank: info.rank,
      refCode: info.refCode ?? generatedRefCode,
      stats: statsRes.data ?? { total: 0, villes: 0 },
    },
    { status: 201 },
  );
}
