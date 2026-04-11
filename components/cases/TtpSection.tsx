"use client";

import { useState, useEffect, useRef } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { MitreTechnique } from "@/lib/mitre/attack";

interface TtpRow {
  id: string;
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  description: string | null;
  createdAt: string;
}

export function TtpSection({ caseId, readonly }: { caseId: string; readonly?: boolean }) {
  const [ttps, setTtps] = useState<TtpRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Typeahead state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MitreTechnique[]>([]);
  const [selected, setSelected] = useState<MitreTechnique | null>(null);
  const [notes, setNotes] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/ttps`)
      .then((r) => r.json())
      .then((data) => { setTtps(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [caseId]);

  function handleQueryChange(q: string) {
    setQuery(q);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/mitre?q=${encodeURIComponent(q)}`);
      const data: MitreTechnique[] = await res.json();
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    }, 200);
  }

  function pickSuggestion(t: MitreTechnique) {
    setSelected(t);
    setQuery(`${t.id} — ${t.name}`);
    setSuggestions([]);
    setShowDropdown(false);
  }

  async function handleAdd() {
    if (!selected) { setFormError("Select a technique from the typeahead."); return; }
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/ttps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          techniqueId:   selected.id,
          techniqueName: selected.name,
          tactic:        selected.tactic,
          description:   notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error?.formErrors?.join(", ") ?? "Failed to add TTP.");
        return;
      }
      const ttp = await res.json();
      setTtps((prev) => [...prev, ttp]);
      setQuery(""); setSelected(null); setNotes("");
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(ttpId: string) {
    await fetch(`/api/cases/${caseId}/ttps/${ttpId}`, { method: "DELETE" });
    setTtps((prev) => prev.filter((t) => t.id !== ttpId));
  }

  return (
    <CollapsibleSection title="TTPs" count={loaded ? ttps.length : null}>
      <div className="space-y-1 mb-3">
        {ttps.map((t) => (
          <div key={t.id} className="flex items-start gap-1.5 group text-xs">
            <span className="font-mono text-blue-400 flex-shrink-0">{t.techniqueId}</span>
            <div className="flex-1 min-w-0">
              <span className="text-neutral-300 truncate block">{t.techniqueName}</span>
              <span className="text-neutral-600 text-[10px]">{t.tactic}</span>
            </div>
            {!readonly && <button
              onClick={() => handleDelete(t.id)}
              className="flex-shrink-0 text-neutral-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
              title="Remove TTP"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>}
          </div>
        ))}
        {loaded && ttps.length === 0 && (
          <p className="text-neutral-600 text-xs">No TTPs tagged.</p>
        )}
      </div>

      {!readonly && <div className="space-y-1.5 relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Search technique ID or name..."
          className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {showDropdown && (
          <div className="absolute z-10 w-full bg-neutral-900 border border-neutral-700 rounded shadow-lg max-h-40 overflow-y-auto">
            {suggestions.map((t) => (
              <button
                key={`${t.id}-${t.tactic}`}
                type="button"
                onMouseDown={() => pickSuggestion(t)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-neutral-800 text-xs flex gap-2"
              >
                <span className="font-mono text-blue-400 flex-shrink-0 w-20">{t.id}</span>
                <span className="text-neutral-300 truncate">{t.name}</span>
                <span className="text-neutral-600 flex-shrink-0 ml-auto">{t.tactic}</span>
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Analyst notes (optional)..."
          className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={submitting || !selected}
          className="text-xs px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white transition-colors"
        >
          {submitting ? "..." : "Tag TTP"}
        </button>
        {formError && <p className="text-xs text-red-400 mt-1">{formError}</p>}
      </div>}
    </CollapsibleSection>
  );
}
