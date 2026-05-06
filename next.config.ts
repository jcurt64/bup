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
};

export default nextConfig;
