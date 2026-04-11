"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { EntryType, Team, Role } from "@prisma/client";
import { getAuthorTeamDisplay, TEAM_COLORS, TEAM_LABEL, TeamDisplay } from "@/lib/teamDisplay";
import { useToast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CaseEntryRow {
  id:        string;
  authorTeam: Team;
  entryType:  EntryType;
  body:       string;
  corrects:   string | null;
  createdAt:  string;
  author: {
    id:   string;
    name: string;
    role: Role;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatUtc(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

const SYSTEM_ENTRY_TYPES: EntryType[] = [
  "STATUS_CHANGE",
  "ESCALATION",
  "RETURNED",
  "ASSIGNMENT",
  "DISPOSITION_SET",
  "FIELD_EDIT",
  "CORRECTION",
  "EVIDENCE_ADDED",
  "IOC_ADDED",
  "TTP_TAGGED",
  "SIGNATURE_CREATED",
];

const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  NOTE:               "Note",
  STATUS_CHANGE:      "Status Change",
  ESCALATION:         "Escalation",
  ASSIGNMENT:         "Assignment",
  DISPOSITION_SET:    "Disposition Set",
  FIELD_EDIT:         "Field Edit",
  CORRECTION:         "Correction",
  EVIDENCE_ADDED:     "Evidence Added",
  IOC_ADDED:          "IOC Added",
  TTP_TAGGED:         "TTP Tagged",
  SIGNATURE_CREATED:  "Signature Created",
  RETURNED:           "Returned to Team",
};

function entryTypeBadgeClass(type: EntryType): string {
  if (type === "NOTE")       return "bg-blue-950 text-blue-400 border border-blue-800";
  if (type === "ESCALATION") return "bg-amber-950 text-amber-400 border border-amber-800";
  if (type === "RETURNED")   return "bg-red-950 text-red-400 border border-red-800";
  return "bg-neutral-800 text-neutral-400 border border-neutral-700";
}

const roleLabel: Record<Role, string> = {
  ADMIN:            "Admin",
  SOC_ANALYST:      "SOC Analyst",
  IR_ANALYST:       "IR Analyst",
  MALWARE_ANALYST:  "Malware Analyst",
  CTI_ANALYST:      "CTI Analyst",
  COUNTERMEASURES:  "Countermeasures",
  TEAM_LEAD:        "Team Lead",
  OBSERVER:         "Observer",
};

// ---------------------------------------------------------------------------
// TeamChip
// ---------------------------------------------------------------------------
function TeamChip({ teamDisplay }: { teamDisplay: TeamDisplay }) {
  const colors = TEAM_COLORS[teamDisplay];
  return (
    <span
      className={`inline-block font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {TEAM_LABEL[teamDisplay]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// NoteCard — full card style for NOTE entries
// ---------------------------------------------------------------------------
function NoteCard({ entry, isNew }: { entry: CaseEntryRow; isNew?: boolean }) {
  const teamDisplay = getAuthorTeamDisplay(entry.authorTeam, entry.author.role);
  const colors      = TEAM_COLORS[teamDisplay];

  return (
    <div
      className={`border border-neutral-800 rounded p-4 border-l-2 ${colors.leftBorder} transition-colors duration-1000 ${
        isNew ? "bg-green-950/30" : "bg-neutral-900"
      }`}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <TeamChip teamDisplay={teamDisplay} />
        <span className="text-neutral-200 text-sm font-medium">{entry.author.name}</span>
        <span className="text-neutral-600 text-xs">{roleLabel[entry.author.role]}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${entryTypeBadgeClass(entry.entryType)}`}
        >
          {ENTRY_TYPE_LABEL[entry.entryType]}
        </span>
        <span className="ml-auto font-mono text-xs text-neutral-600 whitespace-nowrap">
          {formatUtc(entry.createdAt)}
        </span>
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
        {entry.body}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SystemMessage — compact inline style for all non-NOTE entries
// ---------------------------------------------------------------------------
function SystemMessage({ entry, isNew }: { entry: CaseEntryRow; isNew?: boolean }) {
  const teamDisplay = getAuthorTeamDisplay(entry.authorTeam, entry.author.role);

  return (
    <div className={`flex items-start gap-2 py-1 px-1 text-xs text-neutral-500 group rounded transition-colors duration-1000 ${isNew ? "bg-green-950/20" : ""}`}>
      {/* vertical line connector */}
      <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
        <div className={`w-px h-2 ${TEAM_COLORS[teamDisplay].leftBorder.replace("border-l-", "bg-")}`} />
        <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 border border-neutral-600 flex-shrink-0" />
        <div className={`w-px h-2 ${TEAM_COLORS[teamDisplay].leftBorder.replace("border-l-", "bg-")}`} />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <TeamChip teamDisplay={teamDisplay} />
        <span className="text-neutral-400">{entry.author.name}</span>
        <span className="text-neutral-600">·</span>
        <span
          className={`text-[10px] px-1 py-0.5 rounded font-medium ${entryTypeBadgeClass(entry.entryType)}`}
        >
          {ENTRY_TYPE_LABEL[entry.entryType]}
        </span>
        <span className="text-neutral-400 truncate">{entry.body}</span>
        <span className="ml-auto font-mono text-neutral-600 whitespace-nowrap flex-shrink-0">
          {formatUtc(entry.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoteForm
// ---------------------------------------------------------------------------
function NoteForm({
  caseId,
  onSubmit,
}: {
  caseId:   string;
  onSubmit: (entry: CaseEntryRow) => void;
}) {
  const toast = useToast();
  const [body,    setBody]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/cases/${caseId}/entries`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body: body.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.formErrors?.join(", ") ?? "Failed to add note.");
        return;
      }

      const newEntry: CaseEntryRow = await res.json();
      setBody("");
      onSubmit(newEntry);
      toast.success("Note added.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note..."
        rows={3}
        className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded px-4 py-1.5 transition-colors flex items-center gap-1.5"
        >
          {loading && (
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? "Adding..." : "Add Note"}
        </button>
        <p className="text-xs text-neutral-600">
          Notes are immutable once submitted.
        </p>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// CaseTimeline — main export
// ---------------------------------------------------------------------------
interface Props {
  caseId:         string;  // UUID
  initialEntries: CaseEntryRow[];
  canWrite?:      boolean;
}

export function CaseTimeline({ caseId, initialEntries, canWrite = true }: Props) {
  const [entries,    setEntries]    = useState<CaseEntryRow[]>(initialEntries);
  const [newEntryId, setNewEntryId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(initialEntries.length);

  // Scroll to bottom only when a NEW entry is added (not on initial mount)
  useEffect(() => {
    if (entries.length > prevLengthRef.current) {
      prevLengthRef.current = entries.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries]);

  function handleNewEntry(entry: CaseEntryRow) {
    setEntries((prev) => [...prev, entry]);
    setNewEntryId(entry.id);
    setTimeout(() => setNewEntryId(null), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Timeline entries */}
      {entries.length === 0 ? (
        <div className="border border-neutral-800 rounded bg-neutral-900 px-6 py-10 text-center">
          <p className="text-neutral-500 text-sm">No entries yet.</p>
          <p className="text-neutral-700 text-xs mt-1">Add a note below to start the timeline.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) =>
            SYSTEM_ENTRY_TYPES.includes(entry.entryType) ? (
              <SystemMessage key={entry.id} entry={entry} isNew={entry.id === newEntryId} />
            ) : (
              <NoteCard key={entry.id} entry={entry} isNew={entry.id === newEntryId} />
            )
          )}
          {/* Auto-scroll target */}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Note form — hidden for readonly/observer */}
      {canWrite && (
        <div className="border-t border-neutral-800 pt-4">
          <NoteForm caseId={caseId} onSubmit={handleNewEntry} />
        </div>
      )}
    </div>
  );
}
