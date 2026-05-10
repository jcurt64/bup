/**
 * GET /api/admin/events/stream — flux SSE des nouveaux admin_events.
 *
 * Ouvre un canal Supabase Realtime côté serveur (avec service_role) et
 * relaie chaque INSERT vers le navigateur via SSE. Garde la table
 * `admin_events` totalement fermée à toute policy : aucun client direct.
 *
 * Format SSE :
 *   data: {"type":"event","payload":{...}}\n\n
 *   : ping\n\n   (keepalive toutes les 25 s)
 *
 * Le client (cf. LiveFeed.tsx) ouvre une `EventSource` et concatène les
 * events à sa liste locale.
 */
import { requireAdminRequest } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(chunk)); } catch { /* socket closed */ }
      };

      // Greeting + initial backlog (10 derniers events) pour combler le SSR.
      send(": connected\n\n");

      admin.from("admin_events").select("*").order("created_at", { ascending: false }).limit(10).then((res) => {
        for (const ev of (res.data ?? []).reverse()) {
          send(`data: ${JSON.stringify({ type: "event", payload: ev })}\n\n`);
        }
      });

      // Souscription Realtime sur les INSERT.
      const channel = admin
        .channel("admin_events_stream")
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "admin_events" },
          (msg) => {
            send(`data: ${JSON.stringify({ type: "event", payload: msg.new })}\n\n`);
          })
        .subscribe();

      // Keepalive 25 s pour traverser les proxies.
      const pingId = setInterval(() => send(`: ping\n\n`), 25_000);

      // Fermeture propre quand le client coupe.
      const onAbort = () => {
        if (closed) return;
        closed = true;
        clearInterval(pingId);
        admin.removeChannel(channel).catch(() => {});
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
