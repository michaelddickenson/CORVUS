"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TEAM_LABEL } from "@/lib/teamDisplay";

interface User {
  id: string;
  name: string;
  team: string | null;
}

interface Props {
  caseUuid: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
}

export function CaseAssignControl({
  caseUuid,
  currentAssigneeId,
  currentAssigneeName,
}: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState(currentAssigneeId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }, []);

  async function handleAssign() {
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseUuid}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: selected || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to assign case.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  const isDirty = selected !== (currentAssigneeId ?? "");

  return (
    <div className="w-full min-w-0 space-y-2">
      <div className="text-sm text-neutral-300 truncate">
        {currentAssigneeName ?? <span className="text-neutral-600">Unassigned</span>}
      </div>
      <div className="flex gap-2 items-center w-full min-w-0">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setSuccess(false);
          }}
          className="min-w-0 flex-1 bg-neutral-900 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} {u.team ? `(${(TEAM_LABEL as Record<string, string>)[u.team] ?? u.team})` : ""}
            </option>
          ))}
        </select>

        <button
          onClick={handleAssign}
          disabled={loading || !isDirty}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? "..." : "Save"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && !error && (
        <p className="text-xs text-green-400">Assignment updated.</p>
      )}
    </div>
  );
}
