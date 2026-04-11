import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getConfigOptions } from "@/lib/config";

// GET /api/config?category=CAT
// Returns active config options for one category (used by client components).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const category = req.nextUrl.searchParams.get("category");
  if (!category) {
    return NextResponse.json({ error: "category param required" }, { status: 400 });
  }

  const options = await getConfigOptions(category);
  return NextResponse.json(options);
}
