"use client";

/**
 * Composant client monté sur /pro qui s'exécute au retour de Stripe
 * Checkout (URL parente avec `?topup=success&session_id=cs_…`).
 *
 * Le wallet pro est affiché DANS le prototype iframe (Pro.jsx). Les
 * deux contextes (parent Next.js / iframe prototype) ont chacun leur
 * propre `window.location` — le code dans l'iframe ne voit pas les
 * query params de la page parente. Le reconcile doit donc être
 * orchestré côté parent : on lit ici `?topup=success&session_id=…`,
 * on POST à /api/pro/topup/reconcile (qui a le cookie Clerk côté
 * parent), puis on prévient l'iframe via postMessage pour qu'elle
 * recharge son wallet.
 *
 * Idempotent : la route reconcile détecte les transactions déjà
 * créditées et no-op proprement.
 */

import { useEffect, useRef } from "react";

export default function TopupReconciler() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") !== "success") return;
    const sessionId = params.get("session_id");
    if (!sessionId) return;

    let cancelled = false;

    const cleanupUrl = () => {
      try {
        const next = new URL(window.location.href);
        next.searchParams.delete("topup");
        next.searchParams.delete("session_id");
        const search = next.searchParams.toString();
        const cleaned =
          next.pathname + (search ? "?" + search : "") + next.hash;
        window.history.replaceState({}, "", cleaned);
      } catch {
        /* no-op : si l'API History plante, on laisse l'URL telle quelle */
      }
    };

    const notifyIframe = () => {
      // Le sélecteur cible toutes les iframes prototype. PostMessage
      // accepte un broadcast '*' — la cible filtre via `data.bupp`.
      const iframes =
        document.querySelectorAll<HTMLIFrameElement>("iframe");
      iframes.forEach((f) => {
        try {
          f.contentWindow?.postMessage({ bupp: "wallet-refresh" }, "*");
        } catch {
          /* iframes cross-origin : silencieux */
        }
      });
    };

    (async () => {
      try {
        const r = await fetch("/api/pro/topup/reconcile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          console.warn(
            "[topup-reconcile] échec",
            r.status,
            j,
          );
        }
      } catch (e) {
        console.warn("[topup-reconcile] network error", e);
      }
      if (cancelled) return;
      notifyIframe();
      cleanupUrl();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
