import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, Team } from "@prisma/client";
import { CatBadge } from "@/components/ui/CatBadge";
import { ImpactBadge } from "@/components/ui/ImpactBadge";
import { TlpBadge } from "@/components/ui/TlpBadge";
import { CaseStatusControl } from "@/components/cases/CaseStatusControl";
import { CaseAssignControl } from "@/components/cases/CaseAssignControl";
import { CaseTimeline, CaseEntryRow } from "@/components/cases/CaseTimeline";
import { EscalateControl } from "@/components/cases/EscalateControl";
import { IocSection } from "@/components/cases/IocSection";
import { AssetSection } from "@/components/cases/AssetSection";
import { TtpSection } from "@/components/cases/TtpSection";
import { CaseLinkSection } from "@/components/cases/CaseLinkSection";
import { ArtifactPanel } from "@/components/cases/ArtifactPanel";
import { TeamStatusPanel } from "@/components/cases/TeamStatusPanel";
import { BounceBackControl } from "@/components/cases/BounceBackControl";
import { MarkCompleteButton } from "@/components/cases/MarkCompleteButton";
import { SummaryTab, SummaryEntry, TeamStatusRow } from "@/components/cases/SummaryTab";
import { CaseDetailTabs } from "@/components/cases/CaseDetailTabs";
import { IncidentDetailsSection } from "@/components/cases/IncidentDetailsSection";
import { CAT_LABEL } from "@/lib/catDisplay";

function formatUtc(date: Date | null) {
  if (!date) return "—";
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
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

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-neutral-800 last:border-0">
      <dt className="text-xs text-neutral-500 mb-1">{label}</dt>
      <dd className="text-sm text-neutral-200">{children}</dd>
    </div>
  );
}

export default async function CaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return notFound();

  // Fetch case, entries, and team statuses in parallel
  const [c, rawEntries, teamStatuses, iocCount, ttpCount, assetCount] = await Promise.all([
    prisma.case.findUnique({
      where:   { id: params.id },
      include: {
        createdBy:  { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.caseEntry.findMany({
      where:   { caseId: params.id },
      orderBy: { createdAt: "asc" },
      select:  {
        id:         true,
        authorTeam: true,
        entryType:  true,
        body:       true,
        corrects:   true,
        createdAt:  true,
        author:     { select: { id: true, name: true, role: true } },
      },
    }),
    prisma.caseTeamStatus.findMany({
      where:   { caseId: params.id },
      orderBy: { updatedAt: "asc" },
      select: {
        id:        true,
        team:      true,
        status:    true,
        updatedAt: true,
        updatedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.ioc.count({ where: { caseId: params.id } }),
    prisma.ttp.count({ where: { caseId: params.id } }),
    prisma.asset.count({ where: { caseId: params.id } }),
  ]);

  if (!c) return notFound();

  // Serialize entries for client components
  const initialEntries: CaseEntryRow[] = rawEntries.map((e) => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
  }));

  const summaryEntries: SummaryEntry[] = rawEntries.map((e) => ({
    id:        e.id,
    entryType: e.entryType,
    body:      e.body,
    createdAt: e.createdAt.toISOString(),
    author:    e.author,
    authorTeam: e.authorTeam,
  }));

  const serializedTeamStatuses: TeamStatusRow[] = teamStatuses.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
  }));

  // Permissions
  const canEscalate =
    c.createdById === session.user.id ||
    session.user.role === Role.TEAM_LEAD ||
    session.user.role === Role.ADMIN;

  const canDeleteArtifact =
    session.user.role === Role.ADMIN || session.user.role === Role.TEAM_LEAD;

  const canExport =
    session.user.role === Role.ADMIN || session.user.role === Role.TEAM_LEAD;

  const canEditRecommendedActions =
    session.user.role === Role.ADMIN || session.user.role === Role.TEAM_LEAD;

  const canShareLink =
    session.user.role === Role.ADMIN || session.user.role === Role.TEAM_LEAD;

  // Team action permissions
  const userTeam = session.user.team;
  const myTeamStatus = userTeam
    ? serializedTeamStatuses.find((r) => r.team === userTeam)
    : null;

  const canMarkComplete = myTeamStatus?.status === "ACTIVE";
  const canBounceBack   =
    myTeamStatus?.status === "ACTIVE" ||
    session.user.role === Role.TEAM_LEAD ||
    session.user.role === Role.ADMIN;

  const teamsInvolved = c.teamsInvolved as Team[];

  // Always default to Summary tab
  const defaultTab = "summary";

  const shareableLink = canShareLink
    ? `${process.env.NEXTAUTH_URL ?? ""}/cases/${c.id}/summary`
    : undefined;

  return (
    <div className="flex gap-0 min-h-full">
      {/* ------------------------------------------------------------------ */}
      {/* Left: metadata panel                                                */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-72 flex-shrink-0 border-r border-neutral-800 pr-6 mr-6 overflow-y-auto">
        {/* Case ID + title */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-xs text-neutral-500 mb-1">{c.caseId}</p>
              <h1 className="text-base font-semibold text-white leading-snug">{c.title}</h1>
            </div>
            {canExport && (
              <a
                href={`/api/cases/${c.id}/export`}
                download
                className="flex-shrink-0 mt-0.5 px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border border-neutral-700 rounded transition-colors"
              >
                Export
              </a>
            )}
          </div>
        </div>

        <dl>
          <MetaRow label="Status">
            <CaseStatusControl caseUuid={c.id} currentStatus={c.status} />
          </MetaRow>

          <MetaRow label="Incident Category">
            <div className="flex items-center gap-2">
              <CatBadge cat={c.cat} />
              <span className="text-xs text-neutral-500">{CAT_LABEL[c.cat]?.split("—")[1]?.trim()}</span>
            </div>
          </MetaRow>

          <MetaRow label="Impact Level">
            <ImpactBadge level={c.impactLevel} />
          </MetaRow>

          <MetaRow label="Incident Type">
            {categoryLabel[c.category] ?? c.category}
          </MetaRow>

          <MetaRow label="Classification">
            <TlpBadge tlp={c.tlp} custom={c.classificationCustom} />
          </MetaRow>

          <MetaRow label="Assigned To">
            <CaseAssignControl
              caseUuid={c.id}
              currentAssigneeId={c.assignedTo?.id ?? null}
              currentAssigneeName={c.assignedTo?.name ?? null}
            />
          </MetaRow>

          <MetaRow label="Created By">
            {c.createdBy.name}
          </MetaRow>

          {/* Team Status Panel — replaces plain "Teams Involved" list */}
          <MetaRow label="Team Status">
            <TeamStatusPanel caseId={c.id} initialData={serializedTeamStatuses} />
          </MetaRow>

          {/* Team action buttons */}
          {(canMarkComplete || canBounceBack) && (
            <MetaRow label="Team Actions">
              <div className="space-y-2">
                {canMarkComplete && (
                  <MarkCompleteButton caseId={c.id} />
                )}
                {canBounceBack && (
                  <BounceBackControl
                    caseId={c.id}
                    teamStatuses={serializedTeamStatuses}
                  />
                )}
              </div>
            </MetaRow>
          )}

          {/* Escalate / loop-in control */}
          {canEscalate && (
            <MetaRow label="Loop In Team">
              <EscalateControl caseId={c.id} teamsInvolved={teamsInvolved} />
            </MetaRow>
          )}

          <MetaRow label="Opened">
            <span className="font-mono text-xs">{formatUtc(c.createdAt)}</span>
          </MetaRow>

          <MetaRow label="Last Updated">
            <span className="font-mono text-xs">{formatUtc(c.updatedAt)}</span>
          </MetaRow>

          {c.closedAt && (
            <MetaRow label="Closed">
              <span className="font-mono text-xs">{formatUtc(c.closedAt)}</span>
            </MetaRow>
          )}
        </dl>

        {/* Case description */}
        <div className="mt-2 pt-3 border-t border-neutral-800 mb-2">
          <p className="text-xs text-neutral-500 mb-1.5">Description</p>
          <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {c.description}
          </p>
        </div>

        {/* ── Incident Details ──────────────────────────────────────────── */}
        <IncidentDetailsSection
          caseId={c.id}
          incidentStartedAt={c.incidentStartedAt?.toISOString() ?? null}
          incidentEndedAt={c.incidentEndedAt?.toISOString() ?? null}
          incidentDetectedAt={c.incidentDetectedAt?.toISOString() ?? null}
          incidentReportedAt={c.incidentReportedAt?.toISOString() ?? null}
          detectionSource={c.detectionSource ?? null}
          attackVector={c.attackVector ?? null}
          affectedNetwork={c.affectedNetwork ?? null}
          missionImpact={c.missionImpact ?? null}
          reportingRequired={c.reportingRequired}
          externalTicketId={c.externalTicketId ?? null}
        />

        {/* ── Structured data modules (Phases 4–6) ──────────────────────── */}
        <div className="border-t border-neutral-800 pt-1">
          <ArtifactPanel caseId={c.id} canDelete={canDeleteArtifact} />
          <IocSection caseId={c.id} />
          <AssetSection caseId={c.id} />
          <TtpSection caseId={c.id} />
          <CaseLinkSection caseId={c.caseId} currentCaseUuid={c.id} />
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Right: Summary / Timeline tabs                                      */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 min-w-0">
        <CaseDetailTabs defaultTab={defaultTab}>
          {{
            summary: (
              <SummaryTab
                caseUuid={c.id}
                caseId={c.caseId}
                title={c.title}
                cat={c.cat}
                impactLevel={c.impactLevel}
                tlp={c.tlp}
                classificationCustom={c.classificationCustom}
                status={c.status}
                category={c.category}
                createdAt={c.createdAt.toISOString()}
                closedAt={c.closedAt?.toISOString() ?? null}
                blufSummary={c.blufSummary ?? null}
                recommendedActions={c.recommendedActions ?? null}
                iocCount={iocCount}
                ttpCount={ttpCount}
                assetCount={assetCount}
                initialEntries={summaryEntries}
                initialTeamStatuses={serializedTeamStatuses}
                canEditRecommendedActions={canEditRecommendedActions}
                isShareableLink={shareableLink}
              />
            ),
            timeline: (
              <CaseTimeline caseId={c.id} initialEntries={initialEntries} />
            ),
          }}
        </CaseDetailTabs>
      </main>
    </div>
  );
}
