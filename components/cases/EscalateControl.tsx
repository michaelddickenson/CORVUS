"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Team } from "@prisma/client";

const ALL_TEAMS: Team[] = ["SOC", "IR", "MALWARE", "CTI", "COUNTERMEASURES"];

const teamLabels: Record<Team, string> = {
  SOC: "SOC",
  IR: "IR",
  MALWARE: "Malware Analysis",
  CTI: "CTI",
  COUNTERMEASURES: "Countermeasures",
};

interface Props {
  caseId: string;          // UUID
  teamsInvolved: Team[];
}

export function EscalateControl({ caseId, teamsInvolved }: Props) {
  const router = useRouter();
  const [targetTeam, setTargetTeam] = useState<Team | "">("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    if (!targetTeam) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/cases/${caseId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTeam, note: note.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to loop in team.");
        return;
      }

      setSuccess(`${teamLabels[targetTeam]} notified.`);
      setTargetTeam("");
      setNote("");
      // Refresh server component so teamsInvolved in the metadata panel updates
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={targetTeam}
          onChange={(e) => {
            setTargetTeam(e.target.value as Team | "");
            setSuccess(null);
          }}
          className="flex-1 bg-neutral-900 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select team...</option>
          {ALL_TEAMS.map((t) => (
            <option key={t} value={t}>
              {teamLabels[t]}
              {teamsInvolved.includes(t) ? " (already in)" : ""}
            </option>
          ))}
        </select>

        <button
          onClick={handleSubmit}
          disabled={!targetTeam || loading}
          className="text-xs px-3 py-1.5 rounded bg-amber-700 hover:bg-amber-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
        >
          {loading ? "..." : "Loop In"}
        </button>
      </div>

      {/* Optional context note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional context (added to timeline)..."
        rows={2}
        maxLength={2000}
        className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
      />

      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-400">{success}</p>}
    </div>
  );
}
