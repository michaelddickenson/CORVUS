"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@prisma/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VALID_TRANSITIONS } from "@/lib/validations/case";

const statusLabels: Record<Status, string> = {
  NEW: "New",
  IN_PROGRESS: "In Progress",
  PENDING_REVIEW: "Pending Review",
  CLOSED: "Closed",
};

interface Props {
  caseUuid: string;
  currentStatus: Status;
}

export function CaseStatusControl({ caseUuid, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = VALID_TRANSITIONS[currentStatus];

  async function transition(newStatus: Status) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseUuid}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to update status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <StatusBadge status={currentStatus} />
      </div>

      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((s) => (
            <button
              key={s}
              onClick={() => transition(s)}
              disabled={loading}
              className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "..." : `→ ${statusLabels[s]}`}
            </button>
          ))}
        </div>
      )}

      {currentStatus === Status.CLOSED && (
        <p className="text-xs text-neutral-600 mt-1">Case closed — no further transitions.</p>
      )}

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
