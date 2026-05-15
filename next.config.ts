import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // pdfkit charge ses polices Helvetica via require dynamique
  // (`/data/*.afm`). Si on le laisse être bundlé par Turbopack, les
  // chemins sont réécrits vers `/ROOT/node_modules/...` et la lecture
  // échoue à runtime → 500. On force pdfkit (et fontkit) à rester en
  // dépendance externe Node, pour que `require('pdfkit')` résolve
  // depuis le vrai `node_modules`.
  serverExternalPackages: ["pdfkit", "fontkit"],
  // Le prototype est rendu côté navigateur via Babel-standalone : les
  // fichiers `.jsx` de /public/prototype sont chargés à chaque ouverture
  // de l'iframe et compilés à la volée. Sans en-tête no-cache, le
  // navigateur sert une version périmée après une modification — d'où
  // des composants qui semblent ne pas se mettre à jour.
  //
  // À cela s'ajoutent les headers de SÉCURITÉ HTTP appliqués globalement
  // à toutes les routes (cf. audit sécurité 15/05/2026) :
  //
  // - HSTS : force HTTPS pendant 2 ans, includeSubDomains pour buupp.com.
  // - X-Frame-Options=DENY : interdit l'embed du site dans une iframe
  //   tierce (anti-clickjacking sur /buupp-admin et /pro).
  // - X-Content-Type-Options=nosniff : désactive le MIME-sniffing.
  // - Referrer-Policy : ne fuite pas l'URL exacte vers les domaines tiers
  //   (les liens cliqués depuis BUUPP n'envoient que l'origine).
  // - Permissions-Policy : verrouille les APIs sensibles non utilisées
  //   (caméra, micro, géoloc, paiement, USB, etc.).
  //
  // CSP volontairement OMISE pour l'instant : Next.js + Clerk + Stripe +
  // Cloudflare Insights ont besoin d'un grand nombre de domaines, et
  // une CSP cassée bloquerait le rendu en prod. À implémenter avec un
  // mode `report-only` d'abord (suivi sur 1-2 semaines via /api/csp-report)
  // avant passage en `enforce`.
  async headers() {
    const securityHeaders = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: [
          "camera=()",
          "microphone=()",
          "geolocation=()",
          "payment=(self \"https://js.stripe.com\")",
          "usb=()",
          "magnetometer=()",
          "accelerometer=()",
          "gyroscope=()",
          "interest-cohort=()",
        ].join(", "),
      },
    ];

    return [
      // En-tête no-cache spécifique au prototype (déjà en place).
      {
        source: "/prototype/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
      // Headers de sécurité globaux. On exclut /prototype/* (qui a déjà sa
      // propre règle ci-dessus) en utilisant la propriété `missing` sur
      // un header qu'on sait jamais présent — ici on duplique simplement,
      // Next.js applique les deux : pas de conflit, le Cache-Control
      // spécifique au prototype reste actif et les headers de sécurité
      // viennent s'ajouter.
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
