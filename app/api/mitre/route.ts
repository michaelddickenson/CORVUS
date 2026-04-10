import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchMitreTechniques } from "@/lib/mitre/attack";

// GET /api/mitre?q=xxx — typeahead search against bundled ATT&CK data
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = searchMitreTechniques(q, 10);
  return NextResponse.json(results);
}
