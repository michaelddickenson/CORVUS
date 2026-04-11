"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Status, IncidentCat } from "@prisma/client";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { CatBadge } from "@/components/ui/CatBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface CaseSearchResult {
  id:         string;
  caseId:     string;
  title:      string;
  cat:        IncidentCat | null;
  status:     Status;
  isRedacted: boolean;
}

interface LinkRow {
  id:        string;
  otherCase: { id: string; caseId: string; title: string; cat: string; status: string };
  note:      string | null;
}

export function CaseLinkSection({ caseId: _caseId, currentCaseUuid, readonly }: { caseId: string; currentCaseUuid: string; readonly?: boolean }) {
  const [links,  setLinks]  = useState<LinkRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [query,        setQuery]        = useState("");
  const [results,      setResults]      = useState<CaseSearchResult[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseSearchResult | null>(null);
  const [note,         setNote]         = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${currentCaseUuid}/links`)
      .then((r) => r.json())
      .then((data) => { setLinks(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [currentCaseUuid]);

  function handleQueryChange(q: string) {
    setQuery(q);
    setSelectedCase(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/cases?search=${encodeURIComponent(q)}&sortBy=caseId&sortDir=desc`);
      const data: CaseSearchResult[] = await res.json();
      const filtered = data.filter((c) => c.id !== currentCaseUuid && !c.isRedacted);
      setResults(filtered.slice(0, 6));
      setShowDropdown(filtered.length > 0);
    }, 250);
  }

  function pickResult(c: CaseSearchResult) {
    setSelectedCase(c);
    setQuery(`${c.caseId} — ${c.title}`);
    setResults([]);
    setShowDropdown(false);
  }

  async function handleLink() {
    if (!selectedCase) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${currentCaseUuid}/links`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ targetCaseId: selectedCase.id, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? "Failed to link cases.");
        return;
      }
      const updated = await fetch(`/api/cases/${currentCaseUuid}/links`).then((r) => r.json());
      setLinks(updated);
      setQuery(""); setSelectedCase(null); setNote("");
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlink(linkId: string) {
    await fetch(`/api/cases/${currentCaseUuid}/links/${linkId}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  return (
    <CollapsibleSection title="Linked Cases" count={loaded ? links.length : null}>
      <div className="space-y-1.5 mb-3 overflow-x-hidden">
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-2 group text-xs min-w-0">
            <Link
              href={`/cases/${link.otherCase.id}`}
              className="font-mono text-blue-400 hover:text-blue-300 hover:underline flex-shrink-0"
            >
              {link.otherCase.caseId}
            </Link>
            <span className="text-neutral-300 truncate flex-1 min-w-0">{link.otherCase.title}</span>
            <CatBadge cat={link.otherCase.cat as IncidentCat} />
            <StatusBadge status={link.otherCase.status as Status} />
            {!readonly && <button
              onClick={() => handleUnlink(link.id)}
              className="flex-shrink-0 text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-colors"
              title="Remove link"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>}
          </div>
        ))}
        {loaded && links.length === 0 && (
          <p className="text-neutral-600 text-xs">No linked cases.</p>
        )}
      </div>

      {!readonly && <div className="space-y-1.5 relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Search by case ID or title..."
          className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {showDropdown && (
          <div className="absolute z-10 w-full bg-neutral-900 border border-neutral-700 rounded shadow-lg max-h-40 overflow-y-auto">
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => pickResult(c)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 text-xs flex gap-2 items-center"
              >
                <span className="font-mono text-blue-400 flex-shrink-0 w-28">{c.caseId}</span>
                <span className="text-neutral-300 truncate flex-1">{c.title}</span>
                {c.cat && <CatBadge cat={c.cat} />}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Link note (optional)..."
            className="flex-1 bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleLink}
            disabled={submitting || !selectedCase}
            className="text-xs px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white transition-colors flex-shrink-0"
          >
            {submitting ? "..." : "Link"}
          </button>
        </div>
        {formError && <p className="text-xs text-red-400">{formError}</p>}
      </div>}
    </CollapsibleSection>
  );
}
