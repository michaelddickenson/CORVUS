"use client";

import { useState } from "react";

type TabKey = "summary" | "timeline";

interface Props {
  defaultTab: TabKey;
  children: {
    summary:  React.ReactNode;
    timeline: React.ReactNode;
  };
}

export function CaseDetailTabs({ defaultTab, children }: Props) {
  const [active, setActive] = useState<TabKey>(defaultTab);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-neutral-800 mb-4 -mt-0.5">
        {(["summary", "timeline"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize ${
              active === tab
                ? "border-blue-500 text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab === "summary" ? "Summary" : "Timeline"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {active === "summary"  ? children.summary  : children.timeline}
      </div>
    </div>
  );
}
