"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function KeyboardHandler() {
  const router = useRouter();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable;

      if (e.key === "?" && !isEditable) {
        e.preventDefault();
        setShowShortcuts((o) => !o);
        return;
      }

      if (e.key === "Escape") {
        setShowShortcuts(false);
        return;
      }

      if (isEditable) return;

      if (e.key === "n" || e.key === "N") {
        router.push("/cases/new");
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Search"]'
        );
        el?.focus();
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router]);

  if (!showShortcuts) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[300] bg-black/60"
        onClick={() => setShowShortcuts(false)}
      />
      <div className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-full max-w-sm pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <span className="text-white text-sm font-medium">Keyboard Shortcuts</span>
            <button
              onClick={() => setShowShortcuts(false)}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-4 py-4 space-y-3">
            {[
              { key: "N", label: "New case" },
              { key: "/", label: "Focus search" },
              { key: "?", label: "Toggle this panel" },
              { key: "Esc", label: "Close panel" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-neutral-400 text-sm">{label}</span>
                <kbd className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-mono px-2 py-0.5 rounded">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
