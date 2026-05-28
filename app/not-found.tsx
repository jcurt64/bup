import Link from "next/link";

// Page 404 (routes inconnues + notFound()). Rendu dans le root layout,
// donc polices/vars CSS globales disponibles. Image statique en <img>
// (le reste de l'app n'utilise pas next/image — on évite toute dépendance
// à l'optimiseur sur une page qui doit rester increvable).
export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
      style={{ background: "var(--ivory)", color: "var(--ink)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/empty-geo.png"
        alt=""
        width={180}
        height={180}
        style={{ width: "clamp(120px, 38vw, 180px)", height: "auto" }}
      />

      <div
        className="mt-6 font-bold"
        style={{
          fontFamily: "var(--mono)",
          letterSpacing: "0.22em",
          color: "var(--ink-4)",
          fontSize: 12.5,
        }}
      >
        ERREUR 404
      </div>

      <h1
        className="mt-2"
        style={{
          fontFamily: "var(--serif)",
          fontSize: "clamp(23px, 6vw, 34px)",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
          maxWidth: "18ch",
        }}
      >
        Oops, il semblerait que cette page soit introuvable…
      </h1>

      <p
        className="mt-3"
        style={{ color: "var(--ink-3)", fontSize: 15, lineHeight: 1.6, maxWidth: "44ch" }}
      >
        Elle a peut-être été déplacée, supprimée, ou n'a jamais existé. Pas de
        panique — on vous ramène en terrain connu.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-full font-medium"
        style={{
          background: "var(--accent)",
          color: "#FFFFFF",
          padding: "12px 26px",
          fontSize: 15,
          boxShadow: "0 8px 24px -10px var(--accent)",
        }}
      >
        ← Retour à l'accueil
      </Link>
    </main>
  );
}
