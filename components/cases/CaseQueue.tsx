"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { IncidentCat, ImpactLevel, Status, Category, TLP, Team } from "@prisma/client";
import { CatBadge } from "@/components/ui/CatBadge";
import { ImpactBadge } from "@/components/ui/ImpactBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TlpBadge } from "@/components/ui/TlpBadge";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { CAT_SHORT, ALL_CATS, ALL_IMPACTS } from "@/lib/catDisplay";
import { TEAM_COLORS, TEAM_LABEL } from "@/lib/teamDisplay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CaseRow {
  id:                    string;
  caseId:                string;
  title:                 string;
  cat:                   IncidentCat | null;
  impactLevel:           ImpactLevel | null;
  status:                Status;
  category:              Category | null;
  tlp:                   TLP;
  classificationCustom:  string | null;
  assignedTo:            { id: string; name: string } | null;
  createdBy:             { id: string; name: string } | null;
  createdAt:             string;
  updatedAt:             string;
  teamStatuses:          { team: Team }[];
}

interface UserOption {
  id:   string;
  name: string;
}

type SortField = "caseId" | "createdAt" | "updatedAt" | "cat" | "status";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CAT_OPTIONS: { value: IncidentCat; label: string }[] = ALL_CATS.map((c) => ({
  value: c,
  label: CAT_SHORT[c],
}));

const IMPACT_OPTIONS: { value: ImpactLevel; label: string }[] = ALL_IMPACTS.map((lvl) => ({
  value: lvl,
  label: lvl.charAt(0) + lvl.slice(1).toLowerCase(),
}));

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "NEW",            label: "New"            },
  { value: "IN_PROGRESS",    label: "In Progress"    },
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "CLOSED",         label: "Closed"         },
];

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "MALWARE",            label: "Malware"            },
  { value: "INTRUSION",          label: "Intrusion"          },
  { value: "PHISHING",           label: "Phishing"           },
  { value: "INSIDER_THREAT",     label: "Insider Threat"     },
  { value: "NONCOMPLIANCE",      label: "Non-Compliance"     },
  { value: "VULNERABILITY",      label: "Vulnerability"      },
  { value: "ANOMALOUS_ACTIVITY", label: "Anomalous Activity" },
  { value: "OTHER",              label: "Other"              },
];

const categoryLabel: Record<Category, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<Category, string>;

function formatUtc(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

// ---------------------------------------------------------------------------
// MultiSelect popover
// ---------------------------------------------------------------------------
function FilterMultiSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (vals: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 bg-neutral-900 border rounded px-2.5 py-1.5 text-sm transition-colors focus:outline-none ${
          open
            ? "border-blue-500 text-white"
            : "border-neutral-700 text-neutral-300 hover:border-neutral-600"
        }`}
      >
        {label}
        {value.length > 0 && (
          <span className="bg-blue-700 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
            {value.length}
          </span>
        )}
        <svg className="w-3 h-3 text-neutral-500 ml-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-neutral-900 border border-neutral-700 rounded shadow-xl z-20 min-w-max">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-neutral-800 cursor-pointer text-sm text-neutral-200 whitespace-nowrap select-none"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...value, opt.value]);
                  else onChange(value.filter((v) => v !== opt.value));
                }}
                className="accent-blue-600 w-3 h-3"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CaseQueue() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const pathname     = usePathname();

  // Initialize from URL
  const [search,      setSearch]      = useState(() => searchParams.get("search")      ?? "");
  const [cats,        setCats]        = useState<IncidentCat[]>(() => searchParams.getAll("cat")    as IncidentCat[]);
  const [impacts,     setImpacts]     = useState<ImpactLevel[]>(() => searchParams.getAll("impact") as ImpactLevel[]);
  const [statuses,    setStatuses]    = useState<Status[]>      (() => searchParams.getAll("status")   as Status[]);
  const [categories,  setCategories]  = useState<Category[]>    (() => searchParams.getAll("category") as Category[]);
  const [assignedTo,  setAssignedTo]  = useState(() => searchParams.get("assignedTo") ?? "");
  const [ttpId,       setTtpId]       = useState(() => searchParams.get("ttpId")       ?? "");
  const [createdFrom, setCreatedFrom] = useState(() => searchParams.get("createdFrom") ?? "");
  const [createdTo,   setCreatedTo]   = useState(() => searchParams.get("createdTo")   ?? "");
  const [sortBy,      setSortBy]      = useState<SortField>(() => (searchParams.get("sortBy") as SortField) ?? "createdAt");
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">(() => (searchParams.get("sortDir") as "asc" | "desc") ?? "desc");

  // Data state
  const [rows,    setRows]    = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [users,   setUsers]   = useState<UserOption[]>([]);

  // Debounce ref for search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch users for assignedTo dropdown
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }, []);

  // Build URL params from current filter state
  function buildParams(overrides?: Partial<{
    search: string; cats: IncidentCat[]; impacts: ImpactLevel[]; statuses: Status[];
    categories: Category[]; assignedTo: string; ttpId: string;
    createdFrom: string; createdTo: string; sortBy: SortField; sortDir: "asc" | "desc";
  }>) {
    const s   = overrides?.search      ?? search;
    const ct  = overrides?.cats        ?? cats;
    const imp = overrides?.impacts     ?? impacts;
    const st  = overrides?.statuses    ?? statuses;
    const ca  = overrides?.categories  ?? categories;
    const at  = overrides?.assignedTo  ?? assignedTo;
    const tp  = overrides?.ttpId       ?? ttpId;
    const cf  = overrides?.createdFrom ?? createdFrom;
    const cto = overrides?.createdTo   ?? createdTo;
    const sb  = overrides?.sortBy      ?? sortBy;
    const sd  = overrides?.sortDir     ?? sortDir;

    const params = new URLSearchParams();
    if (s)   params.set("search", s);
    ct.forEach((v)  => params.append("cat", v));
    imp.forEach((v) => params.append("impact", v));
    st.forEach((v)  => params.append("status", v));
    ca.forEach((v)  => params.append("category", v));
    if (at)  params.set("assignedTo", at);
    if (tp)  params.set("ttpId", tp);
    if (cf)  params.set("createdFrom", cf);
    if (cto) params.set("createdTo", cto);
    params.set("sortBy",  sb);
    params.set("sortDir", sd);
    return params;
  }

  // Sync state to URL + fetch
  const syncAndFetch = useCallback(async (params: URLSearchParams) => {
    router.replace(`${pathname}?${params}`, { scroll: false });
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases?${params}`);
      if (!res.ok) throw new Error("Failed");
      setRows(await res.json());
    } catch {
      setError("Failed to load cases.");
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  // Effect for non-search filters (immediate)
  useEffect(() => {
    const params = buildParams();
    syncAndFetch(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats, impacts, statuses, categories, assignedTo, ttpId, createdFrom, createdTo, sortBy, sortDir]);

  // Effect for search (debounced)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const params = buildParams({ search });
      syncAndFetch(params);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  function SortIndicator({ field }: { field: SortField }) {
    if (sortBy !== field) return <span className="text-neutral-600 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function clearAll() {
    setSearch(""); setCats([]); setImpacts([]); setStatuses([]); setCategories([]);
    setAssignedTo(""); setTtpId(""); setCreatedFrom(""); setCreatedTo("");
  }

  const hasFilters =
    search || cats.length || impacts.length || statuses.length || categories.length ||
    assignedTo || ttpId || createdFrom || createdTo;

  const assignedToName = users.find((u) => u.id === assignedTo)?.name ?? assignedTo;

  const COLS = 9;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* Quick search */}
        <input
          id="case-search"
          type="text"
          placeholder="Search by ID, title, or summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-64"
        />

        <FilterMultiSelect label="CAT"    options={CAT_OPTIONS}      value={cats}       onChange={setCats}       />
        <FilterMultiSelect label="Impact" options={IMPACT_OPTIONS}   value={impacts}    onChange={setImpacts}    />
        <FilterMultiSelect label="Status" options={STATUS_OPTIONS}   value={statuses}   onChange={setStatuses}   />
        <FilterMultiSelect label="Type"   options={CATEGORY_OPTIONS} value={categories} onChange={setCategories} />

        {/* Assigned to */}
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 text-white rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Any assignee</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        {/* Date range */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
            title="Created from"
            className="bg-neutral-900 border border-neutral-700 text-neutral-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
          />
          <span className="text-neutral-600 text-xs">—</span>
          <input
            type="date"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
            title="Created to"
            className="bg-neutral-900 border border-neutral-700 text-neutral-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
          />
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {search && (
            <Chip label={`Search: "${search}"`} onRemove={() => setSearch("")} />
          )}
          {cats.map((c) => (
            <Chip key={c} label={`CAT: ${CAT_SHORT[c]}`} onRemove={() => setCats((prev) => prev.filter((x) => x !== c))} />
          ))}
          {impacts.map((i) => (
            <Chip key={i} label={`Impact: ${i}`} onRemove={() => setImpacts((prev) => prev.filter((x) => x !== i))} />
          ))}
          {statuses.map((s) => (
            <Chip key={s} label={`Status: ${s.replace(/_/g, " ")}`} onRemove={() => setStatuses((prev) => prev.filter((x) => x !== s))} />
          ))}
          {categories.map((c) => (
            <Chip key={c} label={`Type: ${categoryLabel[c]}`} onRemove={() => setCategories((prev) => prev.filter((x) => x !== c))} />
          ))}
          {assignedTo && (
            <Chip label={`Assigned: ${assignedToName}`} onRemove={() => setAssignedTo("")} />
          )}
          {ttpId && (
            <Chip label={`TTP: ${ttpId}`} onRemove={() => setTtpId("")} />
          )}
          {createdFrom && (
            <Chip label={`From: ${createdFrom}`} onRemove={() => setCreatedFrom("")} />
          )}
          {createdTo && (
            <Chip label={`To: ${createdTo}`} onRemove={() => setCreatedTo("")} />
          )}
          <button
            onClick={clearAll}
            className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-neutral-800 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 border-b border-neutral-800">
            <tr>
              <th
                className="text-left px-3 py-2 text-neutral-400 font-medium cursor-pointer hover:text-white select-none w-36 text-xs"
                onClick={() => toggleSort("caseId")}
              >
                Case ID <SortIndicator field="caseId" />
              </th>
              <th className="text-left px-3 py-2 text-neutral-400 font-medium text-xs">Title</th>
              <th
                className="text-left px-3 py-2 text-neutral-400 font-medium cursor-pointer hover:text-white select-none w-20 text-xs"
                onClick={() => toggleSort("cat")}
              >
                CAT <SortIndicator field="cat" />
              </th>
              <th className="text-left px-3 py-2 text-neutral-400 font-medium w-20 text-xs">
                Impact
              </th>
              <th
                className="text-left px-3 py-2 text-neutral-400 font-medium cursor-pointer hover:text-white select-none w-36 text-xs"
                onClick={() => toggleSort("status")}
              >
                Status <SortIndicator field="status" />
              </th>
              <th className="text-left px-3 py-2 text-neutral-400 font-medium w-32 text-xs">
                Active Team
              </th>
              <th className="text-left px-3 py-2 text-neutral-400 font-medium w-32 text-xs">
                Assigned To
              </th>
              <th
                className="text-left px-3 py-2 text-neutral-400 font-medium cursor-pointer hover:text-white select-none w-40 text-xs"
                onClick={() => toggleSort("createdAt")}
              >
                Created <SortIndicator field="createdAt" />
              </th>
              <th
                className="text-left px-3 py-2 text-neutral-400 font-medium cursor-pointer hover:text-white select-none w-40 text-xs"
                onClick={() => toggleSort("updatedAt")}
              >
                Updated <SortIndicator field="updatedAt" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {loading && (
              <>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} cols={COLS} />
                ))}
              </>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={COLS} className="px-3 py-8 text-center text-red-400 text-sm">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={COLS} className="px-3 py-12 text-center text-neutral-500 text-sm">
                  {hasFilters
                    ? "No cases match the current filters."
                    : "No cases have been created yet."}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-neutral-900/50 transition-colors"
                  style={{ height: "44px" }}
                >
                  <td className="px-3 py-0">
                    <Link
                      href={`/cases/${row.id}`}
                      className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      {row.caseId}
                    </Link>
                  </td>
                  <td className="px-3 py-0 max-w-xs">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/cases/${row.id}`}
                        className="text-neutral-200 hover:text-white text-xs truncate max-w-[200px]"
                      >
                        {row.title}
                      </Link>
                      <TlpBadge tlp={row.tlp} custom={row.classificationCustom} />
                    </div>
                  </td>
                  <td className="px-3 py-0">
                    {row.cat ? <CatBadge cat={row.cat} /> : null}
                  </td>
                  <td className="px-3 py-0">
                    {row.impactLevel ? <ImpactBadge level={row.impactLevel} /> : null}
                  </td>
                  <td className="px-3 py-0">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-0">
                    <div className="flex flex-wrap gap-1">
                      {row.teamStatuses.length === 0 ? (
                        <span className="text-neutral-600 text-xs">—</span>
                      ) : (
                        row.teamStatuses.map((ts) => {
                          const tc = TEAM_COLORS[ts.team];
                          return (
                            <span
                              key={ts.team}
                              className={`font-mono text-xs px-1 py-0.5 rounded border ${tc.bg} ${tc.text} ${tc.border}`}
                            >
                              {TEAM_LABEL[ts.team]}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-0 text-neutral-400 text-xs truncate max-w-[128px]">
                    {row.assignedTo?.name ?? (
                      <span className="text-neutral-600">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-0 text-neutral-500 text-xs font-mono whitespace-nowrap">
                    {formatUtc(row.createdAt)}
                  </td>
                  <td className="px-3 py-0 text-neutral-500 text-xs font-mono whitespace-nowrap">
                    {formatUtc(row.updatedAt)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-neutral-800 border border-neutral-700 rounded-full px-2 py-0.5 text-xs text-neutral-300">
      {label}
      <button
        onClick={onRemove}
        className="text-neutral-500 hover:text-white transition-colors leading-none"
        aria-label="Remove filter"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
