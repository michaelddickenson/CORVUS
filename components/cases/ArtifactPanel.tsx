"use client";

import { useState, useEffect, useRef } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ArtifactRow {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  description: string | null;
  createdAt: string;
  uploadedBy: { name: string; team: string | null; role: string | null };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUtc(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

// ---------------------------------------------------------------------------
// MIME type icons (inline SVG, no emoji)
// ---------------------------------------------------------------------------
function IconImage({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function IconDocument({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconArchive({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function IconCode({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function IconBinary({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
    </svg>
  );
}

function IconDownload({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.375" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function MimeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <IconImage className={className} />;
  if (mimeType === "application/pdf") return <IconDocument className={className} />;
  if (mimeType.includes("zip")) return <IconArchive className={className} />;
  if (
    mimeType.includes("json") ||
    mimeType.includes("csv") ||
    mimeType === "text/plain"
  )
    return <IconCode className={className} />;
  // pcap, yar, octet-stream, etc.
  return <IconBinary className={className} />;
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard button
// ---------------------------------------------------------------------------
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable (non-HTTPS context)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy full SHA256"
      className="text-neutral-600 hover:text-neutral-300 transition-colors flex-shrink-0"
    >
      {copied ? (
        <IconCheck className="w-3 h-3 text-green-400" />
      ) : (
        <IconCopy className="w-3 h-3" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export function ArtifactPanel({
  caseId,
  canDelete,
  readonly,
}: {
  caseId: string;
  canDelete: boolean;
  readonly?: boolean;
}) {
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/artifacts`)
      .then((r) => r.json())
      .then((data) => {
        setArtifacts(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [caseId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormError(null);
    setFile(e.target.files?.[0] ?? null);
  }

  function handleUpload() {
    if (!file) return;
    setFormError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    if (description.trim()) formData.append("description", description.trim());

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/cases/${caseId}/artifacts`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        const artifact = JSON.parse(xhr.responseText) as ArtifactRow;
        setArtifacts((prev) => [...prev, artifact]);
        setFile(null);
        setDescription("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          setFormError(err.error ?? "Upload failed.");
        } catch {
          setFormError("Upload failed.");
        }
      }
    };

    xhr.onerror = () => {
      setProgress(null);
      setFormError("Network error.");
    };

    xhr.send(formData);
  }

  async function handleDelete(artifactId: string) {
    const res = await fetch(`/api/cases/${caseId}/artifacts/${artifactId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setArtifacts((prev) => prev.filter((a) => a.id !== artifactId));
    }
  }

  return (
    <CollapsibleSection title="Artifacts" count={loaded ? artifacts.length : null}>
      {/* Artifact list */}
      <div className="space-y-2 mb-3">
        {artifacts.map((a) => (
          <div key={a.id} className="border border-neutral-800 rounded p-2 group text-xs">
            {/* Row 1: icon + filename + size */}
            <div className="flex items-center gap-1.5 mb-1">
              <MimeIcon mimeType={a.mimeType} className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
              <span className="font-mono text-neutral-200 truncate flex-1">{a.filename}</span>
              <span className="text-neutral-600 flex-shrink-0">{formatBytes(a.sizeBytes)}</span>
            </div>

            {/* Row 2: SHA256 + copy */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-mono text-[10px] text-neutral-500 tracking-tight">
                SHA256:
              </span>
              <span className="font-mono text-[10px] text-neutral-400">
                {a.sha256.slice(0, 16)}…
              </span>
              <CopyButton text={a.sha256} />
            </div>

            {/* Row 3: uploader + timestamp */}
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-600">
              <span>{a.uploadedBy.name}</span>
              {a.uploadedBy.team && (
                <>
                  <span>·</span>
                  <span className="font-mono">{a.uploadedBy.team}</span>
                </>
              )}
              <span>·</span>
              <span className="font-mono">{formatUtc(a.createdAt)}</span>
            </div>

            {/* Row 4: description (if present) */}
            {a.description && (
              <p className="text-neutral-500 text-[10px] mt-1 leading-relaxed">{a.description}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <a
                href={`/api/artifacts/${a.id}/download`}
                download={a.filename}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <IconDownload className="w-3 h-3" />
                <span>Download</span>
              </a>
              {canDelete && (
                <button
                  onClick={() => handleDelete(a.id)}
                  className="flex items-center gap-1 text-neutral-600 hover:text-red-400 transition-colors ml-auto"
                >
                  <IconTrash className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        ))}
        {loaded && artifacts.length === 0 && (
          <p className="text-neutral-600 text-xs">No artifacts attached.</p>
        )}
      </div>

      {/* Upload form — hidden for readonly/observer */}
      {!readonly && <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <label className="flex-1 cursor-pointer">
            <div className="bg-neutral-900 border border-neutral-700 hover:border-neutral-600 rounded px-2 py-1 text-xs text-neutral-400 transition-colors truncate">
              {file ? file.name : "Choose file…"}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.txt,.log,.pcap,.zip,.png,.jpg,.jpeg,.json,.csv,.yar"
              className="sr-only"
            />
          </label>
          <button
            onClick={handleUpload}
            disabled={!file || progress !== null}
            className="text-xs px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white transition-colors flex-shrink-0"
          >
            {progress !== null ? `${progress}%` : "Upload"}
          </button>
        </div>

        {/* Progress bar */}
        {progress !== null && (
          <div className="w-full bg-neutral-800 rounded-full h-1">
            <div
              className="bg-blue-600 h-1 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {formError && (
          <div className="flex items-center gap-1 text-red-400 text-xs">
            <IconX className="w-3 h-3 flex-shrink-0" />
            {formError}
          </div>
        )}
      </div>}
    </CollapsibleSection>
  );
}
