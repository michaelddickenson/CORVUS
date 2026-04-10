import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Team } from "@prisma/client";
import { CatBadge } from "@/components/ui/CatBadge";
import { ImpactBadge } from "@/components/ui/ImpactBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TlpBadge } from "@/components/ui/TlpBadge";
import { CAT_LABEL } from "@/lib/catDisplay";
import { TEAM_COLORS, TEAM_LABEL } from "@/lib/teamDisplay";
import { formatDuration } from "@/lib/formatDuration";
import { TeamStatus } from "@prisma/client";

// Auth required — redirects to login with callbackUrl if unauthenticated.
// Read-only layout: no sidebar, no edit controls.
// Only shows content for TLP WHITE or GREEN cases.

function formatUtc(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

const categoryLabel: Record<string, string> = {
  MALWARE:            "Malware",
  INTRUSION:          "Intrusion",
  PHISHING:           "Phishing",
  INSIDER_THREAT:     "Insider Threat",
  NONCOMPLIANCE:      "Non-Compliance",
  VULNERABILITY:      "Vulnerability",
  ANOMALOUS_ACTIVITY: "Anomalous Activity",
  OTHER:              "Other",
};

const STATUS_STYLES: Record<TeamStatus, { text: string; bg: string; border: string }> = {
  ACTIVE:   { text: "text-green-300",   bg: "bg-green-950",   border: "border-green-700"   },
  PENDING:  { text: "text-amber-300",   bg: "bg-amber-950",   border: "border-amber-700"   },
  COMPLETE: { text: "text-neutral-400", bg: "bg-neutral-800", border: "border-neutral-700" },
  RETURNED: { text: "text-red-300",     bg: "bg-red-950",     border: "border-red-700"     },
};

const STATUS_LABEL_MAP: Record<TeamStatus, string> = {
  ACTIVE:   "Active",
  PENDING:  "Pending",
  COMPLETE: "Complete",
  RETURNED: "Returned",
};

const MILESTONE_TYPES = new Set(["STATUS_CHANGE", "ESCALATION", "RETURNED"]);
const ENTRY_TYPE_LABELS: Record<string, string> = {
  STATUS_CHANGE: "Status Changed",
  ESCALATION:    "Team Looped In",
  RETURNED:      "Returned to Team",
};

export default async function PublicSummaryPage({
  params,
}: {
  params: { id: string };
}) {
  // Auth required — redirect unauthenticated users to login
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=/cases/${params.id}/summary`);
  }

  const c = await prisma.case.findUnique({
    where:   { id: params.id },
    include: {
      createdBy: { select: { name: true } },
    },
  });

  if (!c) return notFound();

  // Fetch related data
  const [teamStatuses, entries, iocCount, ttpCount, assetCount] = await Promise.all([
    prisma.caseTeamStatus.findMany({
      where:   { caseId: params.id },
      orderBy: { updatedAt: "asc" },
      select:  { id: true, team: true, status: true, updatedAt: true },
    }),
    prisma.caseEntry.findMany({
      where:   { caseId: params.id },
      orderBy: { createdAt: "asc" },
      select:  {
        id:        true,
        entryType: true,
        body:      true,
        createdAt: true,
        authorTeam: true,
        author:    { select: { name: true } },
      },
    }),
    prisma.ioc.count({ where: { caseId: params.id } }),
    prisma.ttp.count({ where: { caseId: params.id } }),
    prisma.asset.count({ where: { caseId: params.id } }),
  ]);

  // Time metrics
  const now      = new Date();
  const created  = c.createdAt;
  const closed   = c.closedAt;
  const timeOpen = formatDuration((closed ?? now).getTime() - created.getTime());

  const firstEscalation = entries.find((e) => e.entryType === "ESCALATION");
  const timeToFirstEscalation = firstEscalation
    ? formatDuration(firstEscalation.createdAt.getTime() - created.getTime())
    : "N/A";

  const firstResponse = entries.find((e) => e.authorTeam !== "SOC");
  const timeToFirstResponse = firstResponse
    ? formatDuration(firstResponse.createdAt.getTime() - created.getTime())
    : "N/A";

  const milestones = entries.filter((e) => MILESTONE_TYPES.has(e.entryType));
  const activeTeams = teamStatuses.filter((r) => r.status === "ACTIVE");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      {/* Header banner */}
      <header className="border-b border-neutral-800 px-6 py-3 flex items-center justify-between">
        <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
          CORVUS — Read-Only Summary
        </p>
        <TlpBadge tlp={c.tlp} custom={c.classificationCustom} />
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* ---------------------------------------------------------------- */}
        {/* Case Overview                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section>
          <p className="font-mono text-xs text-neutral-500 mb-1">{c.caseId}</p>
          <h1 className="text-xl font-semibold text-white mb-4 leading-snug">{c.title}</h1>

          <div className="flex flex-wrap gap-2 items-center mb-4">
            <StatusBadge status={c.status} />
            <CatBadge cat={c.cat} />
            <span className="text-xs text-neutral-500">{CAT_LABEL[c.cat]}</span>
            <span className="text-neutral-700">·</span>
            <ImpactBadge level={c.impactLevel} />
            <span className="text-neutral-700">·</span>
            <span className="text-xs text-neutral-400">{categoryLabel[c.category] ?? c.category}</span>
          </div>

          {/* Time metrics */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(
              [
                ["Time Open",                timeOpen],
                ["Time to First Escalation", timeToFirstEscalation],
                ["Time to First Response",   timeToFirstResponse],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2">
                <p className="text-xs text-neutral-500 mb-1">{label}</p>
                <p className="font-mono text-sm text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Counts */}
          <div className="flex gap-3">
            {([["IOCs", iocCount], ["TTPs", ttpCount], ["Assets", assetCount]] as [string, number][]).map(
              ([label, count]) => (
                <div key={label} className="bg-neutral-900 border border-neutral-800 rounded px-3 py-1.5 flex items-center gap-2">
                  <span className="text-xs text-neutral-500">{label}</span>
                  <span className="font-mono text-sm text-white">{count}</span>
                </div>
              )
            )}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* BLUF Summary                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Summary</h2>
          <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {c.blufSummary || (
              <span className="text-neutral-600 italic">No summary provided.</span>
            )}
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Team Status                                                       */}
        {/* ---------------------------------------------------------------- */}
        {teamStatuses.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Team Status</h2>
            {activeTeams.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="text-xs text-neutral-500">Active:</span>
                {activeTeams.map((r) => {
                  const tc = TEAM_COLORS[r.team as Team];
                  return (
                    <span key={r.id} className={`font-mono text-xs px-1.5 py-0.5 rounded border ${tc.bg} ${tc.text} ${tc.border}`}>
                      {TEAM_LABEL[r.team as Team]}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="space-y-1">
              {teamStatuses.map((r) => {
                const tc = TEAM_COLORS[r.team as Team];
                const sc = STATUS_STYLES[r.status];
                return (
                  <div key={r.id} className="flex items-center gap-2 py-1 border-b border-neutral-800 last:border-0">
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded border flex-shrink-0 w-16 text-center ${tc.bg} ${tc.text} ${tc.border}`}>
                      {TEAM_LABEL[r.team as Team]}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}>
                      {STATUS_LABEL_MAP[r.status]}
                    </span>
                    <span className="font-mono text-xs text-neutral-600">{formatUtc(r.updatedAt)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Key Milestones                                                    */}
        {/* ---------------------------------------------------------------- */}
        {milestones.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Key Milestones</h2>
            <div className="space-y-0">
              {milestones.map((e, i) => (
                <div key={e.id} className="flex gap-3 items-start py-1.5">
                  <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-neutral-600 flex-shrink-0" />
                    {i < milestones.length - 1 && (
                      <div className="w-px flex-1 bg-neutral-800 min-h-[1rem]" />
                    )}
                  </div>
                  <div className="min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-neutral-500">{formatUtc(e.createdAt)}</span>
                      <span className="text-xs text-neutral-300">{ENTRY_TYPE_LABELS[e.entryType] ?? e.entryType}</span>
                      <span className="text-xs text-neutral-500">by {e.author.name}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5 leading-snug">{e.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Recommended Actions                                               */}
        {/* ---------------------------------------------------------------- */}
        {c.recommendedActions && (
          <section>
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">Recommended Actions</h2>
            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {c.recommendedActions}
            </p>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-4 border-t border-neutral-800">
          <p className="text-xs text-neutral-600">
            Case <span className="font-mono">{c.caseId}</span> · Opened {formatUtc(c.createdAt)}
            {c.closedAt ? ` · Closed ${formatUtc(c.closedAt)}` : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}
