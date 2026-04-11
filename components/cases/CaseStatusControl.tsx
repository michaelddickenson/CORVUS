"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@prisma/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VALID_TRANSITIONS } from "@/lib/validations/case";

export const statusLabels: Record<Status, string> = {
  NEW:            "New",
  IN_PROGRESS:    "In Progress",
  PENDING_REVIEW: "Pending Review",
  CLOSED:         "Closed",
  ON_HOLD:        "On Hold",
  TICKET:         "Ticket",
};

const ALL_STATUSES = Object.values(Status) as Status[];

interface Props {
  caseUuid:      string;
  currentStatus: Status;
  canOverride?:  boolean; // kept for backwards compat; override dropdown now visible to all
}

export function CaseStatusControl({ caseUuid, currentStatus }: Props) {
  const router = useRouter();
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const available = VALID_TRANSITIONS[currentStatus];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  async function transition(newStatus: Status) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseUuid}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
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

  async function setStatusDirect(newStatus: Status) {
    if (newStatus === currentStatus) { setDropdownOpen(false); return; }
    setError(null);
    setOverrideLoading(true);
    setDropdownOpen(false);
    try {
      const res = await fetch(`/api/cases/${caseUuid}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus, override: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to set status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setOverrideLoading(false);
    }
  }

  return (
    <div>
      {/* Status badge row + override dropdown */}
      <div className="flex items-center gap-2 mb-2">
        <StatusBadge status={currentStatus} />

        {/* Override dropdown — all users */}
        <div className="relative ml-auto" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            disabled={overrideLoading}
            title="Set status directly"
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 border border-neutral-700 transition-colors disabled:opacity-40"
          >
            {overrideLoading ? (
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            )}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-neutral-900 border border-neutral-700 rounded shadow-lg z-20 py-1">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusDirect(s)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    s === currentStatus
                      ? "text-neutral-600 cursor-default"
                      : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  {statusLabels[s]}
                  {s === currentStatus && (
                    <span className="ml-1 text-neutral-700">(current)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sequential next-step buttons — unchanged */}
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
