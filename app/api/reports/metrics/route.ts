import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/** Monday of the week containing `date`, as "YYYY-MM-DD". */
function weekStartKey(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** "Mar 24" style label from an ISO date string (UTC). */
function weekLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Mar 24" style day label */
function dayLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Jan 2025" style month label */
function monthLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** YYYY-MM-DD key for a given date */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM key for a given date */
function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

// ---------------------------------------------------------------------------
// GET /api/reports/metrics
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from   = searchParams.get("from");
  const to     = searchParams.get("to");
  const period = searchParams.get("period") ?? "90d";

  const scopedWhere: Prisma.CaseWhereInput = (from || to)
    ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to) }   : {}),
        },
      }
    : {};

  // CAT, impact, status, category distributions
  const [byCat, byImpactLevel, byStatus, byCategory] = await Promise.all([
    prisma.case.groupBy({ by: ["cat"],         _count: { _all: true }, where: scopedWhere }),
    prisma.case.groupBy({ by: ["impactLevel"], _count: { _all: true }, where: scopedWhere }),
    prisma.case.groupBy({ by: ["status"],      _count: { _all: true }, where: scopedWhere }),
    prisma.case.groupBy({ by: ["category"],    _count: { _all: true }, where: scopedWhere }),
  ]);

  // Avg time-to-close (hours)
  const closedCases = await prisma.case.findMany({
    where: { ...scopedWhere, status: "CLOSED", closedAt: { not: null } },
    select: { createdAt: true, closedAt: true },
  });
  const avgCloseHours =
    closedCases.length > 0
      ? Math.round(
          (closedCases.reduce(
            (sum, c) => sum + (c.closedAt!.getTime() - c.createdAt.getTime()),
            0
          ) /
            closedCases.length /
            3_600_000) *
            10
        ) / 10
      : null;

  // ---------------------------------------------------------------------------
  // Bucket logic based on period
  // ---------------------------------------------------------------------------
  const now = new Date();
  let bucketType: "day" | "week" | "month" = "week";
  let chartTitle = "Cases Created — Last 12 Weeks";
  let perBucket: { label: string; count: number }[] = [];

  // Determine custom date range span in days (for custom period)
  let customSpanDays = 0;
  if (period === "custom" && from && to) {
    customSpanDays = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  }

  if (period === "today" || period === "7d") {
    // Daily buckets
    bucketType = "day";
    const numDays = period === "today" ? 1 : 7;
    chartTitle = period === "today" ? "Cases Created Today" : "Cases Created — Last 7 Days";

    const dayKeys: string[] = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      dayKeys.push(dayKey(d));
    }
    const cutoff = new Date(dayKeys[0] + "T00:00:00Z");

    const recentCases = await prisma.case.findMany({
      where: { ...scopedWhere, createdAt: { gte: cutoff } },
      select: { createdAt: true },
    });

    const dayCounts: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    for (const c of recentCases) {
      const k = dayKey(c.createdAt);
      if (dayCounts[k] !== undefined) dayCounts[k]++;
    }
    perBucket = dayKeys.map((k) => ({ label: dayLabel(k), count: dayCounts[k] }));

  } else if (period === "1y" || period === "all" || customSpanDays > 90) {
    // Monthly buckets — last 13 months
    bucketType = "month";
    chartTitle = "Cases Created — Last 13 Months";

    const monthKeys: string[] = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(monthKey(d));
    }
    const cutoff = new Date(monthKeys[0] + "-01T00:00:00Z");

    const recentCases = await prisma.case.findMany({
      where: { ...scopedWhere, createdAt: { gte: cutoff } },
      select: { createdAt: true },
    });

    const monthCounts: Record<string, number> = Object.fromEntries(monthKeys.map((k) => [k, 0]));
    for (const c of recentCases) {
      const k = monthKey(c.createdAt);
      if (monthCounts[k] !== undefined) monthCounts[k]++;
    }
    perBucket = monthKeys.map((k) => ({ label: monthLabel(k + "-01"), count: monthCounts[k] }));

  } else {
    // Weekly buckets — default (30d, 90d, custom ≤ 90 days)
    bucketType = "week";
    const numWeeks = period === "30d" ? 4 : 12;
    chartTitle = period === "30d" ? "Cases Created — Last 4 Weeks" : "Cases Created — Last 12 Weeks";

    const day = now.getUTCDay();
    const thisMonday = new Date(now);
    thisMonday.setUTCDate(thisMonday.getUTCDate() + (day === 0 ? -6 : 1 - day));
    thisMonday.setUTCHours(0, 0, 0, 0);

    const weekKeys: string[] = [];
    for (let i = numWeeks - 1; i >= 0; i--) {
      const d = new Date(thisMonday.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      weekKeys.push(d.toISOString().slice(0, 10));
    }
    const cutoff = new Date(weekKeys[0] + "T00:00:00Z");

    const recentCases = await prisma.case.findMany({
      where: { ...scopedWhere, createdAt: { gte: cutoff } },
      select: { createdAt: true },
    });

    const weekCounts: Record<string, number> = Object.fromEntries(weekKeys.map((k) => [k, 0]));
    for (const c of recentCases) {
      const k = weekStartKey(c.createdAt);
      if (weekCounts[k] !== undefined) weekCounts[k]++;
    }
    perBucket = weekKeys.map((k) => ({ label: weekLabel(k), count: weekCounts[k] }));
  }

  return NextResponse.json({
    byCat:         Object.fromEntries(byCat.map((r)         => [r.cat,         r._count._all])),
    byImpactLevel: Object.fromEntries(byImpactLevel.map((r) => [r.impactLevel, r._count._all])),
    byStatus:      Object.fromEntries(byStatus.map((r)      => [r.status,      r._count._all])),
    byCategory:    Object.fromEntries(byCategory.map((r)    => [r.category,    r._count._all])),
    avgCloseHours,
    perWeek:    perBucket, // backward compat
    perBucket,
    bucketType,
    chartTitle,
  });
}
