"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ALL_CATS, ALL_IMPACTS, CAT_SHORT, CAT_STYLE } from "@/lib/catDisplay";
import { formatHours } from "@/lib/formatDuration";

// Charts are dynamically imported with ssr:false — recharts requires browser APIs
const WeeklyBarChart = dynamic(
  () => import("@/components/reports/Charts").then((m) => m.WeeklyBarChart),
  { ssr: false, loading: () => <div className="h-44 flex items-center justify-center text-xs text-neutral-600">Loading chart…</div> }
);
const CategoryBarChart = dynamic(
  () => import("@/components/reports/Charts").then((m) => m.CategoryBarChart),
  { ssr: false, loading: () => <div className="h-32 flex items-center justify-center text-xs text-neutral-600">Loading chart…</div> }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MetricsData {
  byCat:         Record<string, number>;
  byImpactLevel: Record<string, number>;
  byStatus:      Record<string, number>;
  byCategory:    Record<string, number>;
  avgCloseHours: number | null;
  perWeek:       { label: string; count: number }[];
  perBucket:     { label: string; count: number }[];
  bucketType:    "day" | "week" | "month";
  chartTitle:    string;
}

interface TtpRow {
  techniqueId:   string;
  techniqueName: string;
  tactic:        string;
  caseCount:     number;
  caseIds:       string[];
}

interface TeamRow {
  team:              string;
  totalEntries:      number;
  distinctCases:     number;
  lastActivityAt:    string | null;
  entryTypeBreakdown?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------
const STATUS_ORDER = ["NEW", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED"] as const;
const STATUS_COLOR: Record<string, string> = {
  NEW:            "text-neutral-400",
  IN_PROGRESS:    "text-amber-400",
  PENDING_REVIEW: "text-orange-400",
  CLOSED:         "text-green-400",
};
const STATUS_LABEL: Record<string, string> = {
  NEW:            "New",
  IN_PROGRESS:    "In Progress",
  PENDING_REVIEW: "Pending Review",
  CLOSED:         "Closed",
};

const CATEGORY_LABEL: Record<string, string> = {
  MALWARE:            "Malware",
  INTRUSION:          "Intrusion",
  PHISHING:           "Phishing",
  INSIDER_THREAT:     "Insider Threat",
  NONCOMPLIANCE:      "Non-Compliance",
  VULNERABILITY:      "Vulnerability",
  ANOMALOUS_ACTIVITY: "Anomalous Activity",
  OTHER:              "Other",
};

const IMPACT_COLOR: Record<string, string> = {
  HIGH:   "text-red-400",
  MEDIUM: "text-amber-400",
  LOW:    "text-blue-400",
};

// ---------------------------------------------------------------------------
// TTP heatmap cell color
// ---------------------------------------------------------------------------
function ttpCellBg(count: number): string {
  if (count === 1) return "bg-neutral-800 border-neutral-700";
  if (count === 2) return "bg-red-950 border-red-900";
  if (count === 3) return "bg-red-900 border-red-800";
  if (count === 4) return "bg-red-800 border-red-700";
  return "bg-red-700 border-red-600";
}
function ttpCellText(count: number): string {
  if (count === 1) return "text-neutral-400";
  return "text-red-200";
}

function formatTactic(t: string): string {
  return t
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatUtc(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16) + " UTC";
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
      {children}
    </h2>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab — Case Metrics
// ---------------------------------------------------------------------------
function MetricsTab({ data, periodQs }: { data: MetricsData; periodQs: string }) {
  const categoryData = Object.entries(data.byCategory)
    .map(([k, v]) => ({ label: CATEGORY_LABEL[k] ?? k, count: v }))
    .sort((a, b) => b.count - a.count);

  const openCount =
    (data.byStatus["NEW"]            ?? 0) +
    (data.byStatus["IN_PROGRESS"]    ?? 0) +
    (data.byStatus["PENDING_REVIEW"] ?? 0);

  return (
    <div className="space-y-8">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Avg Time-to-Close"
          value={formatHours(data.avgCloseHours)}
        />
        <StatCard
          label="Total Accessible Cases"
          value={String(Object.values(data.byStatus).reduce((a, b) => a + b, 0))}
        />
        <StatCard label="Open Cases"   value={String(openCount)} />
        <StatCard label="Closed Cases" value={String(data.byStatus["CLOSED"] ?? 0)} />
      </div>

      {/* CAT distribution */}
      <div>
        <SectionHeading>By Incident Category</SectionHeading>
        <div className="flex gap-2 flex-wrap">
          {ALL_CATS.map((cat) => {
            const count = data.byCat[cat] ?? 0;
            return (
              <Link
                key={cat}
                href={`/cases?cat=${cat}${periodQs}`}
                className={`border rounded-lg px-4 py-3 text-center min-w-[80px] transition-opacity hover:opacity-80 ${CAT_STYLE[cat]}`}
              >
                <p className="text-xl font-semibold tabular-nums font-mono">{count}</p>
                <p className="text-xs mt-0.5 font-mono">{CAT_SHORT[cat]}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Impact distribution */}
      <div>
        <SectionHeading>By Impact Level</SectionHeading>
        <div className="flex gap-3 flex-wrap">
          {ALL_IMPACTS.map((lvl) => {
            const count = data.byImpactLevel[lvl] ?? 0;
            return (
              <Link
                key={lvl}
                href={`/cases?impact=${lvl}${periodQs}`}
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-lg px-5 py-3 text-center min-w-[90px] transition-colors"
              >
                <p className={`text-xl font-semibold tabular-nums ${IMPACT_COLOR[lvl]}`}>
                  {count}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{lvl}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Status row */}
      <div>
        <SectionHeading>By Status</SectionHeading>
        <div className="flex gap-3 flex-wrap">
          {STATUS_ORDER.map((st) => {
            const count = data.byStatus[st] ?? 0;
            return (
              <Link
                key={st}
                href={`/cases?status=${st}${periodQs}`}
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-lg px-5 py-3 text-center min-w-[110px] transition-colors"
              >
                <p className={`text-xl font-semibold tabular-nums ${STATUS_COLOR[st]}`}>
                  {count}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {STATUS_LABEL[st]}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Cases created bar chart */}
      <div>
        <SectionHeading>{data.chartTitle ?? "Cases Created — Last 12 Weeks"}</SectionHeading>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <WeeklyBarChart data={data.perBucket ?? data.perWeek} />
        </div>
      </div>

      {/* Category bar chart */}
      <div>
        <SectionHeading>By Incident Type</SectionHeading>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <CategoryBarChart data={categoryData} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab — TTP Heatmap
// ---------------------------------------------------------------------------
function TtpHeatmapTab({ data }: { data: TtpRow[] }) {
  const tacticMap = new Map<string, TtpRow[]>();
  for (const row of data) {
    const t = row.tactic;
    if (!tacticMap.has(t)) tacticMap.set(t, []);
    tacticMap.get(t)!.push(row);
  }

  if (tacticMap.size === 0) {
    return (
      <p className="text-sm text-neutral-600 py-8 text-center">No TTPs logged yet.</p>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(tacticMap.entries()).map(([tactic, techniques]) => (
        <div key={tactic}>
          <SectionHeading>{formatTactic(tactic)}</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {techniques.map((t) => (
              <Link
                key={t.techniqueId}
                href={`/cases?ttpId=${encodeURIComponent(t.techniqueId)}`}
                className={`border rounded px-3 py-2 min-w-[160px] max-w-[220px] transition-opacity hover:opacity-80 ${ttpCellBg(t.caseCount)}`}
              >
                <p className={`font-mono text-xs font-medium ${ttpCellText(t.caseCount)}`}>
                  {t.techniqueId}
                </p>
                <p
                  className={`text-xs mt-0.5 leading-snug truncate ${ttpCellText(t.caseCount)}`}
                  title={t.techniqueName}
                >
                  {t.techniqueName}
                </p>
                <p className={`text-[10px] mt-1 tabular-nums ${ttpCellText(t.caseCount)} opacity-70`}>
                  {t.caseCount} {t.caseCount === 1 ? "case" : "cases"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab — Team Activity
// ---------------------------------------------------------------------------
function TeamActivityTab({ teams, isPrivileged }: { teams: TeamRow[]; isPrivileged: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (teams.length === 0) {
    return (
      <p className="text-sm text-neutral-600 py-8 text-center">No activity recorded yet.</p>
    );
  }

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-neutral-900 border-b border-neutral-800">
          <tr>
            {["Team", "Total Entries", "Cases Contributed", "Last Activity", ...(isPrivileged ? [""] : [])].map(
              (h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="bg-neutral-950 divide-y divide-neutral-900">
          {teams.map((row) => (
            <>
              <tr key={row.team} className="hover:bg-neutral-900/40">
                <td className="px-4 py-3 text-sm font-mono text-neutral-300">{row.team}</td>
                <td className="px-4 py-3 text-sm tabular-nums text-neutral-400">
                  {row.totalEntries.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm tabular-nums text-neutral-400">{row.distinctCases}</td>
                <td className="px-4 py-3 text-xs font-mono text-neutral-500">
                  {formatUtc(row.lastActivityAt)}
                </td>
                {isPrivileged && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpanded(expanded === row.team ? null : row.team)}
                      className="text-xs text-neutral-500 hover:text-neutral-300"
                    >
                      {expanded === row.team ? "Collapse" : "Expand"}
                    </button>
                  </td>
                )}
              </tr>
              {isPrivileged && expanded === row.team && row.entryTypeBreakdown && (
                <tr key={`${row.team}-breakdown`} className="bg-neutral-900/60">
                  <td colSpan={5} className="px-6 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2">
                      Entry Type Breakdown
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      {Object.entries(row.entryTypeBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => (
                          <div key={type} className="flex items-center gap-2">
                            <span className="text-xs font-mono text-neutral-500">{type}</span>
                            <span className="text-xs tabular-nums text-neutral-300">{count}</span>
                          </div>
                        ))}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build date range query string for case queue links (reports period → case queue)
// ---------------------------------------------------------------------------
function buildCasePeriodQs(period: string, customFrom: string, customTo: string): string {
  if (period === "all") return "";
  const now = new Date();
  const p = new URLSearchParams();
  if (period === "today") {
    const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
    p.set("createdFrom", start.toISOString().slice(0, 10));
    p.set("createdTo",   now.toISOString().slice(0, 10));
  } else if (period === "7d") {
    p.set("createdFrom", new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10));
  } else if (period === "30d") {
    p.set("createdFrom", new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10));
  } else if (period === "90d") {
    p.set("createdFrom", new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10));
  } else if (period === "1y") {
    p.set("createdFrom", new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10));
  } else if (period === "custom") {
    if (customFrom) p.set("createdFrom", customFrom);
    if (customTo)   p.set("createdTo",   customTo);
  }
  const s = p.toString();
  return s ? `&${s}` : "";
}

// ---------------------------------------------------------------------------
// Period filter bar (local state — client-only)
// ---------------------------------------------------------------------------
const PERIOD_OPTIONS = [
  { value: "all",    label: "All Time" },
  { value: "today",  label: "Today"    },
  { value: "7d",     label: "7 Days"   },
  { value: "30d",    label: "30 Days"  },
  { value: "90d",    label: "90 Days"  },
  { value: "1y",     label: "1 Year"   },
  { value: "custom", label: "Custom"   },
];

function buildApiParams(period: string, customFrom: string, customTo: string): string {
  const p = new URLSearchParams();
  p.set("period", period);

  if (period !== "all") {
    const now = new Date();
    if (period === "today") {
      const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
      p.set("from", start.toISOString());
      p.set("to",   now.toISOString());
    } else if (period === "7d") {
      p.set("from", new Date(now.getTime() - 7  * 86400000).toISOString());
    } else if (period === "30d") {
      p.set("from", new Date(now.getTime() - 30 * 86400000).toISOString());
    } else if (period === "90d") {
      p.set("from", new Date(now.getTime() - 90 * 86400000).toISOString());
    } else if (period === "1y") {
      p.set("from", new Date(now.getTime() - 365 * 86400000).toISOString());
    } else if (period === "custom") {
      if (customFrom) p.set("from", customFrom);
      if (customTo)   p.set("to", customTo + "T23:59:59Z");
    }
  }

  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
type Tab = "metrics" | "ttps" | "activity";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("metrics");

  // Period state
  const [period,     setPeriod]     = useState("90d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");

  // Data cache (keyed by periodKey so changes clear cache)
  const [metricsData,  setMetricsData]  = useState<MetricsData | null>(null);
  const [ttpsData,     setTtpsData]     = useState<TtpRow[] | null>(null);
  const [activityData, setActivityData] = useState<{ teams: TeamRow[]; isPrivileged: boolean } | null>(null);

  const [loading, setLoading] = useState<Record<Tab, boolean>>({ metrics: false, ttps: false, activity: false });
  const [error,   setError]   = useState<Record<Tab, string>>({ metrics: "", ttps: "", activity: "" });

  // When period changes, clear all cached data and bump reload counter
  const [reloadVersion, setReloadVersion] = useState(0);
  const prevPeriodKey = useRef("");

  const periodKey = `${period}-${customFrom}-${customTo}`;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function loadTab(t: Tab) {
    const qs     = buildApiParams(period, customFrom, customTo);
    const urlMap: Record<Tab, string> = {
      metrics:  `/api/reports/metrics${qs}`,
      ttps:     `/api/reports/ttps${qs}`,
      activity: `/api/reports/team-activity${qs}`,
    };

    setLoading((prev) => ({ ...prev, [t]: true }));
    setError((prev)   => ({ ...prev, [t]: "" }));

    try {
      const res  = await fetch(urlMap[t]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (t === "metrics")  setMetricsData(data);
      if (t === "ttps")     setTtpsData(data);
      if (t === "activity") setActivityData(data);
    } catch {
      setError((prev) => ({ ...prev, [t]: "Failed to load data. Try again." }));
    } finally {
      setLoading((prev) => ({ ...prev, [t]: false }));
    }
  }

  // On mount — load initial tab
  useEffect(() => {
    prevPeriodKey.current = periodKey;
    loadTab("metrics");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When reload version changes (period changed), reload current tab
  useEffect(() => {
    if (reloadVersion === 0) return;
    loadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadVersion]);

  function applyPeriod(newPeriod: string, newFrom?: string, newTo?: string) {
    if (newFrom !== undefined) setCustomFrom(newFrom);
    if (newTo   !== undefined) setCustomTo(newTo);
    setPeriod(newPeriod);
    // Clear all cached data so next load fetches fresh
    setMetricsData(null);
    setTtpsData(null);
    setActivityData(null);
    setReloadVersion((v) => v + 1);
  }

  function switchTab(t: Tab) {
    setTab(t);
    // Load if not cached
    const hasCached = (t === "metrics" && metricsData) ||
                      (t === "ttps"    && ttpsData)    ||
                      (t === "activity" && activityData);
    if (!hasCached) loadTab(t);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "metrics",  label: "Case Metrics"  },
    { key: "ttps",     label: "TTP Heatmap"   },
    { key: "activity", label: "Team Activity" },
  ];

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-lg font-semibold text-white">Reports</h1>

        {/* Period filter */}
        <div className="flex flex-wrap items-center gap-1">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => applyPeriod(p.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                period === p.value
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              {p.label}
            </button>
          ))}
          {period === "custom" && (
            <div className="flex items-center gap-1 ml-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => applyPeriod("custom", e.target.value, customTo)}
                className="bg-neutral-900 border border-neutral-700 text-neutral-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
              />
              <span className="text-neutral-600 text-xs">—</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => applyPeriod("custom", customFrom, e.target.value)}
                className="bg-neutral-900 border border-neutral-700 text-neutral-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
              />
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-neutral-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-blue-500 text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "metrics" && (
        <>
          {loading.metrics  && <p className="text-sm text-neutral-500">Loading…</p>}
          {error.metrics    && <p className="text-sm text-red-400">{error.metrics}</p>}
          {metricsData      && <MetricsTab data={metricsData} periodQs={buildCasePeriodQs(period, customFrom, customTo)} />}
        </>
      )}

      {tab === "ttps" && (
        <>
          {loading.ttps && <p className="text-sm text-neutral-500">Loading…</p>}
          {error.ttps   && <p className="text-sm text-red-400">{error.ttps}</p>}
          {ttpsData     && <TtpHeatmapTab data={ttpsData} />}
        </>
      )}

      {tab === "activity" && (
        <>
          {loading.activity && <p className="text-sm text-neutral-500">Loading…</p>}
          {error.activity   && <p className="text-sm text-red-400">{error.activity}</p>}
          {activityData     && (
            <TeamActivityTab
              teams={activityData.teams}
              isPrivileged={activityData.isPrivileged}
            />
          )}
        </>
      )}
    </div>
  );
}
