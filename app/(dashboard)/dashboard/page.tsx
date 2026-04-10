import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Team, Role, Status, IncidentCat, ImpactLevel, Prisma } from "@prisma/client";
import { CatBadge } from "@/components/ui/CatBadge";
import { ImpactBadge } from "@/components/ui/ImpactBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  CAT_WIDGET_STYLE,
  IMPACT_WIDGET_STYLE,
  ALL_CATS, ALL_IMPACTS,
} from "@/lib/catDisplay";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { RecentActivityPanel } from "@/components/dashboard/RecentActivityPanel";
import { WorkloadTable } from "@/components/dashboard/WorkloadTable";
import { formatHours } from "@/lib/formatDuration";

export const metadata = { title: "Dashboard — CORVUS" };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUSES: Status[] = ["NEW", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED"];

const STATUS_LABEL: Record<Status, string> = {
  NEW:            "New",
  IN_PROGRESS:    "In Progress",
  PENDING_REVIEW: "Pending Review",
  CLOSED:         "Closed",
};

const STATUS_STYLES: Record<Status, { border: string; bg: string; text: string }> = {
  NEW:            { border: "border-neutral-700",  bg: "bg-neutral-900",    text: "text-neutral-300"  },
  IN_PROGRESS:    { border: "border-amber-800",    bg: "bg-amber-950/50",   text: "text-amber-400"    },
  PENDING_REVIEW: { border: "border-orange-800",   bg: "bg-orange-950/50",  text: "text-orange-400"   },
  CLOSED:         { border: "border-green-800",    bg: "bg-green-950/50",   text: "text-green-400"    },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatUtc(date: Date) {
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}



function computePeriodDates(
  period: string,
  from?: string,
  to?: string
): { fromDate?: Date; toDate?: Date } {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { fromDate: start, toDate: now };
  }
  const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
  if (daysMap[period]) {
    return { fromDate: new Date(now.getTime() - daysMap[period] * 86400000), toDate: now };
  }
  if (period === "custom") {
    return {
      fromDate: from ? new Date(from) : undefined,
      toDate:   to   ? new Date(to + "T23:59:59Z") : undefined,
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) return notFound();

  const userId   = session.user.id;
  const userRole = session.user.role;
  const userTeam = (session.user.team ?? null) as Team | null;

  const period = searchParams.period ?? "90d";
  const { fromDate, toDate } = computePeriodDates(
    period,
    searchParams.from,
    searchParams.to
  );

  const periodFilter: Prisma.CaseWhereInput = (fromDate || toDate)
    ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
    : {};

  const scopedWhere:     Prisma.CaseWhereInput = { ...periodFilter };
  const openScopedWhere: Prisma.CaseWhereInput = { ...scopedWhere, status: { not: Status.CLOSED } };

  // Compute MTTC/MTTR/MTTE as a helper (runs inside Promise.all below)
  async function computeMetrics() {
    const closedCases = await prisma.case.findMany({
      where:  { ...scopedWhere, status: "CLOSED", closedAt: { not: null } },
      select: { id: true, createdAt: true, closedAt: true },
    });
    let mttc: number | null = null;
    if (closedCases.length > 0) {
      const total = closedCases.reduce((s, c) => s + c.closedAt!.getTime() - c.createdAt.getTime(), 0);
      mttc = Math.round((total / closedCases.length / 3_600_000) * 10) / 10;
    }
    const scopedIds = await prisma.case.findMany({ where: scopedWhere, select: { id: true, createdAt: true } });
    const createdMap = new Map(scopedIds.map((c) => [c.id, c.createdAt]));
    const allScopedIds = scopedIds.map((c) => c.id);

    const [nonSocEntries, escalationEntries] = await Promise.all([
      prisma.caseEntry.findMany({
        where:   { caseId: { in: allScopedIds }, authorTeam: { not: "SOC" } },
        select:  { caseId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.caseEntry.findMany({
        where:   { caseId: { in: allScopedIds }, entryType: "ESCALATION" },
        select:  { caseId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    function firstPerCase(entries: { caseId: string; createdAt: Date }[]): Map<string, Date> {
      const m = new Map<string, Date>();
      for (const e of entries) { if (!m.has(e.caseId)) m.set(e.caseId, e.createdAt); }
      return m;
    }
    function avgHours(entries: { caseId: string; createdAt: Date }[]): number | null {
      const first = firstPerCase(entries);
      const deltas: number[] = [];
      first.forEach((d, id) => {
        const created = createdMap.get(id);
        if (created) deltas.push(d.getTime() - created.getTime());
      });
      if (deltas.length === 0) return null;
      return Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length / 3_600_000) * 10) / 10;
    }

    return { mttc, mttr: avgHours(nonSocEntries), mtte: avgHours(escalationEntries) };
  }

  // Run all queries in parallel
  const [byCat, byImpactLevel, byStatus, myAssignedCases, teamWorkload, metrics, totalCases, openCases, closedCases] =
    await Promise.all([
      prisma.case.groupBy({
        by:    ["cat"],
        _count: { _all: true },
        where:  openScopedWhere,
      }),
      prisma.case.groupBy({
        by:    ["impactLevel"],
        _count: { _all: true },
        where:  openScopedWhere,
      }),
      prisma.case.groupBy({
        by:    ["status"],
        _count: { _all: true },
        where:  scopedWhere,
      }),
      prisma.case.findMany({
        where: {
          assignedToId: userId,
          status:       { not: Status.CLOSED },
        },
        orderBy: { updatedAt: "desc" },
        take:    10,
        select:  {
          id:          true,
          caseId:      true,
          title:       true,
          cat:         true,
          impactLevel: true,
          status:      true,
          updatedAt:   true,
        },
      }),
      // Team workload — TEAM_LEAD or ADMIN only
      (userRole === Role.TEAM_LEAD || userRole === Role.ADMIN)
        ? prisma.user.findMany({
            where: {
              isActive: true,
              ...(userRole === Role.TEAM_LEAD && userTeam ? { team: userTeam } : {}),
            },
            select: {
              id:   true,
              name: true,
              role: true,
              team: true,
              casesAssigned: {
                where:  { status: { not: Status.CLOSED } },
                select: { id: true },
              },
            },
            orderBy: { name: "asc" },
          })
        : Promise.resolve(null),
      computeMetrics(),
      prisma.case.count({ where: scopedWhere }),
      prisma.case.count({ where: openScopedWhere }),
      prisma.case.count({ where: { ...scopedWhere, status: "CLOSED" as const } }),
    ]);

  // Build count maps
  const catMap    = Object.fromEntries(byCat.map((r)         => [r.cat,         r._count._all])) as Record<IncidentCat, number>;
  const impactMap = Object.fromEntries(byImpactLevel.map((r) => [r.impactLevel, r._count._all])) as Record<ImpactLevel, number>;
  const statusMap = Object.fromEntries(byStatus.map((r)      => [r.status,      r._count._all])) as Record<Status, number>;

  const workloadRows = teamWorkload?.map((u) => ({
    id:           u.id,
    name:         u.name,
    role:         u.role,
    team:         u.team,
    openCaseCount: u.casesAssigned.length,
  })) ?? null;

  // Period query string — appended to case queue links so filters carry over.
  // createdTo uses YYYY-MM-DD because the API appends T23:59:59Z internally.
  const periodQs = (() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("createdFrom", fromDate.toISOString().slice(0, 10));
    if (toDate)   p.set("createdTo",   toDate.toISOString().slice(0, 10));
    const s = p.toString();
    return s ? `&${s}` : "";
  })();

  // Short label for CAT (e.g. "CAT 1")
  const CAT_SHORT_LABEL: Record<IncidentCat, string> = {
    CAT_1: "CAT 1", CAT_2: "CAT 2", CAT_3: "CAT 3",
    CAT_4: "CAT 4", CAT_5: "CAT 5", CAT_6: "CAT 6",
    CAT_7: "CAT 7", CAT_8: "CAT 8", CAT_9: "CAT 9",
  };

  return (
    <div className="space-y-6">
      {/* Page header + period filter */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white mb-0.5">Dashboard</h1>
          <p className="text-neutral-500 text-sm">Welcome back, {session.user.name}.</p>
        </div>
        <Suspense fallback={null}>
          <PeriodFilter />
        </Suspense>
      </div>

      {/* ── Total case counts ─────────────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded px-4 py-3">
            <p className="text-xs text-neutral-500 mb-1">Total Cases</p>
            <p className="font-mono text-2xl font-bold text-white">{totalCases}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded px-4 py-3">
            <p className="text-xs text-neutral-500 mb-1">Open Cases</p>
            <p className="font-mono text-2xl font-bold text-amber-400">{openCases}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded px-4 py-3">
            <p className="text-xs text-neutral-500 mb-1">Closed Cases</p>
            <p className="font-mono text-2xl font-bold text-green-400">{closedCases}</p>
          </div>
        </div>
      </section>

      {/* ── CAT distribution (open cases) ─────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
          Incident Category — Open Cases
        </h2>
        <div className="grid grid-cols-9 gap-1.5">
          {ALL_CATS.map((cat) => {
            const s     = CAT_WIDGET_STYLE[cat];
            const count = catMap[cat] ?? 0;
            return (
              <Link
                key={cat}
                href={`/cases?cat=${cat}${periodQs}`}
                className={`flex flex-col items-center py-3 px-1 rounded border ${s.border} ${s.bg} hover:opacity-80 transition-opacity`}
              >
                <span className={`text-xl font-bold font-mono ${s.text}`}>{count}</span>
                <span className={`text-[10px] font-mono font-medium mt-0.5 ${s.text}`}>
                  {CAT_SHORT_LABEL[cat]}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Impact + Status distributions ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        {/* Impact Level */}
        <section>
          <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            Impact Level — Open Cases
          </h2>
          <div className="flex gap-2">
            {ALL_IMPACTS.map((lvl) => {
              const s     = IMPACT_WIDGET_STYLE[lvl];
              const count = impactMap[lvl] ?? 0;
              return (
                <Link
                  key={lvl}
                  href={`/cases?impact=${lvl}${periodQs}`}
                  className={`flex-1 flex flex-col items-center py-3 px-2 rounded border ${s.border} ${s.bg} hover:opacity-80 transition-opacity`}
                >
                  <span className={`text-2xl font-bold font-mono ${s.text}`}>{count}</span>
                  <span className={`text-[10px] font-medium mt-0.5 ${s.text}`}>{lvl}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Status */}
        <section>
          <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            Status Distribution
          </h2>
          <div className="flex gap-2">
            {STATUSES.map((st) => {
              const s     = STATUS_STYLES[st];
              const count = statusMap[st] ?? 0;
              return (
                <Link
                  key={st}
                  href={`/cases?status=${st}${periodQs}`}
                  className={`flex-1 flex flex-col items-center py-3 px-2 rounded border ${s.border} ${s.bg} hover:opacity-80 transition-opacity`}
                >
                  <span className={`text-2xl font-bold font-mono ${s.text}`}>{count}</span>
                  <span className={`text-[10px] font-medium mt-0.5 ${s.text}`}>
                    {STATUS_LABEL[st]}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Time metrics ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
          Time Metrics
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["Mean Time to Close (MTTC)",           metrics.mttc,  "Avg time from case open to close"],
              ["Mean Time to First Response (MTTR)",  metrics.mttr,  "Avg time to first non-SOC entry"],
              ["Mean Time to First Escalation (MTTE)", metrics.mtte, "Avg time to first team loop-in"],
            ] as [string, number | null, string][]
          ).map(([label, value, desc]) => (
            <div key={label} className="bg-neutral-900 border border-neutral-800 rounded px-4 py-3">
              <p className="text-xs text-neutral-500 mb-1 truncate" title={label}>{label}</p>
              <p className="font-mono text-xl text-white font-semibold">{formatHours(value)}</p>
              <p className="text-xs text-neutral-600 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Main content: two columns ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left (2/3) — My assigned cases */}
        <div className="col-span-2 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                My Assigned Cases
              </h2>
              <Link
                href={`/cases?assignedTo=${userId}`}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                View all
              </Link>
            </div>

            <div className="border border-neutral-800 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 border-b border-neutral-800">
                  <tr>
                    <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs w-36">Case ID</th>
                    <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs">Title</th>
                    <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs w-20">CAT</th>
                    <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs w-20">Impact</th>
                    <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs w-28">Status</th>
                    <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs w-40">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {myAssignedCases.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-neutral-600 text-xs">
                        No open cases assigned to you.
                      </td>
                    </tr>
                  )}
                  {myAssignedCases.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-900/50 transition-colors" style={{ height: "40px" }}>
                      <td className="px-3 py-0">
                        <Link
                          href={`/cases/${c.id}`}
                          className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {c.caseId}
                        </Link>
                      </td>
                      <td className="px-3 py-0 text-neutral-200 text-xs truncate max-w-xs">{c.title}</td>
                      <td className="px-3 py-0">
                        <CatBadge cat={c.cat} />
                      </td>
                      <td className="px-3 py-0">
                        <ImpactBadge level={c.impactLevel} />
                      </td>
                      <td className="px-3 py-0">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-0 font-mono text-xs text-neutral-500 whitespace-nowrap">
                        {formatUtc(c.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Team workload (TEAM_LEAD / ADMIN) */}
          {workloadRows && (
            <section>
              <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                Team Workload
              </h2>
              <WorkloadTable rows={workloadRows} />
            </section>
          )}
        </div>

        {/* Right (1/3) — Recent activity */}
        <div className="col-span-1">
          <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            Recent Activity
          </h2>
          <RecentActivityPanel />
        </div>
      </div>
    </div>
  );
}
