import { NextResponse, after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { err, rpcErrorCode } from "./http";
import { notifyPublished } from "./notify";

/** Publie une campagne brouillon ; en cas d'échec, elle reste en brouillon. */
export async function publishOrDraft(
  admin: SupabaseClient<Database>,
  row: { id: string; scope: string; department: string | null },
) {
  const { data: budget, error } = await admin.rpc("publish_study_tx", { p_id: row.id });
  if (error) {
    const code = rpcErrorCode(error);
    if (code === "insufficient_funds") {
      const missing = Number((error.message ?? "").split(":")[1] ?? 0);
      return err("insufficient_funds", 402, { id: row.id, missingCents: missing });
    }
    return err(code, 409, { id: row.id });
  }
  after(() => notifyPublished(admin, row).then(() => undefined));
  return NextResponse.json({ id: row.id, status: "published", budgetReservedCents: Number(budget) });
}

