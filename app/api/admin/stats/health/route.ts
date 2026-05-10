import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin/access";
import { fetchHealthSnapshot } from "@/lib/admin/queries/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdminRequest(req);
  if (denied) return denied;
  const data = await fetchHealthSnapshot();
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
