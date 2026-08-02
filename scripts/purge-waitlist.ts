/**
 * Purge de la liste d'attente avant l'ouverture de la pré-inscription
 * officielle : la vague officielle repart d'une table VIDE, le mail de
 * lancement demandant explicitement de refaire la pré-inscription.
 *
 * Le script SAUVEGARDE AVANT DE SUPPRIMER, systématiquement : un dump JSON
 * de toutes les lignes plus un `.sql` de réimport idempotent, dans
 * ~/Desktop/buupp-sauvegarde-waitlist-<horodatage>/. C'est le seul filet —
 * la suppression n'est pas réversible autrement.
 *
 * Lancement :
 *   npx tsx scripts/purge-waitlist.ts --dry     # simulation, aucune écriture
 *   npx tsx scripts/purge-waitlist.ts --go      # sauvegarde puis purge
 *
 * Sans `--go`, le script se comporte comme `--dry` : la purge ne part jamais
 * par accident (un `npx tsx scripts/purge-waitlist.ts` seul ne supprime rien).
 *
 * NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont lues dans
 * .env.local (mini-parser ci-dessous, comme scripts/backfill-geocode.ts).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
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

const GO = process.argv.includes("--go");

/** Littéral SQL : quote simple doublée, ou `null`. */
function lit(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    // `interests` est un text[], pas du jsonb — piège rencontré au réimport
    // du 28/07 : un cast en jsonb fait échouer l'insert.
    if (v.length === 0) return "'{}'::text[]";
    return `array[${v.map((x) => lit(x)).join(",")}]::text[]`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main(): Promise<void> {
  const db = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });

  const { data, error } = await db.from("waitlist").select("*").order("created_at");
  if (error) {
    console.error("Lecture de la table waitlist impossible :", error.message);
    process.exit(1);
  }
  const rows = data ?? [];
  console.log(`waitlist : ${rows.length} ligne(s) en base.`);
  if (rows.length === 0) {
    console.log("Rien à purger — la table est déjà vide.");
    return;
  }

  // Horodatage local, pour retrouver la sauvegarde à l'œil.
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}h${p(now.getMinutes())}`;
  const dir = join(homedir(), "Desktop", `buupp-sauvegarde-waitlist-${stamp}`);

  if (!GO) {
    console.log("\n--- SIMULATION (aucune écriture) ---");
    console.log(`Sauvegarde qui serait écrite : ${dir}`);
    console.log(`Lignes qui seraient supprimées : ${rows.length}`);
    for (const r of rows) console.log(`  • ${r.email}`);
    console.log("\nRelancer avec --go pour sauvegarder puis purger.");
    return;
  }

  // 1) Sauvegarde AVANT toute suppression.
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "waitlist.json"), JSON.stringify(rows, null, 2), "utf8");

  const cols = Object.keys(rows[0]);
  const sql = [
    `-- Réimport de la liste d'attente sauvegardée le ${stamp.replace("-", "/")}.`,
    `-- ${rows.length} ligne(s). Idempotent : l'unicité passe par waitlist_email_lower_uidx.`,
    "",
    `insert into public.waitlist (${cols.join(", ")})`,
    "values",
    rows.map((r) => `  (${cols.map((c) => lit(r[c])).join(", ")})`).join(",\n"),
    "on conflict (lower(email)) do nothing;",
    "",
  ].join("\n");
  writeFileSync(join(dir, "waitlist-reimport.sql"), sql, "utf8");
  console.log(`Sauvegarde écrite : ${dir}`);

  // 2) Purge. `neq(id, …)` sur un UUID impossible sert de clause WHERE
  //    toujours vraie : PostgREST refuse un DELETE sans filtre.
  const { error: delError } = await db
    .from("waitlist")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delError) {
    console.error("Purge échouée :", delError.message);
    console.error("La sauvegarde est intacte, rien n'est perdu.");
    process.exit(1);
  }

  const { count } = await db.from("waitlist").select("id", { count: "exact", head: true });
  console.log(`Purge effectuée — waitlist : ${count ?? 0} ligne(s) restante(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
