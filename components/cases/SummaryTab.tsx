"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IncidentCat, ImpactLevel, IncidentSource, Status, TLP, Team, TeamStatus, Role } from "@prisma/client";
import { formatDuration } from "@/lib/formatDuration";
import { CatBadge } from "@/components/ui/CatBadge";
import { ImpactBadge } from "@/components/ui/ImpactBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TlpBadge } from "@/components/ui/TlpBadge";
import { TeamStatusPanel } from "@/components/cases/TeamStatusPanel";
import { CAT_LABEL } from "@/lib/catDisplay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SummaryEntry {
  id:        string;
  entryType: string;
  body:      string;
  createdAt: string;
  author:    { id: string; name: string; role: Role };
  authorTeam: Team;
}

export interface TeamStatusRow {
  id:        string;
  team:      Team;
  status:    TeamStatus;
  updatedAt: string;
  updatedBy: { id: string; name: string };
}

export interface SummaryTabProps {
  caseUuid:              string;
  caseId:                string;
  title:                 string;
  cat:                   IncidentCat;
  impactLevel:           ImpactLevel;
  tlp:                   TLP;
  classificationCustom?: string | null;
  status:                Status;
  incidentSource:        IncidentSource;
  incidentSourceCustom?: string | null;
  createdAt:             string;
  closedAt:              string | null;

  blufSummary:        string | null;
  recommendedActions: string | null;

  iocCount:   number;
  ttpCount:   number;
  assetCount: number;

  initialEntries:     SummaryEntry[];
  initialTeamStatuses: TeamStatusRow[];

  canEditRecommendedActions: boolean;
  isShareableLink?: string; // full URL if link should be shown (TEAM_LEAD/ADMIN)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatUtc(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

const MILESTONE_TYPES = new Set(["STATUS_CHANGE", "ESCALATION", "RETURNED"]);

const ENTRY_TYPE_LABELS: Record<string, string> = {
  STATUS_CHANGE: "Status Changed",
  ESCALATION:    "Team Looped In",
  RETURNED:      "Returned to Team",
};

const incidentSourceLabel: Record<IncidentSource, string> = {
  EXTERNAL_THREAT: "External Threat",
  INSIDER_THREAT:  "Insider Threat",
  THIRD_PARTY:     "Third Party / Supply Chain",
  UNKNOWN:         "Unknown",
  OTHER:           "Other",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function SummaryTab({
  caseUuid, caseId, title, cat, impactLevel, tlp, classificationCustom, status, incidentSource, incidentSourceCustom,
  createdAt, closedAt,
  blufSummary: initialBluf,
  recommendedActions: initialRecommended,
  iocCount, ttpCount, assetCount,
  initialEntries, initialTeamStatuses,
  canEditRecommendedActions,
  isShareableLink,
}: SummaryTabProps) {
  const router = useRouter();

  // Edit state
  const [editing,    setEditing]    = useState(false);
  const [bluf,       setBluf]       = useState(initialBluf ?? "");
  const [recommended, setRecommended] = useState(initialRecommended ?? "");
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);

  // Sync if server data changes (after router.refresh)
  useEffect(() => { setBluf(initialBluf ?? ""); }, [initialBluf]);
  useEffect(() => { setRecommended(initialRecommended ?? ""); }, [initialRecommended]);

  // Time metrics
  const now        = new Date();
  const created    = new Date(createdAt);
  const closed     = closedAt ? new Date(closedAt) : null;
  const timeOpen   = formatDuration((closed ?? now).getTime() - created.getTime());

  const milestones = initialEntries.filter((e) => MILESTONE_TYPES.has(e.entryType));

  const firstEscalation = initialEntries.find((e) => e.entryType === "ESCALATION");
  const timeToFirstEscalation = firstEscalation
    ? formatDuration(new Date(firstEscalation.createdAt).getTime() - created.getTime())
    : "N/A";

  // First non-SOC CaseEntry
  const firstResponse = initialEntries.find((e) => e.authorTeam !== "SOC");
  const timeToFirstResponse = firstResponse
    ? formatDuration(new Date(firstResponse.createdAt).getTime() - created.getTime())
    : "N/A";

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const body: Record<string, string | null> = { blufSummary: bluf || null };
      if (canEditRecommendedActions) body.recommendedActions = recommended || null;

      const res = await fetch(`/api/cases/${caseUuid}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error ?? "Save failed.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setSaveError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  function handleCopyLink() {
    if (!isShareableLink) return;
    navigator.clipboard.writeText(isShareableLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — Case Overview                                           */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-mono text-xs text-neutral-500 mb-1">{caseId}</p>
            <h3 className="text-sm font-semibold text-white leading-snug">{title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={status} />
            <TlpBadge tlp={tlp} custom={classificationCustom} />
          </div>
        </div>

        {/* Category + CAT + Impact row */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <CatBadge cat={cat} />
          <span className="text-xs text-neutral-500">{CAT_LABEL[cat]}</span>
          <span className="text-neutral-700">·</span>
          <ImpactBadge level={impactLevel} />
          <span className="text-neutral-700">·</span>
          <span className="text-xs text-neutral-400">
            {incidentSource === "OTHER" && incidentSourceCustom
              ? incidentSourceCustom
              : (incidentSourceLabel[incidentSource] ?? incidentSource)}
          </span>
        </div>

        {/* Time metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {(
            [
              ["Time Open",              timeOpen],
              ["Time to First Escalation", timeToFirstEscalation],
              ["Time to First Response", timeToFirstResponse],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div
              key={label}
              className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2"
            >
              <p className="text-xs text-neutral-500 mb-1">{label}</p>
              <p className="font-mono text-sm text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* At-a-glance counts */}
        <div className="flex gap-3">
          {(
            [
              ["IOCs",   iocCount],
              ["TTPs",   ttpCount],
              ["Assets", assetCount],
            ] as [string, number][]
          ).map(([label, count]) => (
            <div
              key={label}
              className="bg-neutral-900 border border-neutral-800 rounded px-3 py-1.5 flex items-center gap-2"
            >
              <span className="text-xs text-neutral-500">{label}</span>
              <span className="font-mono text-sm text-white">{count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — BLUF Summary                                           */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
            Summary
          </h4>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-neutral-500 mb-1">BLUF Summary</p>
              <textarea
                value={bluf}
                onChange={(e) => setBluf(e.target.value)}
                rows={5}
                maxLength={10000}
                className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                placeholder="Bottom line up front..."
              />
            </div>

            {canEditRecommendedActions && (
              <div>
                <p className="text-xs text-neutral-500 mb-1">Recommended Actions</p>
                <textarea
                  value={recommended}
                  onChange={(e) => setRecommended(e.target.value)}
                  rows={4}
                  maxLength={10000}
                  className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                  placeholder="Recommended next actions..."
                />
              </div>
            )}

            {saveError && <p className="text-xs text-red-400">{saveError}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-white transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setSaveError(null);
                  setBluf(initialBluf ?? "");
                  setRecommended(initialRecommended ?? "");
                }}
                className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
              {initialBluf || (
                <span className="text-neutral-600 italic">No summary provided.</span>
              )}
            </p>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 — Team Status                                             */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
          Team Status
        </h4>
        <TeamStatusPanel caseId={caseUuid} initialData={initialTeamStatuses} />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4 — Key Milestones                                          */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
          Key Milestones
        </h4>
        {milestones.length === 0 ? (
          <p className="text-xs text-neutral-600">No milestones yet.</p>
        ) : (
          <div className="space-y-0">
            {milestones.map((e, i) => (
              <div key={e.id} className="flex gap-3 items-start py-1.5">
                {/* Connector */}
                <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-neutral-600 flex-shrink-0" />
                  {i < milestones.length - 1 && (
                    <div className="w-px flex-1 bg-neutral-800 min-h-[1rem]" />
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-neutral-500">
                      {formatUtc(e.createdAt)}
                    </span>
                    <span className="text-xs text-neutral-300">
                      {ENTRY_TYPE_LABELS[e.entryType] ?? e.entryType}
                    </span>
                    <span className="text-xs text-neutral-500">by {e.author.name}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5 leading-snug">{e.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 5 — Recommended Actions                                     */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
            Recommended Actions
          </h4>
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
          {initialRecommended || (
            <span className="text-neutral-600 italic">No recommended actions recorded.</span>
          )}
        </p>
        {!canEditRecommendedActions && !initialRecommended && null}
      </section>

      {/* Shareable link */}
      {isShareableLink && (
        <div className="pt-3 border-t border-neutral-800">
          <button
            onClick={handleCopyLink}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {copied ? "Link copied!" : "Copy shareable link"}
          </button>
          <p className="text-xs text-neutral-600 mt-0.5">
            No authentication required.
          </p>
        </div>
      )}
    </div>
  );
}
