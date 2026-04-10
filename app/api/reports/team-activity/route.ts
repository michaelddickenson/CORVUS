import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Team, Role, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/reports/team-activity
// TEAM_LEAD + ADMIN: full per-team breakdown including entry-type counts.
// All others: aggregate totals only (no entry-type breakdown).
// Accepts optional ?from= and ?to= for date filtering.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPrivileged =
    session.user.role === Role.TEAM_LEAD || session.user.role === Role.ADMIN;

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const periodFilter: Prisma.CaseEntryWhereInput = (from || to)
    ? {
        createdAt: {
          ...(from ? { gte: new Date(from) }              : {}),
          ...(to   ? { lte: new Date(to) } : {}),
        },
      }
    : {};

  const entryWhere: Prisma.CaseEntryWhereInput = {
    ...periodFilter,
  };

  const [byTeamTotals, byTeamEntryType, distinctPairs] = await Promise.all([
    // Total entries + last activity per team
    prisma.caseEntry.groupBy({
      by: ["authorTeam"],
      _count: { _all: true },
      _max:   { createdAt: true },
      where:  entryWhere,
    }),

    // Entry-type breakdown per team — only fetched for privileged users
    isPrivileged
      ? prisma.caseEntry.groupBy({
          by:    ["authorTeam", "entryType"],
          _count: { _all: true },
          where:  entryWhere,
        })
      : Promise.resolve([] as { authorTeam: Team; entryType: string; _count: { _all: number } }[]),

    // One row per (team, case) pair for distinct case counts
    prisma.caseEntry.findMany({
      where:    entryWhere,
      select:   { authorTeam: true, caseId: true },
      distinct: ["authorTeam", "caseId"],
    }),
  ]);

  // Distinct case count per team
  const caseCountPerTeam: Record<string, number> = {};
  for (const row of distinctPairs) {
    caseCountPerTeam[row.authorTeam] = (caseCountPerTeam[row.authorTeam] ?? 0) + 1;
  }

  // Entry-type breakdown per team (privileged only)
  const breakdown: Record<string, Record<string, number>> = {};
  for (const row of byTeamEntryType) {
    if (!breakdown[row.authorTeam]) breakdown[row.authorTeam] = {};
    breakdown[row.authorTeam][row.entryType] = row._count._all;
  }

  const teams = byTeamTotals.map((r) => ({
    team:           r.authorTeam as string,
    totalEntries:   r._count._all,
    distinctCases:  caseCountPerTeam[r.authorTeam] ?? 0,
    lastActivityAt: r._max.createdAt?.toISOString() ?? null,
    ...(isPrivileged ? { entryTypeBreakdown: breakdown[r.authorTeam] ?? {} } : {}),
  }));

  return NextResponse.json({ teams, isPrivileged });
}
