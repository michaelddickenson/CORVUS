"use client";

import { useState } from "react";

type TabKey = "summary" | "details" | "timeline";

const TAB_LABELS: Record<TabKey, string> = {
  summary:  "Summary",
  details:  "Details",
  timeline: "Timeline",
};

interface Props {
  defaultTab: TabKey;
  children: {
    summary:  React.ReactNode;
    details:  React.ReactNode;
    timeline: React.ReactNode;
  };
}

export function CaseDetailTabs({ defaultTab: _defaultTab, children }: Props) {
  const [active, setActive] = useState<TabKey>("summary");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-neutral-800 mb-4 -mt-0.5">
        {(["summary", "details", "timeline"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active === tab
                ? "border-blue-500 text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {active === "summary"  ? children.summary  :
         active === "details"  ? children.details  :
         children.timeline}
      </div>
    </div>
  );
}
