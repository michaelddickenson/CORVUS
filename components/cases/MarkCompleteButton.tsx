"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  caseId: string;
}

export function MarkCompleteButton({ caseId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState(false);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/complete-team`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to mark complete.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <p className="text-xs text-green-400">Marked complete.</p>;
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "..." : "Mark Work Complete"}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
