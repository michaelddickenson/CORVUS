"use client";

import { useState, useEffect } from "react";
import { AssetImpact } from "@prisma/client";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

interface AssetRow {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  os: string | null;
  assetType: string | null;
  impact: AssetImpact;
  owner: string | null;
  description: string | null;
  createdAt: string;
}

const IMPACT_STYLE: Record<AssetImpact, string> = {
  CONFIRMED: "text-red-400 bg-red-950 border-red-800",
  SUSPECTED: "text-amber-400 bg-amber-950 border-amber-800",
  CLEARED:   "text-green-400 bg-green-950 border-green-800",
};

export function AssetSection({ caseId, readonly }: { caseId: string; readonly?: boolean }) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [hostname, setHostname]     = useState("");
  const [ipAddress, setIpAddress]   = useState("");
  const [os, setOs]                 = useState("");
  const [assetType, setAssetType]   = useState("");
  const [impact, setImpact]         = useState<AssetImpact>("SUSPECTED");
  const [owner, setOwner]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/assets`)
      .then((r) => r.json())
      .then((data) => { setAssets(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [caseId]);

  async function handleAdd() {
    if (!hostname.trim() && !ipAddress.trim()) {
      setFormError("At least hostname or IP address is required.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: hostname.trim() || undefined,
          ipAddress: ipAddress.trim() || undefined,
          os: os.trim() || undefined,
          assetType: assetType.trim() || undefined,
          impact,
          owner: owner.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        const msgs = d.error?.formErrors ?? d.error?.fieldErrors ? Object.values(d.error.fieldErrors ?? {}).flat() : [];
        setFormError(msgs.join(", ") || d.error || "Failed to add asset.");
        return;
      }
      const asset = await res.json();
      setAssets((prev) => [...prev, asset]);
      setHostname(""); setIpAddress(""); setOs(""); setAssetType(""); setOwner("");
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(assetId: string) {
    await fetch(`/api/cases/${caseId}/assets/${assetId}`, { method: "DELETE" });
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  }

  return (
    <CollapsibleSection title="Assets" count={loaded ? assets.length : null}>
      <div className="space-y-1 mb-3">
        {assets.map((a) => (
          <div key={a.id} className="flex items-center gap-2 group text-xs">
            <div className="flex-1 min-w-0">
              <span className="font-mono text-neutral-200 truncate block">
                {a.hostname ?? a.ipAddress ?? a.macAddress ?? "—"}
              </span>
              <span className="text-neutral-600 text-[10px]">
                {[a.assetType, a.os, a.ipAddress && a.hostname ? a.ipAddress : null]
                  .filter(Boolean).join(" · ")}
              </span>
            </div>
            <span className={`flex-shrink-0 text-[10px] px-1 py-0.5 rounded border font-medium ${IMPACT_STYLE[a.impact]}`}>
              {a.impact}
            </span>
            {!readonly && <button
              onClick={() => handleDelete(a.id)}
              className="flex-shrink-0 text-neutral-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              title="Remove asset"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>}
          </div>
        ))}
        {loaded && assets.length === 0 && (
          <p className="text-neutral-600 text-xs">No assets added.</p>
        )}
      </div>

      {!readonly && <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <input type="text" value={hostname} onChange={(e) => setHostname(e.target.value)}
            placeholder="Hostname" className="bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)}
            placeholder="IP address" className="bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" value={os} onChange={(e) => setOs(e.target.value)}
            placeholder="OS" className="bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" value={assetType} onChange={(e) => setAssetType(e.target.value)}
            placeholder="Type (e.g. Server)" className="bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex gap-1.5">
          <input type="text" value={owner} onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner/team" className="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={impact} onChange={(e) => setImpact(e.target.value as AssetImpact)}
            className="w-28 flex-shrink-0 bg-neutral-900 border border-neutral-700 text-white rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="SUSPECTED">Suspected</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CLEARED">Cleared</option>
          </select>
          <button onClick={handleAdd} disabled={submitting}
            className="text-xs px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white transition-colors flex-shrink-0">
            {submitting ? "..." : "Add"}
          </button>
        </div>
        {formError && <p className="text-xs text-red-400">{formError}</p>}
      </div>}
    </CollapsibleSection>
  );
}
