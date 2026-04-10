"use client";

import { useState } from "react";
import { Team, Role } from "@prisma/client";

interface WorkloadRow {
  id:            string;
  name:          string;
  role:          Role;
  team:          Team | null;
  openCaseCount: number;
}

const PAGE_SIZE = 10;

export function WorkloadTable({ rows }: { rows: WorkloadRow[] }) {
  const [page, setPage] = useState(1);

  // Sort: open cases desc, 0-count users to the bottom
  const sorted = [...rows].sort((a, b) => {
    if (a.openCaseCount === 0 && b.openCaseCount > 0) return 1;
    if (b.openCaseCount === 0 && a.openCaseCount > 0) return -1;
    return b.openCaseCount - a.openCaseCount;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="border border-neutral-800 rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900 border-b border-neutral-800">
          <tr>
            <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs">Name</th>
            <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs w-24">Team</th>
            <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs w-32">Role</th>
            <th className="text-right px-3 py-2 text-neutral-400 font-medium text-xs w-24">Open Cases</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {pageRows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-neutral-600 text-xs">
                No users found.
              </td>
            </tr>
          )}
          {pageRows.map((u) => (
            <tr key={u.id} className="hover:bg-neutral-900/50" style={{ height: "40px" }}>
              <td className="px-3 py-0 text-neutral-200 text-xs">{u.name}</td>
              <td className="px-3 py-0 text-neutral-400 text-xs font-mono">{u.team ?? "—"}</td>
              <td className="px-3 py-0 text-neutral-500 text-xs">{u.role.replace(/_/g, " ")}</td>
              <td className="px-3 py-0 text-right">
                <span className={`font-mono text-sm font-bold ${u.openCaseCount > 5 ? "text-amber-400" : u.openCaseCount === 0 ? "text-neutral-600" : "text-neutral-300"}`}>
                  {u.openCaseCount}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-3 py-2 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-xs text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-6 h-6 rounded text-xs font-mono transition-colors ${
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-xs text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
