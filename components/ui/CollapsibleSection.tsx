"use client";

import { useState, useEffect } from "react";

interface Props {
  title: string;
  count: number | null; // null = loading
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, count, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-expand once we know there's data (only on first load)
  useEffect(() => {
    if (count !== null && count > 0) setOpen(true);
  }, [count]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="border-b border-neutral-800 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-2.5 text-left group"
      >
        <span className="text-xs font-medium text-neutral-400 group-hover:text-white transition-colors">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {count !== null && count > 0 && (
            <span className="text-[10px] font-medium bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-neutral-600 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}
