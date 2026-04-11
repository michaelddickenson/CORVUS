"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { IocType, TLP } from "@prisma/client";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { TlpBadge } from "@/components/ui/TlpBadge";

interface IocRow {
  id: string;
  type: IocType;
  value: string;
  description: string | null;
  confidence: number;
  tlp: TLP;
  createdAt: string;
}

interface CollisionCase {
  id: string;
  caseId: string;
  title: string;
}

const IOC_TYPES: IocType[] = [
  "IP","DOMAIN","URL","MD5","SHA1","SHA256","EMAIL",
  "FILE_PATH","REGISTRY_KEY","YARA_RULE","OTHER",
];

function confidenceLabel(n: number): { label: string; cls: string } {
  if (n >= 67) return { label: "HIGH",   cls: "text-green-400 bg-green-950 border-green-800" };
  if (n >= 34) return { label: "MED",    cls: "text-amber-400 bg-amber-950 border-amber-800" };
  return         { label: "LOW",   cls: "text-neutral-400 bg-neutral-800 border-neutral-700" };
}

export function IocSection({ caseId, readonly }: { caseId: string; readonly?: boolean }) {
  const [iocs, setIocs] = useState<IocRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [collisions, setCollisions] = useState<CollisionCase[]>([]);

  // Form state
  const [type, setType] = useState<IocType>("IP");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [confidence, setConfidence] = useState<50 | 25 | 75>(50);
  const [tlp, setTlp] = useState<TLP>("GREEN");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/iocs`)
      .then((r) => r.json())
      .then((data) => { setIocs(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [caseId]);

  async function handleAdd() {
    if (!value.trim()) return;
    setFormError(null);
    setSubmitting(true);
    setCollisions([]);
    try {
      const res = await fetch(`/api/cases/${caseId}/iocs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value: value.trim(), description: description.trim() || undefined, confidence, tlp }),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error?.formErrors?.join(", ") ?? "Failed to add IOC.");
        return;
      }
      const { ioc, collisions: c } = await res.json();
      setIocs((prev) => [...prev, ioc]);
      setCollisions(c);
      setValue("");
      setDescription("");
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(iocId: string) {
    await fetch(`/api/cases/${caseId}/iocs/${iocId}`, { method: "DELETE" });
    setIocs((prev) => prev.filter((i) => i.id !== iocId));
  }

  return (
    <CollapsibleSection title="IOCs" count={loaded ? iocs.length : null}>
      {/* Collision banner */}
      {collisions.length > 0 && (
        <div className="mb-2 bg-amber-950 border border-amber-700 rounded px-2.5 py-2 text-xs text-amber-300">
          This IOC appeared in {collisions.length} other case{collisions.length > 1 ? "s" : ""}:{" "}
          {collisions.map((col, i) => (
            <span key={col.id}>
              {i > 0 && ", "}
              <Link href={`/cases/${col.id}`} className="underline hover:text-amber-200 font-mono">
                {col.caseId}
              </Link>
            </span>
          ))}
        </div>
      )}

      {/* IOC list */}
      <div className="space-y-1 mb-3">
        {iocs.map((ioc) => {
          const conf = confidenceLabel(ioc.confidence);
          return (
            <div key={ioc.id} className="flex items-start gap-1.5 group text-xs">
              <span className="font-mono text-neutral-500 flex-shrink-0 text-[10px] mt-0.5 bg-neutral-800 px-1 rounded">
                {ioc.type}
              </span>
              <span className="font-mono text-neutral-200 break-all flex-1">{ioc.value}</span>
              <span className={`flex-shrink-0 text-[10px] px-1 py-0.5 rounded border font-medium ${conf.cls}`}>
                {conf.label}
              </span>
              <TlpBadge tlp={ioc.tlp} />
              {!readonly && <button
                onClick={() => handleDelete(ioc.id)}
                className="flex-shrink-0 text-neutral-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-1"
                title="Remove IOC"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>}
            </div>
          );
        })}
        {loaded && iocs.length === 0 && (
          <p className="text-neutral-600 text-xs">No IOCs added.</p>
        )}
      </div>

      {/* Add form — hidden for readonly/observer */}
      {!readonly && <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IocType)}
            className="bg-neutral-900 border border-neutral-700 text-white rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
          >
            {IOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Value..."
            className="flex-1 bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
          />
        </div>
        <div className="flex gap-1.5">
          <select
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value) as 25 | 50 | 75)}
            className="bg-neutral-900 border border-neutral-700 text-white rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={75}>HIGH confidence</option>
            <option value={50}>MED confidence</option>
            <option value={25}>LOW confidence</option>
          </select>
          <select
            value={tlp}
            onChange={(e) => setTlp(e.target.value as TLP)}
            className="bg-neutral-900 border border-neutral-700 text-white rounded px-1.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {([["WHITE","White"],["GREEN","Green"],["AMBER","Amber"],["RED","Red"]] as [TLP,string][]).map(([t,l]) => <option key={t} value={t}>{l}</option>)}
          </select>
          <button
            onClick={handleAdd}
            disabled={submitting || !value.trim()}
            className="ml-auto text-xs px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white transition-colors"
          >
            {submitting ? "..." : "Add"}
          </button>
        </div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes (optional)..."
          className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {formError && <p className="text-xs text-red-400">{formError}</p>}
      </div>}
    </CollapsibleSection>
  );
}
