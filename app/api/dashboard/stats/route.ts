import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/dashboard/stats — CAT + impact + status counts
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const periodFilter: Prisma.CaseWhereInput = (from || to)
    ? {
        createdAt: {
          ...(from ? { gte: new Date(from) }              : {}),
          ...(to   ? { lte: new Date(to + "T23:59:59Z") } : {}),
        },
      }
    : {};

  const scopedWhere:     Prisma.CaseWhereInput = { ...periodFilter };
  const openScopedWhere: Prisma.CaseWhereInput = { ...scopedWhere, status: { not: "CLOSED" as const } };

  const [byCat, byImpactLevel, byStatus, closedCases, entriesForMttr, entriesForMtte] = await Promise.all([
    prisma.case.groupBy({
      by: ["cat"],
      _count: { _all: true },
      where: openScopedWhere,
    }),
    prisma.case.groupBy({
      by: ["impactLevel"],
      _count: { _all: true },
      where: openScopedWhere,
    }),
    prisma.case.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: scopedWhere,
    }),
    // MTTC: closed cases with closedAt
    prisma.case.findMany({
      where:  { ...scopedWhere, status: "CLOSED", closedAt: { not: null } },
      select: { createdAt: true, closedAt: true },
    }),
    // MTTR: first non-SOC CaseEntry per case — we fetch entries for accessible cases in period
    prisma.caseEntry.findMany({
      where: {
        case: scopedWhere,
        authorTeam: { not: "SOC" },
      },
      select: { caseId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    // MTTE: first ESCALATION entry per case
    prisma.caseEntry.findMany({
      where: { case: scopedWhere, entryType: "ESCALATION" },
      select: { caseId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Compute MTTC (hours)
  let mttc: number | null = null;
  if (closedCases.length > 0) {
    const totalMs = closedCases.reduce((sum, c) => {
      const ms = c.closedAt!.getTime() - c.createdAt.getTime();
      return sum + ms;
    }, 0);
    mttc = Math.round((totalMs / closedCases.length / 3_600_000) * 10) / 10;
  }

  // Compute MTTR — first non-SOC entry per case, matched against case createdAt
  let mttr: number | null = null;
  {
    const caseIds = Array.from(new Set(entriesForMttr.map((e) => e.caseId)));
    if (caseIds.length > 0) {
      const casesForMttr = await prisma.case.findMany({
        where:  { ...scopedWhere, id: { in: caseIds } },
        select: { id: true, createdAt: true },
      });
      const caseCreated = new Map(casesForMttr.map((c) => [c.id, c.createdAt]));
      // earliest non-SOC entry per case
      const firstByCase = new Map<string, Date>();
      for (const e of entriesForMttr) {
        if (!firstByCase.has(e.caseId)) firstByCase.set(e.caseId, e.createdAt);
      }
      const deltas: number[] = [];
      firstByCase.forEach((entryDate, caseId) => {
        const created = caseCreated.get(caseId);
        if (created) deltas.push(entryDate.getTime() - created.getTime());
      });
      if (deltas.length > 0) {
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        mttr = Math.round((avg / 3_600_000) * 10) / 10;
      }
    }
  }

  // Compute MTTE — first ESCALATION entry per case
  let mtte: number | null = null;
  {
    const caseIds = Array.from(new Set(entriesForMtte.map((e) => e.caseId)));
    if (caseIds.length > 0) {
      const casesForMtte = await prisma.case.findMany({
        where:  { ...scopedWhere, id: { in: caseIds } },
        select: { id: true, createdAt: true },
      });
      const caseCreated = new Map(casesForMtte.map((c) => [c.id, c.createdAt]));
      const firstByCase = new Map<string, Date>();
      for (const e of entriesForMtte) {
        if (!firstByCase.has(e.caseId)) firstByCase.set(e.caseId, e.createdAt);
      }
      const deltas: number[] = [];
      firstByCase.forEach((entryDate, caseId) => {
        const created = caseCreated.get(caseId);
        if (created) deltas.push(entryDate.getTime() - created.getTime());
      });
      if (deltas.length > 0) {
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        mtte = Math.round((avg / 3_600_000) * 10) / 10;
      }
    }
  }

  return NextResponse.json({ byCat, byImpactLevel, byStatus, mttc, mttr, mtte });
}
