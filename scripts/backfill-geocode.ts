/**
 * Backfill du géocodage des adresses prospect déjà en base.
 *
 * Le géocodage automatique (cf. /api/prospect/donnees PATCH) ne se déclenche
 * qu'à l'enregistrement d'une adresse. Ce script rattrape les prospects
 * existants : il géocode leur adresse via l'API Adresse (BAN) et renseigne
 * latitude / longitude / center_distance_m, qui alimentent la
 * pseudonymisation « distance au centre » servie au pro.
 *
 * Pré-requis : la migration 20260717120000 doit être appliquée.
 *
 * Lancement :
 *   npx tsx scripts/backfill-geocode.ts            # applique les mises à jour
 *   npx tsx scripts/backfill-geocode.ts --dry      # simulation (aucune écriture)
 *
 * Les variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont
 * lues depuis .env.local (chargé par le mini-parser ci-dessous).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  geocodeAddress,
  geocodeCityCenter,
  haversineMeters,
} from "../lib/geo/geocode";

// --- Chargement minimal de .env.local (sans dépendance dotenv) ---------------
function loadEnvFile(file: string): void {
  let txt: string;
  try {
    txt = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnvFile(".env.local");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY (.env.local).",
  );
  process.exit(1);
}

const DRY = process.argv.includes("--dry");
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  // Adresses pas encore géocodées (latitude nulle) avec au moins adresse ou ville.
  const { data, error } = await admin
    .from("prospect_localisation")
    .select("prospect_id, adresse, ville, code_postal, latitude")
    .is("latitude", null);
  if (error) {
    console.error("Lecture échouée :", error.message);
    process.exit(1);
  }
  const rows = (data ?? []).filter(
    (r: { adresse: string | null; ville: string | null }) => r.adresse || r.ville,
  );
  console.log(
    `${rows.length} adresse(s) à géocoder${DRY ? " — DRY RUN (aucune écriture)" : ""}.`,
  );

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as {
      prospect_id: string;
      adresse: string | null;
      ville: string | null;
      code_postal: string | null;
    };
    const [point, center] = await Promise.all([
      geocodeAddress(r.adresse, r.code_postal, r.ville),
      geocodeCityCenter(r.code_postal, r.ville),
    ]);
    if (!point) {
      fail++;
      console.log(`  ✗ ${r.prospect_id} — géocodage impossible`);
      await sleep(220);
      continue;
    }
    const upd = {
      latitude: point.lat,
      longitude: point.lng,
      center_distance_m: center ? haversineMeters(point, center) : null,
    };
    if (DRY) {
      console.log(
        `  ~ ${r.prospect_id} → ${upd.center_distance_m ?? "?"} m du centre`,
      );
      ok++;
    } else {
      const { error: upErr } = await admin
        .from("prospect_localisation")
        .update(upd)
        .eq("prospect_id", r.prospect_id);
      if (upErr) {
        fail++;
        console.log(`  ✗ ${r.prospect_id} — update : ${upErr.message}`);
      } else {
        ok++;
        console.log(
          `  ✓ ${r.prospect_id} → ${upd.center_distance_m ?? "?"} m du centre`,
        );
      }
    }
    await sleep(220); // politesse envers l'API BAN
    if ((i + 1) % 50 === 0) console.log(`… ${i + 1}/${rows.length}`);
  }

  console.log(`Terminé : ${ok} traité(s), ${fail} échec(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
