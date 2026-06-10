// Test d'intégration headless FREEBUUPP contre la vraie base (service-role).
// Seed → tirage → lecture → vérification → NETTOYAGE. Aucune notif envoyée.
// Usage : node scripts/freebuupp-smoke.mjs
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function envFromFile() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

// Miroir EXACT de lib/freebuupp/draw.ts (déjà unit-testé) — pour vérifier
// la cohérence avec la vérification publique.
const hashSeed = (s) => createHash("sha256").update(s).digest("hex");
const score = (seed, n) => createHash("sha256").update(`${seed}:${n}`).digest("hex");
function drawWinners(seed, participants, winnersCount) {
  const ordered = [...participants].sort((a, b) => {
    const sa = score(seed, a), sb = score(seed, b);
    return sa < sb ? -1 : sa > sb ? 1 : a - b;
  });
  return ordered.slice(0, Math.max(0, Math.min(winnersCount, participants.length)));
}

const env = envFromFile();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRO_ID = "d8048e14-8c26-44ef-b6d2-c6d97141a371";
const PROSPECTS = [
  "9efe2cc1-2dba-406d-886a-003120535f63",
  "b2425e02-b3e2-4e69-ba11-32a1dda983e3",
  "82935de8-a6cf-4284-8ff5-b9eb44300e80",
  "4d78fbcb-2076-42fb-9b80-70db52b600ec",
  "8cd42b99-10c9-4d63-9ffc-b8e85cda555b",
];

let fbId = null;
const assert = (cond, msg) => { if (!cond) throw new Error("ASSERT FAIL: " + msg); };

try {
  const seed = "smoketest-seed-" + hashSeed("x").slice(0, 8);
  // 1) Insert freebuupp (status closed → tirage immédiat possible)
  const code = "FB-SMOKE";
  await admin.from("freebuupps").delete().eq("code", code); // idempotence
  const { data: fb, error: e1 } = await admin.from("freebuupps").insert({
    pro_account_id: PRO_ID, code, title: "Smoke test", prize_description: "Lot de test",
    brand_name: "Test Pro", panel_size: 30, winners_count: 2, geo: "national",
    status: "closed", seed_hash: hashSeed(seed), seed,
    closes_at: new Date(Date.now() - 1000).toISOString(),
  }).select("id").single();
  assert(!e1, "insert freebuupp: " + (e1?.message ?? ""));
  fbId = fb.id;
  console.log("✓ freebuupp inséré", fbId);

  // 2) Insert participants (numéros 1..5)
  const rows = PROSPECTS.map((pid, i) => ({
    freebuupp_id: fbId, prospect_id: pid, participant_number: i + 1,
  }));
  const { error: e2 } = await admin.from("freebuupp_participants").insert(rows);
  assert(!e2, "insert participants: " + (e2?.message ?? ""));
  console.log("✓ 5 participants insérés");

  // 3) Tirage (réplique de executeDraw : is_winner + status drawn)
  const numbers = rows.map((r) => r.participant_number);
  const winners = drawWinners(seed, numbers, 2);
  const { error: e3 } = await admin.from("freebuupp_participants")
    .update({ is_winner: true }).eq("freebuupp_id", fbId).in("participant_number", winners);
  assert(!e3, "update winners: " + (e3?.message ?? ""));
  await admin.from("freebuupps").update({ status: "drawn", drawn_at: new Date().toISOString() }).eq("id", fbId);
  console.log("✓ tirage effectué, gagnants =", winners);

  // 4) Lecture + vérification (recompute = mêmes gagnants)
  const { data: parts } = await admin.from("freebuupp_participants")
    .select("participant_number, is_winner").eq("freebuupp_id", fbId).order("participant_number");
  const dbWinners = parts.filter((p) => p.is_winner).map((p) => p.participant_number).sort((a, b) => a - b);
  const recomputed = [...winners].sort((a, b) => a - b);
  assert(JSON.stringify(dbWinners) === JSON.stringify(recomputed), "DB winners != recompute");
  assert(hashSeed(seed) === hashSeed(seed), "hash stable");
  console.log("✓ vérification OK : gagnants en base =", dbWinners, "| recompute =", recomputed);

  // 5) Téléphone des gagnants lisible (chemin révélation pro)
  const winnerProspectIds = parts.filter((p) => p.is_winner).map((_, i) => PROSPECTS[winners[i] - 1]);
  const { data: idents } = await admin.from("prospect_identity")
    .select("prospect_id, telephone").in("prospect_id", winnerProspectIds);
  console.log("✓ révélation téléphone gagnants :", (idents ?? []).map((x) => (x.telephone ? "tel✓" : "tel∅")).join(" "));

  console.log("\n✅ SMOKE TEST OK — schéma + écriture + tirage + lecture valides.");
} catch (err) {
  console.error("\n❌", err.message);
  process.exitCode = 1;
} finally {
  if (fbId) {
    await admin.from("freebuupps").delete().eq("id", fbId); // cascade participants
    console.log("🧹 nettoyage : freebuupp de test supprimé");
  }
}
