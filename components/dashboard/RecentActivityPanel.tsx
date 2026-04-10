"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Team } from "@prisma/client";
import { getAuthorTeamDisplay, TEAM_COLORS, TEAM_LABEL } from "@/lib/teamDisplay";

interface ActivityItem {
  id:             string;
  caseId:         string;
  entryType:      string;
  authorTeam:     Team;
  createdAt:      string;
  author:         { name: string; role: string };
  caseFriendlyId: string;
}

interface ActivityResponse {
  items:      ActivityItem[];
  page:       number;
  totalPages: number;
}

function formatUtc(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function RecentActivityPanel() {
  const [data,    setData]    = useState<ActivityResponse | null>(null);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/activity?page=${p}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(page); }, [page, fetchPage]);

  function goTo(p: number) {
    setPage(p);
  }

  const items      = data?.items      ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="border border-neutral-800 rounded overflow-hidden">
      {loading && items.length === 0 && (
        <p className="text-neutral-600 text-xs text-center py-8">Loading...</p>
      )}
      {!loading && items.length === 0 && (
        <p className="text-neutral-600 text-xs text-center py-8">No recent activity.</p>
      )}

      <div className={`divide-y divide-neutral-800 ${loading ? "opacity-60" : ""}`}>
        {items.map((e) => {
          const display = getAuthorTeamDisplay(e.authorTeam, e.author.role as never);
          const colors  = TEAM_COLORS[display];
          return (
            <div key={e.id} className="px-3 py-2.5 hover:bg-neutral-900/50">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link
                  href={`/cases/${e.caseId}`}
                  className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline flex-shrink-0"
                >
                  {e.caseFriendlyId}
                </Link>
                <span className="text-neutral-600 text-xs">·</span>
                <span className="text-neutral-400 text-xs truncate">
                  {e.entryType.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1 py-0.5 rounded font-mono font-medium ${colors.text} ${colors.bg} border ${colors.border}`}>
                  {TEAM_LABEL[display]}
                </span>
                <span className="text-neutral-500 text-[10px] truncate">{e.author.name}</span>
                <span className="text-neutral-700 text-[10px] ml-auto whitespace-nowrap font-mono">
                  {formatUtc(e.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-3 py-2 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page <= 1 || loading}
            className="text-xs text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => goTo(p)}
                disabled={loading}
                className={`w-6 h-6 rounded text-xs font-mono transition-colors disabled:cursor-not-allowed ${
                  p === page
                    ? "bg-neutral-700 text-white"
                    : "text-neutral-500 hover:text-white hover:bg-neutral-800"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages || loading}
            className="text-xs text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
