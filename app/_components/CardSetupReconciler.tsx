"use client";

/**
 * Monté sur /pro. Au retour de Checkout `mode:'setup'`
 * (`?card_setup=success&session_id=cs_…`), POST le reconcile (cookie
 * Clerk présent côté parent), nettoie l'URL, puis notifie l'iframe
 * prototype (postMessage `wallet-refresh`) pour qu'elle re-fetch la
 * carte. `?card_setup=cancel` → on nettoie juste l'URL (no-op).
 * Idempotent : le reconcile no-op si déjà enregistré.
 */

import { useEffect, useRef } from "react";

export default function CardSetupReconciler() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const state = params.get("card_setup");
    if (state !== "success" && state !== "cancel") return;
    const sessionId = params.get("session_id");

    let cancelled = false;

    const cleanupUrl = () => {
      try {
        const next = new URL(window.location.href);
        next.searchParams.delete("card_setup");
        next.searchParams.delete("session_id");
        const search = next.searchParams.toString();
        const cleaned =
          next.pathname + (search ? "?" + search : "") + next.hash;
        window.history.replaceState({}, "", cleaned);
      } catch {
        /* no-op */
      }
    };

    const notifyIframe = () => {
      const iframes =
        document.querySelectorAll<HTMLIFrameElement>("iframe");
      iframes.forEach((f) => {
        try {
          f.contentWindow?.postMessage({ bupp: "wallet-refresh" }, "*");
        } catch {
          /* cross-origin : silencieux */
        }
      });
    };

    if (state === "cancel" || !sessionId) {
      cleanupUrl();
      return;
    }

    (async () => {
      try {
        const r = await fetch(
          "/api/pro/wallet/payment-method/reconcile",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId }),
          },
        );
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          console.warn("[card-setup-reconcile] échec", r.status, j);
        }
      } catch (e) {
        console.warn("[card-setup-reconcile] network error", e);
      }
      if (cancelled) return;

      // Cf. TopupReconciler : l'iframe prototype peut mettre 1–3 s à
      // mount son listener `message`. On envoie plusieurs pings espacés
      // pour couvrir la fenêtre de chargement (idempotent côté iframe).
      let pings = 0;
      const ping = () => {
        if (cancelled) return;
        notifyIframe();
        pings++;
        if (pings < 8) {
          setTimeout(ping, 600);
        } else {
          cleanupUrl();
        }
      };
      ping();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
