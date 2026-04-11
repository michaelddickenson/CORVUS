"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IncidentCat, ImpactLevel, IncidentSource, TLP } from "@prisma/client";
import { CAT_LABEL, ALL_CATS, ALL_IMPACTS } from "@/lib/catDisplay";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const INCIDENT_SOURCE_OPTIONS: { value: IncidentSource; label: string }[] = [
  { value: "EXTERNAL_THREAT", label: "External Threat"            },
  { value: "INSIDER_THREAT",  label: "Insider Threat"             },
  { value: "THIRD_PARTY",     label: "Third Party / Supply Chain" },
  { value: "UNKNOWN",         label: "Unknown"                    },
  { value: "OTHER",           label: "Other..."                   },
];

const TLP_OPTIONS: { value: TLP; label: string }[] = [
  { value: "WHITE", label: "White" },
  { value: "GREEN", label: "Green" },
  { value: "AMBER", label: "Amber" },
  { value: "RED",   label: "Red"   },
];

const IMPACT_LABELS: Record<ImpactLevel, string> = {
  HIGH:   "High",
  MEDIUM: "Medium",
  LOW:    "Low",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  caseUuid:             string;
  title:                string;
  description:          string;
  cat:                  IncidentCat;
  impactLevel:          ImpactLevel;
  incidentSource:       IncidentSource;
  incidentSourceCustom: string | null;
  tlp:                  TLP;
  classificationCustom: string | null;
}

// ---------------------------------------------------------------------------
// CaseEditControl
// Renders a compact button (styled like Export) that opens a modal overlay.
// ---------------------------------------------------------------------------
export function CaseEditControl({
  caseUuid,
  title,
  description,
  cat,
  impactLevel,
  incidentSource,
  incidentSourceCustom,
  tlp,
  classificationCustom,
}: Props) {
  const router = useRouter();
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // Form state
  const [formTitle,        setFormTitle]        = useState(title);
  const [formDesc,         setFormDesc]         = useState(description);
  const [formCat,          setFormCat]          = useState<IncidentCat>(cat);
  const [formImpact,       setFormImpact]       = useState<ImpactLevel>(impactLevel);
  const [formSource,       setFormSource]       = useState<IncidentSource>(incidentSource);
  const [formSourceCustom, setFormSourceCustom] = useState(incidentSourceCustom ?? "");
  const [formTlp,          setFormTlp]          = useState<TLP>(tlp);
  const [useCustom,        setUseCustom]        = useState(!!classificationCustom);
  const [formCustom,       setFormCustom]       = useState(classificationCustom ?? "");

  // Lock body scroll while modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function openModal() {
    // Reset form to current prop values
    setFormTitle(title);
    setFormDesc(description);
    setFormCat(cat);
    setFormImpact(impactLevel);
    setFormSource(incidentSource);
    setFormSourceCustom(incidentSourceCustom ?? "");
    setFormTlp(tlp);
    setUseCustom(!!classificationCustom);
    setFormCustom(classificationCustom ?? "");
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setError(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/cases/${caseUuid}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:                formTitle.trim(),
          description:          formDesc.trim(),
          cat:                  formCat,
          impactLevel:          formImpact,
          incidentSource:       formSource,
          incidentSourceCustom: formSource === "OTHER" ? (formSourceCustom.trim() || null) : null,
          tlp:                  formTlp,
          classificationCustom: useCustom ? (formCustom.trim() || null) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save.");
        return;
      }

      closeModal();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-600 " +
    "rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
  const selectCls =
    "w-full bg-neutral-800 border border-neutral-700 text-neutral-200 rounded px-3 py-2 text-sm " +
    "focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500";
  const labelCls = "block text-sm text-neutral-300 mb-1.5";

  return (
    <>
      {/* Trigger button — styled like Export */}
      <button
        type="button"
        onClick={openModal}
        className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border border-neutral-700 rounded transition-colors"
      >
        Edit
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={closeModal}
          />

          {/* Modal dialog */}
          <form
            onSubmit={handleSave}
            className="relative z-10 w-full max-w-xl bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
              <h2 className="text-base font-semibold text-white">Edit Case</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Title */}
              <div>
                <label className={labelCls}>
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  maxLength={200}
                  required
                  className={inputCls}
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>
                  Summary <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={4}
                  maxLength={10000}
                  required
                  className={`${inputCls} resize-y`}
                />
              </div>

              {/* Incident Category */}
              <div>
                <label className={labelCls}>Incident Category</label>
                <select
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value as IncidentCat)}
                  className={selectCls}
                >
                  {ALL_CATS.map((c) => (
                    <option key={c} value={c}>{CAT_LABEL[c]}</option>
                  ))}
                </select>
              </div>

              {/* Impact Level + Incident Source */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Impact Level</label>
                  <select
                    value={formImpact}
                    onChange={(e) => setFormImpact(e.target.value as ImpactLevel)}
                    className={selectCls}
                  >
                    {ALL_IMPACTS.map((lvl) => (
                      <option key={lvl} value={lvl}>{IMPACT_LABELS[lvl]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Incident Source</label>
                  <select
                    value={formSource}
                    onChange={(e) => {
                      setFormSource(e.target.value as IncidentSource);
                      if (e.target.value !== "OTHER") setFormSourceCustom("");
                    }}
                    className={selectCls}
                  >
                    {INCIDENT_SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {formSource === "OTHER" && (
                    <input
                      type="text"
                      value={formSourceCustom}
                      onChange={(e) => setFormSourceCustom(e.target.value)}
                      maxLength={200}
                      placeholder="Describe the incident source"
                      className={`${inputCls} mt-2`}
                    />
                  )}
                </div>
              </div>

              {/* Classification — TLP dropdown + Other... */}
              <div>
                <label className={labelCls}>Classification</label>
                <select
                  value={useCustom ? "__CUSTOM__" : formTlp}
                  onChange={(e) => {
                    if (e.target.value === "__CUSTOM__") {
                      setUseCustom(true);
                    } else {
                      setUseCustom(false);
                      setFormCustom("");
                      setFormTlp(e.target.value as TLP);
                    }
                  }}
                  className={selectCls}
                >
                  {TLP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                  <option value="__CUSTOM__">Other...</option>
                </select>
                {useCustom && (
                  <input
                    type="text"
                    value={formCustom}
                    onChange={(e) => setFormCustom(e.target.value)}
                    maxLength={200}
                    placeholder="Custom classification label"
                    className={`${inputCls} mt-2`}
                  />
                )}
              </div>

              {error && (
                <div className="bg-red-950 border border-red-700 rounded px-3 py-2">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-neutral-800 flex items-center gap-3 flex-shrink-0">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded px-5 py-2 text-sm transition-colors flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="text-neutral-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
