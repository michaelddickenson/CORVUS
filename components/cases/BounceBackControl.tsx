"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Team, TeamStatus } from "@prisma/client";

interface TeamStatusRow {
  team:   Team;
  status: TeamStatus;
}

interface Props {
  caseId:      string;
  teamStatuses: TeamStatusRow[];
}

const TEAM_LABELS: Record<Team, string> = {
  SOC:             "SOC",
  IR:              "IR",
  MALWARE:         "Malware Analysis",
  CTI:             "CTI",
  COUNTERMEASURES: "Countermeasures",
};

export function BounceBackControl({ caseId, teamStatuses }: Props) {
  const router = useRouter();
  const [open,       setOpen]       = useState(false);
  const [targetTeam, setTargetTeam] = useState<Team | "">("");
  const [message,    setMessage]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Only show teams that are PENDING or COMPLETE (not ACTIVE — can't return to active)
  const eligibleTargets = teamStatuses.filter(
    (r) => r.status === "PENDING" || r.status === "COMPLETE"
  );

  if (eligibleTargets.length === 0) return null;

  async function handleSubmit() {
    if (!targetTeam) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/return`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ targetTeam, message: message.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to issue bounce-back.");
        return;
      }
      setOpen(false);
      setTargetTeam("");
      setMessage("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white transition-colors"
        >
          Return to Team
        </button>
      ) : (
        <div className="space-y-2 mt-1">
          <select
            value={targetTeam}
            onChange={(e) => setTargetTeam(e.target.value as Team | "")}
            className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select team...</option>
            {eligibleTargets.map((r) => (
              <option key={r.team} value={r.team}>
                {TEAM_LABELS[r.team]} ({r.status.toLowerCase()})
              </option>
            ))}
          </select>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional message..."
            rows={2}
            maxLength={2000}
            className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={!targetTeam || loading}
              className="text-xs px-3 py-1.5 rounded bg-red-800 hover:bg-red-700 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-white transition-colors"
            >
              {loading ? "..." : "Confirm Return"}
            </button>
            <button
              onClick={() => { setOpen(false); setError(null); }}
              className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
