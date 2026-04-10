"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IncidentCat, ImpactLevel, Category, TLP } from "@prisma/client";
import { CAT_LABEL, ALL_CATS, ALL_IMPACTS } from "@/lib/catDisplay";
import { useToast } from "@/components/ui/Toast";

interface User {
  id:    string;
  name:  string;
  email: string;
  role:  string;
  team:  string | null;
}

const categoryOptions: { value: Category; label: string }[] = [
  { value: "MALWARE",            label: "Malware"            },
  { value: "INTRUSION",          label: "Intrusion"          },
  { value: "PHISHING",           label: "Phishing"           },
  { value: "INSIDER_THREAT",     label: "Insider Threat"     },
  { value: "NONCOMPLIANCE",      label: "Non-Compliance"     },
  { value: "VULNERABILITY",      label: "Vulnerability"      },
  { value: "ANOMALOUS_ACTIVITY", label: "Anomalous Activity" },
  { value: "OTHER",              label: "Other"              },
];

const tlpOptions: { value: TLP; label: string }[] = [
  { value: "WHITE", label: "White" },
  { value: "GREEN", label: "Green" },
  { value: "AMBER", label: "Amber" },
  { value: "RED",   label: "Red"   },
];

const impactLabels: Record<ImpactLevel, string> = {
  HIGH:   "High",
  MEDIUM: "Medium",
  LOW:    "Low",
};

export function NewCaseForm() {
  const router = useRouter();
  const toast  = useToast();

  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [form, setForm] = useState({
    title:        "",
    description:  "",
    cat:          "CAT_8"  as IncidentCat,
    impactLevel:  "LOW"    as ImpactLevel,
    category:     "OTHER"  as Category,
    tlp:          "GREEN"  as TLP,
    assignedToId: ""       as string,
  });
  const [classificationCustom, setClassificationCustom] = useState("");
  const [useCustomClassification, setUseCustomClassification] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
  }, []);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/cases", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          classificationCustom: useCustomClassification ? (classificationCustom.trim() || null) : null,
          assignedToId:         form.assignedToId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.formErrors?.join(", ") ?? "Failed to create case.");
        return;
      }

      const created = await res.json();
      toast.success("Case created.");
      router.push(`/cases/${created.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {/* Title */}
      <div>
        <label className="block text-sm text-neutral-300 mb-1.5">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          required
          minLength={3}
          maxLength={200}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Brief description of the incident"
          className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm text-neutral-300 mb-1.5">
          Summary <span className="text-red-400">*</span>
        </label>
        <textarea
          required
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Detailed summary of the incident, initial findings, and context."
          className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-y"
        />
      </div>

      {/* Incident Category */}
      <div>
        <label className="block text-sm text-neutral-300 mb-1.5">
          Incident Category <span className="text-red-400">*</span>
        </label>
        <select
          required
          value={form.cat}
          onChange={(e) => set("cat", e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          {ALL_CATS.map((c) => (
            <option key={c} value={c}>
              {CAT_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {/* Impact Level + Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">
            Impact Level <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={form.impactLevel}
            onChange={(e) => set("impactLevel", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {ALL_IMPACTS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {impactLabels[lvl]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">
            Incident Type <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Classification + Assignee */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">Classification</label>
          <select
            value={useCustomClassification ? "__CUSTOM__" : form.tlp}
            onChange={(e) => {
              if (e.target.value === "__CUSTOM__") {
                setUseCustomClassification(true);
              } else {
                setUseCustomClassification(false);
                set("tlp", e.target.value);
              }
            }}
            className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {tlpOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
            <option value="__CUSTOM__">Custom...</option>
          </select>
          {useCustomClassification && (
            <input
              type="text"
              maxLength={200}
              placeholder="Custom classification label"
              value={classificationCustom}
              onChange={(e) => setClassificationCustom(e.target.value)}
              className="mt-1.5 w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          )}
        </div>

        <div>
          <label className="block text-sm text-neutral-300 mb-1.5">
            Initial Assignee (optional)
          </label>
          <select
            value={form.assignedToId}
            onChange={(e) => set("assignedToId", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.team ? `(${u.team})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-700 rounded px-3 py-2">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded px-5 py-2 text-sm transition-colors flex items-center gap-2"
        >
          {loading && (
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? "Creating..." : "Create Case"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-neutral-400 hover:text-white text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
