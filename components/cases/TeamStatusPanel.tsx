"use client";

import { useEffect, useState } from "react";
import { Team, TeamStatus } from "@prisma/client";
import { TEAM_COLORS, TEAM_LABEL } from "@/lib/teamDisplay";

interface TeamStatusRow {
  id:        string;
  team:      Team;
  status:    TeamStatus;
  updatedAt: string;
  updatedBy: { id: string; name: string };
}

const STATUS_STYLES: Record<TeamStatus, { text: string; bg: string; border: string }> = {
  ACTIVE:   { text: "text-green-300",   bg: "bg-green-950",   border: "border-green-700"   },
  PENDING:  { text: "text-amber-300",   bg: "bg-amber-950",   border: "border-amber-700"   },
  COMPLETE: { text: "text-neutral-400", bg: "bg-neutral-800", border: "border-neutral-700" },
  RETURNED: { text: "text-red-300",     bg: "bg-red-950",     border: "border-red-700"     },
};

const STATUS_LABEL: Record<TeamStatus, string> = {
  ACTIVE:   "Active",
  PENDING:  "Pending",
  COMPLETE: "Complete",
  RETURNED: "Returned",
};

function formatUtc(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

interface Props {
  caseId:        string;
  // If provided, rendered statically (no fetch). Used by server-rendered summary tab.
  initialData?:  TeamStatusRow[];
}

export function TeamStatusPanel({ caseId, initialData }: Props) {
  const [rows,    setRows]    = useState<TeamStatusRow[]>(initialData ?? []);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (initialData) return;
    fetch(`/api/cases/${caseId}/team-status`)
      .then((r) => r.json())
      .then((data: TeamStatusRow[]) => setRows(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [caseId, initialData]);

  const activeTeams = rows.filter((r) => r.status === "ACTIVE");

  if (loading) {
    return <p className="text-xs text-neutral-600 animate-pulse">Loading team status...</p>;
  }

  if (rows.length === 0) {
    return <p className="text-xs text-neutral-600">No team status records yet.</p>;
  }

  return (
    <div className="space-y-1">
      {/* Active team callout */}
      {activeTeams.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-neutral-500">Active:</span>
          {activeTeams.map((r) => {
            const tc = TEAM_COLORS[r.team];
            return (
              <span
                key={r.id}
                className={`font-mono text-xs px-1.5 py-0.5 rounded border ${tc.bg} ${tc.text} ${tc.border}`}
              >
                {TEAM_LABEL[r.team]}
              </span>
            );
          })}
          {activeTeams.length > 1 && (
            <span className="text-xs text-amber-400 ml-0.5">Multiple teams active</span>
          )}
        </div>
      )}

      {/* Full table */}
      {rows.map((r) => {
        const tc = TEAM_COLORS[r.team];
        const sc = STATUS_STYLES[r.status];
        return (
          <div
            key={r.id}
            className="flex items-center gap-2 py-1 border-b border-neutral-800 last:border-0"
          >
            <span
              className={`font-mono text-xs px-1.5 py-0.5 rounded border flex-shrink-0 w-16 text-center ${tc.bg} ${tc.text} ${tc.border}`}
            >
              {TEAM_LABEL[r.team]}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}
            >
              {STATUS_LABEL[r.status]}
            </span>
            <span className="font-mono text-xs text-neutral-600 truncate">
              {formatUtc(r.updatedAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
