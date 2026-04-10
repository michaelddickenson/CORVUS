import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/reports/ttps
// Returns per-technique aggregates sorted by case count descending.
// Accepts optional ?from= and ?to= for date filtering.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  // Optionally scope to cases created in period
  const periodCaseWhere: Prisma.CaseWhereInput = (from || to)
    ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to) }   : {}),
        },
      }
    : {};

  // Fetch all TTP records in accessible cases
  const ttps = await prisma.ttp.findMany({
    where: { case: periodCaseWhere },
    select: { techniqueId: true, techniqueName: true, tactic: true, caseId: true },
  });

  // Aggregate by techniqueId — count distinct cases per technique
  type Entry = { techniqueId: string; techniqueName: string; tactic: string; caseIds: Set<string> };
  const map = new Map<string, Entry>();

  for (const t of ttps) {
    const existing = map.get(t.techniqueId);
    if (existing) {
      existing.caseIds.add(t.caseId);
    } else {
      map.set(t.techniqueId, {
        techniqueId:   t.techniqueId,
        techniqueName: t.techniqueName,
        tactic:        t.tactic,
        caseIds:       new Set([t.caseId]),
      });
    }
  }

  const result = Array.from(map.values())
    .map((v) => ({
      techniqueId:   v.techniqueId,
      techniqueName: v.techniqueName,
      tactic:        v.tactic,
      caseCount:     v.caseIds.size,
      caseIds:       Array.from(v.caseIds),
    }))
    .sort((a, b) => b.caseCount - a.caseCount);

  return NextResponse.json(result);
}
