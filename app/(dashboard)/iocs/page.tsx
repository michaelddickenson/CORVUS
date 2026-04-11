"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { IocType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface IocRow {
  id:                string;
  value:             string;
  type:              IocType;
  confidence:        number;
  confidenceBucket:  "HIGH" | "MEDIUM" | "LOW";
  createdAt:         string;
  addedByName:       string;
  caseUuid:          string;
  caseId:            string;
  caseTitle:         string;
  caseCount:         number;
}

interface ApiResponse {
  rows:      IocRow[];
  total:     number;
  page:      number;
  pageSize:  number;
  pageCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const IOC_TYPES: IocType[] = [
  "IP", "DOMAIN", "URL", "MD5", "SHA1", "SHA256",
  "EMAIL", "FILE_PATH", "REGISTRY_KEY", "YARA_RULE", "OTHER",
];

const CONFIDENCE_OPTIONS = ["HIGH", "MEDIUM", "LOW"] as const;

const IOC_TYPE_STYLES: Record<IocType, string> = {
  IP:           "bg-blue-950 text-blue-400 border-blue-800",
  DOMAIN:       "bg-indigo-950 text-indigo-400 border-indigo-800",
  URL:          "bg-violet-950 text-violet-400 border-violet-800",
  MD5:          "bg-orange-950 text-orange-400 border-orange-800",
  SHA1:         "bg-orange-950 text-orange-400 border-orange-800",
  SHA256:       "bg-amber-950 text-amber-400 border-amber-800",
  EMAIL:        "bg-pink-950 text-pink-400 border-pink-800",
  FILE_PATH:    "bg-neutral-800 text-neutral-400 border-neutral-700",
  REGISTRY_KEY: "bg-neutral-800 text-neutral-300 border-neutral-700",
  YARA_RULE:    "bg-green-950 text-green-400 border-green-800",
  OTHER:        "bg-neutral-800 text-neutral-500 border-neutral-700",
};

const CONFIDENCE_STYLES: Record<"HIGH" | "MEDIUM" | "LOW", string> = {
  HIGH:   "bg-red-950 text-red-400 border-red-800",
  MEDIUM: "bg-amber-950 text-amber-400 border-amber-800",
  LOW:    "bg-neutral-800 text-neutral-400 border-neutral-700",
};

function formatUtc(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

// ---------------------------------------------------------------------------
// Multi-select popover
// ---------------------------------------------------------------------------
function MultiSelectPopover<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label:    string;
  options:  T[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(v: T) {
    onChange(
      selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-colors ${
          selected.length > 0
            ? "bg-blue-900 text-blue-300 border-blue-700"
            : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-neutral-200"
        }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-blue-700 text-white text-[10px] rounded-full px-1.5 leading-none py-0.5">
            {selected.length}
          </span>
        )}
        <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-neutral-900 border border-neutral-700 rounded shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-neutral-800 transition-colors"
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                  selected.includes(opt)
                    ? "bg-blue-600 border-blue-500"
                    : "border-neutral-600"
                }`}
              >
                {selected.includes(opt) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="text-neutral-300">{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IOC Manager page
// ---------------------------------------------------------------------------
export default function IocManagerPage() {
  const [search,      setSearch]      = useState("");
  const [debouncedQ,  setDebouncedQ]  = useState("");
  const [typeFilters, setTypeFilters] = useState<IocType[]>([]);
  const [confFilters, setConfFilters] = useState<Array<"HIGH" | "MEDIUM" | "LOW">>([]);
  const [sort,        setSort]        = useState("createdAt");
  const [page,        setPage]        = useState(1);
  const [data,        setData]        = useState<ApiResponse | null>(null);
  const [loading,     setLoading]     = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [typeFilters, confFilters, sort]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQ)          params.set("search", debouncedQ);
    typeFilters.forEach((t) => params.append("type", t));
    confFilters.forEach((c) => params.append("confidence", c));
    params.set("sort", sort);
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/iocs?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, typeFilters, confFilters, sort, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">IOC Manager</h1>
        <p className="text-neutral-400 text-sm mt-0.5">
          Cross-case indicator of compromise search and browse.
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search IOC value..."
          className="flex-1 min-w-48 bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <MultiSelectPopover
          label="Type"
          options={IOC_TYPES}
          selected={typeFilters}
          onChange={setTypeFilters}
        />

        <MultiSelectPopover
          label="Confidence"
          options={[...CONFIDENCE_OPTIONS]}
          selected={confFilters}
          onChange={(v) => setConfFilters(v as Array<"HIGH" | "MEDIUM" | "LOW">)}
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 text-neutral-300 rounded px-2 py-1.5 text-xs focus:outline-none"
        >
          <option value="createdAt">Sort: Added Date</option>
          <option value="type">Sort: IOC Type</option>
          <option value="caseId">Sort: Case ID</option>
        </select>

        {/* Active filter chips */}
        {(typeFilters.length > 0 || confFilters.length > 0 || debouncedQ) && (
          <button
            type="button"
            onClick={() => { setSearch(""); setTypeFilters([]); setConfFilters([]); }}
            className="text-xs text-neutral-500 hover:text-neutral-300 px-2 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results info */}
      {data && !loading && (
        <p className="text-xs text-neutral-500 mb-3">
          {data.total === 0
            ? "No IOCs found."
            : `${data.total} IOC${data.total !== 1 ? "s" : ""} found — page ${data.page} of ${data.pageCount}`}
        </p>
      )}

      {/* Table */}
      <div className="border border-neutral-800 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/50">
              <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 w-12">Type</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500">Value</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 w-20">Conf.</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 w-32">Case</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 hidden lg:table-cell">Title</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 hidden xl:table-cell w-28">Added By</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 hidden xl:table-cell w-36">Added At</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-neutral-600 text-xs">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && data?.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center">
                  <p className="text-neutral-500 text-sm">No IOCs match your filters.</p>
                  <p className="text-neutral-700 text-xs mt-1">Try adjusting the search or filters above.</p>
                </td>
              </tr>
            )}
            {!loading && data?.rows.map((ioc) => (
              <tr
                key={ioc.id}
                className="border-b border-neutral-800 last:border-0 hover:bg-neutral-900/50 transition-colors"
              >
                {/* Type badge */}
                <td className="px-3 py-2">
                  <span
                    className={`inline-block font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border ${IOC_TYPE_STYLES[ioc.type]}`}
                  >
                    {ioc.type}
                  </span>
                </td>

                {/* IOC value */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-neutral-200 break-all">{ioc.value}</span>
                    {ioc.caseCount > 1 && (
                      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-medium">
                        {ioc.caseCount} cases
                      </span>
                    )}
                  </div>
                </td>

                {/* Confidence */}
                <td className="px-3 py-2">
                  <span
                    className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${CONFIDENCE_STYLES[ioc.confidenceBucket]}`}
                  >
                    {ioc.confidenceBucket}
                  </span>
                </td>

                {/* Case ID */}
                <td className="px-3 py-2">
                  <Link
                    href={`/cases/${ioc.caseUuid}`}
                    className="font-mono text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {ioc.caseId}
                  </Link>
                </td>

                {/* Case title */}
                <td className="px-3 py-2 hidden lg:table-cell">
                  <span className="text-xs text-neutral-400 truncate max-w-xs block">{ioc.caseTitle}</span>
                </td>

                {/* Added by */}
                <td className="px-3 py-2 hidden xl:table-cell">
                  <span className="text-xs text-neutral-500">{ioc.addedByName}</span>
                </td>

                {/* Added at */}
                <td className="px-3 py-2 hidden xl:table-cell">
                  <span className="font-mono text-xs text-neutral-600">{formatUtc(ioc.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pageCount > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-xs px-3 py-1.5 rounded bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed border border-neutral-700 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-neutral-500">
            Page {data.page} of {data.pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pageCount, p + 1))}
            disabled={page >= data.pageCount}
            className="text-xs px-3 py-1.5 rounded bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed border border-neutral-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
