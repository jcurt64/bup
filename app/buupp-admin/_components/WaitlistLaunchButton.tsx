"use client";
import { useState } from "react";

export default function WaitlistLaunchButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function go() {
    if (!confirm("Envoyer le mail de lancement à TOUS les inscrits non encore notifiés ?")) return;
    setBusy(true);
    setResult(null);
    try {
      // Note : la route nécessite x-admin-secret pour l'instant. Tant qu'elle
      // n'est pas migrée vers requireAdminRequest, on ne peut pas l'appeler
      // depuis le navigateur (le secret ne doit pas être exposé). On
      // affiche le curl à exécuter manuellement.
      const cmd =
        "curl -X POST https://VOTRE-DOMAINE/api/admin/waitlist/launch-email " +
        "-H 'x-admin-secret: $BUUPP_ADMIN_SECRET'";
      setResult("Exécuter en CLI :\n" + cmd);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={go} disabled={busy} className="px-3 py-2 rounded bg-neutral-900 text-white text-sm disabled:opacity-50">
        Envoyer le mail de lancement
      </button>
      {result && <pre className="text-xs bg-neutral-50 border rounded p-2 whitespace-pre-wrap">{result}</pre>}
    </div>
  );
}
