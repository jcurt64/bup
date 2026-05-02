/**
 * POST /api/clerk/webhook
 *
 * Endpoint signé par Clerk via Svix. Synchronise les utilisateurs vers
 * la table `prospects` de Supabase :
 *
 *   user.created → INSERT prospect (+ palier 1 si email/nom dispo)
 *   user.updated → UPDATE palier 1 (email)
 *   user.deleted → DELETE prospect (cascade sur les paliers)
 *
 * Setup côté Clerk :
 *   Dashboard → Webhooks → Add endpoint
 *     URL : <APP_URL>/api/clerk/webhook
 *     Events : user.created, user.updated, user.deleted
 *   Copier le "Signing Secret" → CLERK_WEBHOOK_SIGNING_SECRET
 */

import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteProspect, ensureProspect } from "@/lib/sync/prospects";

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses?: { email_address: string; id: string }[];
    primary_email_address_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
};

export async function POST(request: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CLERK_WEBHOOK_SIGNING_SECRET manquant" },
      { status: 500 },
    );
  }

  // Svix exige le body brut + 3 headers spécifiques pour vérifier la signature.
  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };

  let event: ClerkUserEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkUserEvent;
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "user.created": {
      const { id, email_addresses, primary_email_address_id, first_name, last_name } = event.data;
      const primary = email_addresses?.find(
        (e) => e.id === primary_email_address_id,
      ) ?? email_addresses?.[0];
      await ensureProspect({
        clerkUserId: id,
        email: primary?.email_address ?? null,
        prenom: first_name ?? null,
        nom: last_name ?? null,
      });
      break;
    }

    case "user.updated": {
      const { id, email_addresses, primary_email_address_id } = event.data;
      const primary = email_addresses?.find(
        (e) => e.id === primary_email_address_id,
      ) ?? email_addresses?.[0];
      if (!primary) break;

      const admin = createSupabaseAdminClient();
      // upsert ciblé sur le palier identification (email seulement, on ne
      // touche pas aux champs déclaratifs que l'utilisateur peut avoir édités).
      const { data: prospect } = await admin
        .from("prospects")
        .select("id")
        .eq("clerk_user_id", id)
        .maybeSingle();
      if (prospect) {
        await admin
          .from("prospect_identity")
          .upsert(
            { prospect_id: prospect.id, email: primary.email_address },
            { onConflict: "prospect_id" },
          );
      }
      break;
    }

    case "user.deleted":
      await deleteProspect(event.data.id);
      break;
  }

  return NextResponse.json({ received: true });
}
