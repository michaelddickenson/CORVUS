"use client";

import { useEffect, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AuditUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: AuditUser;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Detail toggle — collapsible JSON diff
// ---------------------------------------------------------------------------
function DetailCell({ detail }: { detail: unknown }) {
  const [open, setOpen] = useState(false);
  if (!detail) return <span className="text-neutral-700">—</span>;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        {open ? "Hide" : "Show"} detail
      </button>
      {open && (
        <pre className="mt-2 p-2 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-300 font-mono whitespace-pre-wrap max-w-md overflow-x-auto">
          {JSON.stringify(detail, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (actionFilter) params.set("action", actionFilter);
    if (userIdFilter) params.set("userId", userIdFilter);
    if (targetTypeFilter) params.set("targetType", targetTypeFilter);

    const res = await fetch(`/api/admin/audit?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
      setPagination(data.pagination);
    }
    setLoading(false);
  }, [page, actionFilter, userIdFilter, targetTypeFilter]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [actionFilter, userIdFilter, targetTypeFilter]);

  function formatUtc(iso: string) {
    return iso.replace("T", " ").slice(0, 19) + " UTC";
  }

  return (
    <div className="max-w-7xl">
      <h1 className="text-lg font-semibold text-white mb-6">Audit Log</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action…"
          className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-blue-500 w-52"
        />
        <input
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value)}
          placeholder="Filter by target type…"
          className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-blue-500 w-44"
        />
        <input
          value={userIdFilter}
          onChange={(e) => setUserIdFilter(e.target.value)}
          placeholder="Filter by user ID…"
          className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-blue-500 w-64 font-mono text-xs"
        />
        {(actionFilter || userIdFilter || targetTypeFilter) && (
          <button
            onClick={() => { setActionFilter(""); setUserIdFilter(""); setTargetTypeFilter(""); }}
            className="text-xs text-neutral-500 hover:text-neutral-300 px-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Pagination info */}
      {pagination && (
        <p className="text-xs text-neutral-600 mb-3">
          {pagination.total} entries — page {pagination.page} of {pagination.totalPages}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-neutral-600">No audit log entries found.</p>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-left">
            <thead className="bg-neutral-900 border-b border-neutral-800">
              <tr>
                {["Timestamp", "Actor", "Action", "Target", "IP", "Detail"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-xs font-medium text-neutral-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-neutral-950 divide-y divide-neutral-900">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-neutral-900/50">
                  <td className="px-4 py-3 text-xs font-mono text-neutral-400 whitespace-nowrap">
                    {formatUtc(e.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-neutral-300">{e.user.name}</p>
                    <p className="text-xs font-mono text-neutral-600">{e.user.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-amber-400">{e.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    {e.targetType ? (
                      <>
                        <p className="text-xs text-neutral-400">{e.targetType}</p>
                        <p className="text-xs font-mono text-neutral-600">{e.targetId}</p>
                      </>
                    ) : (
                      <span className="text-neutral-700">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-neutral-600">
                    {e.ipAddress ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <DetailCell detail={e.detail} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 rounded"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-500">
            {page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages || loading}
            className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 rounded"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
