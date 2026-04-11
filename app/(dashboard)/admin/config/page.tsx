"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ConfigOption {
  id:          string;
  category:    string;
  value:       string;
  label:       string;
  shortLabel:  string;
  color:       string | null;
  sortOrder:   number;
  isActive:    boolean;
  updatedAt:   string;
  updatedBy:   { name: string };
}

type Grouped = Record<string, ConfigOption[]>;

const CATEGORY_TABS = [
  { key: "CAT",      label: "Incident Categories" },
  { key: "TLP",      label: "Classification (TLP)" },
  { key: "STATUS",   label: "Status" },
  { key: "IMPACT",   label: "Impact Level" },
  { key: "INCIDENT_SOURCE", label: "Incident Source" },
  { key: "TEAM",     label: "Teams" },
];

interface EditState {
  label:      string;
  shortLabel: string;
  color:      string;
  sortOrder:  number;
  isActive:   boolean;
}

export default function AdminConfigPage() {
  const router = useRouter();
  const [grouped,  setGrouped]  = useState<Grouped>({});
  const [loading,  setLoading]  = useState(true);
  const [activeTab, setActiveTab] = useState("CAT");
  const [editing,  setEditing]  = useState<Record<string, EditState>>({});
  const [saving,   setSaving]   = useState<Record<string, boolean>>({});
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [newForm,  setNewForm]  = useState({ value: "", label: "", shortLabel: "", color: "", sortOrder: 99 });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((data) => { setGrouped(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function startEdit(opt: ConfigOption) {
    setEditing((prev) => ({
      ...prev,
      [opt.id]: {
        label:      opt.label,
        shortLabel: opt.shortLabel,
        color:      opt.color ?? "",
        sortOrder:  opt.sortOrder,
        isActive:   opt.isActive,
      },
    }));
    setErrors((prev) => { const n = {...prev}; delete n[opt.id]; return n; });
  }

  function cancelEdit(id: string) {
    setEditing((prev) => { const n = {...prev}; delete n[id]; return n; });
  }

  async function saveEdit(opt: ConfigOption) {
    const e = editing[opt.id];
    if (!e) return;
    setSaving((prev) => ({ ...prev, [opt.id]: true }));
    try {
      const res = await fetch(`/api/admin/config/${opt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label:      e.label,
          shortLabel: e.shortLabel,
          color:      e.color || null,
          sortOrder:  e.sortOrder,
          isActive:   e.isActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrors((prev) => ({ ...prev, [opt.id]: data.error ?? "Save failed." }));
        return;
      }
      const updated: ConfigOption = await res.json();
      setGrouped((prev) => ({
        ...prev,
        [opt.category]: (prev[opt.category] ?? []).map((o) => o.id === opt.id ? { ...o, ...updated, updatedBy: opt.updatedBy } : o),
      }));
      cancelEdit(opt.id);
      router.refresh();
    } catch {
      setErrors((prev) => ({ ...prev, [opt.id]: "Network error." }));
    } finally {
      setSaving((prev) => { const n = {...prev}; delete n[opt.id]; return n; });
    }
  }

  async function handleCreate() {
    setCreateError(null);
    if (!newForm.value.trim() || !newForm.label.trim() || !newForm.shortLabel.trim()) {
      setCreateError("Value, label, and short label are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category:   activeTab,
          value:      newForm.value.trim().toUpperCase().replace(/\s+/g, "_"),
          label:      newForm.label.trim(),
          shortLabel: newForm.shortLabel.trim(),
          color:      newForm.color.trim() || null,
          sortOrder:  newForm.sortOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create option.");
        return;
      }
      setGrouped((prev) => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] ?? []), { ...data, updatedBy: { name: "You" } }],
      }));
      setNewForm({ value: "", label: "", shortLabel: "", color: "", sortOrder: 99 });
    } catch {
      setCreateError("Network error.");
    } finally {
      setCreating(false);
    }
  }

  const options = grouped[activeTab] ?? [];

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-neutral-500 text-sm">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">System Configuration</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Manage display labels for case fields. Changes take effect within 60 seconds (cache TTL).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-800">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm rounded-t transition-colors ${
              activeTab === tab.key
                ? "bg-neutral-800 text-white border-b-2 border-blue-500"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-neutral-600">
              ({(grouped[tab.key] ?? []).length})
            </span>
          </button>
        ))}
      </div>

      {/* Options table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Value</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Label</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Short</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider w-20">Sort</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider w-16">Active</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {options.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-600 text-xs">
                  No options configured for this category.
                </td>
              </tr>
            )}
            {options.map((opt) => {
              const isEditing = !!editing[opt.id];
              const e = editing[opt.id];
              const isSaving = saving[opt.id];

              return (
                <tr key={opt.id} className="border-b border-neutral-800/50 last:border-0 hover:bg-neutral-800/20">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-neutral-400">{opt.value}</span>
                  </td>

                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <input
                        value={e.label}
                        onChange={(ev) => setEditing((p) => ({ ...p, [opt.id]: { ...p[opt.id], label: ev.target.value } }))}
                        className="w-full bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-neutral-200 text-xs">{opt.label}</span>
                    )}
                  </td>

                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <input
                        value={e.shortLabel}
                        onChange={(ev) => setEditing((p) => ({ ...p, [opt.id]: { ...p[opt.id], shortLabel: ev.target.value } }))}
                        className="w-24 bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="font-mono text-xs text-neutral-300">{opt.shortLabel}</span>
                    )}
                  </td>

                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <input
                        type="number"
                        value={e.sortOrder}
                        onChange={(ev) => setEditing((p) => ({ ...p, [opt.id]: { ...p[opt.id], sortOrder: parseInt(ev.target.value, 10) || 0 } }))}
                        className="w-16 bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-neutral-500 text-xs tabular-nums">{opt.sortOrder}</span>
                    )}
                  </td>

                  <td className="px-4 py-2.5">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={e.isActive}
                        onChange={(ev) => setEditing((p) => ({ ...p, [opt.id]: { ...p[opt.id], isActive: ev.target.checked } }))}
                        className="accent-blue-500"
                      />
                    ) : (
                      <span className={`text-xs ${opt.isActive ? "text-green-400" : "text-neutral-600"}`}>
                        {opt.isActive ? "Yes" : "No"}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-right">
                    {errors[opt.id] && (
                      <span className="text-red-400 text-xs mr-2">{errors[opt.id]}</span>
                    )}
                    {isEditing ? (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => saveEdit(opt)}
                          disabled={isSaving}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => cancelEdit(opt.id)}
                          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(opt)}
                        className="text-xs text-neutral-400 hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add new option */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-3">Add Custom Option</h3>
        <p className="text-xs text-neutral-600 mb-3">
          Custom options only appear in filters and labels — they do not extend the database enum.
          Use only when your deployment has extended the Prisma schema accordingly.
        </p>
        <div className="grid grid-cols-5 gap-2 mb-3">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Enum Value</label>
            <input
              value={newForm.value}
              onChange={(e) => setNewForm((p) => ({ ...p, value: e.target.value }))}
              placeholder="MY_VALUE"
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-neutral-500 mb-1">Label</label>
            <input
              value={newForm.label}
              onChange={(e) => setNewForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="Full display label"
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Short Label</label>
            <input
              value={newForm.shortLabel}
              onChange={(e) => setNewForm((p) => ({ ...p, shortLabel: e.target.value }))}
              placeholder="SHORT"
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Sort</label>
            <input
              type="number"
              value={newForm.sortOrder}
              onChange={(e) => setNewForm((p) => ({ ...p, sortOrder: parseInt(e.target.value, 10) || 99 }))}
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
            />
          </div>
        </div>
        {createError && (
          <p className="text-red-400 text-xs mb-2">{createError}</p>
        )}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-xs font-medium rounded px-4 py-1.5 transition-colors"
        >
          {creating ? "Adding..." : "Add Option"}
        </button>
      </div>
    </div>
  );
}
