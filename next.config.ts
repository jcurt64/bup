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
  async headers() {
    return [
      {
        source: "/prototype/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
