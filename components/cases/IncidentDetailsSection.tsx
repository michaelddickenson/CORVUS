"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AttackVector, MissionImpact } from "@prisma/client";

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------
const ATTACK_VECTOR_LABEL: Record<string, string> = {
  PHISHING:              "Phishing",
  REMOVABLE_MEDIA:       "Removable Media",
  WEB_APPLICATION:       "Web Application",
  SUPPLY_CHAIN:          "Supply Chain",
  INSIDER:               "Insider",
  CREDENTIAL_COMPROMISE: "Credential Compromise",
  PHYSICAL:              "Physical",
  UNKNOWN:               "Unknown",
  OTHER:                 "Other",
};

const MISSION_IMPACT_LABEL: Record<string, string> = {
  NONE:            "None",
  DEGRADED:        "Degraded",
  MISSION_FAILURE: "Mission Failure",
  UNKNOWN:         "Unknown",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface IncidentDetailsSectionProps {
  caseId:             string;
  incidentStartedAt:  string | null;
  incidentEndedAt:    string | null;
  incidentDetectedAt: string | null;
  incidentReportedAt: string | null;
  detectionSource:    string | null;
  attackVector:       AttackVector | null;
  affectedNetwork:    string | null;
  missionImpact:      MissionImpact | null;
  reportingRequired:  boolean;
  externalTicketId:   string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  // Convert ISO to local datetime-local format (YYYY-MM-DDTHH:MM)
  return iso.slice(0, 16);
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  // Append seconds and Z to make it a valid ISO datetime
  return value.length === 16 ? value + ":00.000Z" : value;
}

function formatUtc(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function hasAnyData(props: IncidentDetailsSectionProps): boolean {
  return !!(
    props.incidentStartedAt  ||
    props.incidentEndedAt    ||
    props.incidentDetectedAt ||
    props.incidentReportedAt ||
    props.detectionSource    ||
    props.attackVector       ||
    props.affectedNetwork    ||
    props.missionImpact      ||
    props.reportingRequired  ||
    props.externalTicketId
  );
}

// ---------------------------------------------------------------------------
// ReadRow — single display row in read-only view
// ---------------------------------------------------------------------------
function ReadRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1 border-b border-neutral-800 last:border-0">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-xs text-neutral-300 font-mono">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IncidentDetailsSection
// ---------------------------------------------------------------------------
export function IncidentDetailsSection(props: IncidentDetailsSectionProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(hasAnyData(props));
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Form state
  const [startedAt,   setStartedAt]   = useState(toDatetimeLocal(props.incidentStartedAt));
  const [endedAt,     setEndedAt]     = useState(toDatetimeLocal(props.incidentEndedAt));
  const [detectedAt,  setDetectedAt]  = useState(toDatetimeLocal(props.incidentDetectedAt));
  const [reportedAt,  setReportedAt]  = useState(toDatetimeLocal(props.incidentReportedAt));
  const [detSrc,      setDetSrc]      = useState(props.detectionSource ?? "");
  const [atkVec,      setAtkVec]      = useState<string>(props.attackVector ?? "");
  const [network,     setNetwork]     = useState(props.affectedNetwork ?? "");
  const [misImpact,   setMisImpact]   = useState<string>(props.missionImpact ?? "");
  const [reporting,   setReporting]   = useState(props.reportingRequired);
  const [ticketId,    setTicketId]    = useState(props.externalTicketId ?? "");

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/cases/${props.caseId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentStartedAt:  fromDatetimeLocal(startedAt),
          incidentEndedAt:    fromDatetimeLocal(endedAt),
          incidentDetectedAt: fromDatetimeLocal(detectedAt),
          incidentReportedAt: fromDatetimeLocal(reportedAt),
          detectionSource:    detSrc    || null,
          attackVector:       atkVec    || null,
          affectedNetwork:    network   || null,
          missionImpact:      misImpact || null,
          reportingRequired:  reporting,
          externalTicketId:   ticketId  || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save.");
        return;
      }

      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
  const selectCls =
    "w-full bg-neutral-800 border border-neutral-700 text-neutral-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
  const labelCls = "block text-[10px] text-neutral-500 mb-0.5 uppercase tracking-wide";

  return (
    <div className="border border-neutral-800 rounded mt-2">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50 rounded transition-colors"
      >
        <span className="font-medium text-neutral-300">Incident Details</span>
        <div className="flex items-center gap-2">
          {props.reportingRequired && !editing && (
            <span className="text-[10px] font-medium bg-amber-950 border border-amber-800 text-amber-400 px-1.5 py-0.5 rounded">
              External Reporting Required
            </span>
          )}
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-neutral-800">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Incident Started</label>
                  <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Incident Ended</label>
                  <input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Detected At</label>
                  <input type="datetime-local" value={detectedAt} onChange={(e) => setDetectedAt(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Reported At</label>
                  <input type="datetime-local" value={reportedAt} onChange={(e) => setReportedAt(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Detection Source</label>
                <input
                  type="text"
                  value={detSrc}
                  onChange={(e) => setDetSrc(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. SIEM-Alpha, Endpoint-Detection-Tool"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Attack Vector</label>
                  <select value={atkVec} onChange={(e) => setAtkVec(e.target.value)} className={selectCls}>
                    <option value="">— Not set —</option>
                    {Object.entries(ATTACK_VECTOR_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Mission Impact</label>
                  <select value={misImpact} onChange={(e) => setMisImpact(e.target.value)} className={selectCls}>
                    <option value="">— Not set —</option>
                    {Object.entries(MISSION_IMPACT_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Affected Network</label>
                <input
                  type="text"
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Network-A, Network-B"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>External Ticket ID</label>
                <input
                  type="text"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. INC-12345"
                  className={inputCls}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reportingRequired"
                  checked={reporting}
                  onChange={(e) => setReporting(e.target.checked)}
                  className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="reportingRequired" className="text-xs text-neutral-300">
                  External Reporting Required
                </label>
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setError(null); }}
                  className="text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Cancel
                </button>
                <p className="text-[10px] text-neutral-600 ml-auto">Times are UTC</p>
              </div>
            </form>
          ) : (
            <>
              <dl className="mt-1">
                <ReadRow label="Started"    value={formatUtc(props.incidentStartedAt)} />
                <ReadRow label="Ended"      value={formatUtc(props.incidentEndedAt)} />
                <ReadRow label="Detected"   value={formatUtc(props.incidentDetectedAt)} />
                <ReadRow label="Reported"   value={formatUtc(props.incidentReportedAt)} />
                <ReadRow label="Detection Source"  value={props.detectionSource  ?? "—"} />
                <ReadRow label="Attack Vector"     value={props.attackVector  ? ATTACK_VECTOR_LABEL[props.attackVector]  ?? props.attackVector  : "—"} />
                <ReadRow label="Affected Network"  value={props.affectedNetwork ?? "—"} />
                <ReadRow label="Mission Impact"    value={props.missionImpact ? MISSION_IMPACT_LABEL[props.missionImpact] ?? props.missionImpact : "—"} />
                <ReadRow label="Ext. Ticket ID"    value={props.externalTicketId ?? "—"} />
                <ReadRow
                  label="Ext. Reporting"
                  value={
                    props.reportingRequired ? (
                      <span className="bg-amber-950 border border-amber-800 text-amber-400 px-1.5 py-0.5 rounded text-[10px]">
                        Required
                      </span>
                    ) : "Not required"}
                />
              </dl>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Edit
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
