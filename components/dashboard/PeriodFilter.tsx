"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const PERIODS = [
  { value: "all",    label: "All Time" },
  { value: "today",  label: "Today"    },
  { value: "7d",     label: "7 Days"   },
  { value: "30d",    label: "30 Days"  },
  { value: "90d",    label: "90 Days"  },
  { value: "1y",     label: "1 Year"   },
  { value: "custom", label: "Custom"   },
];

export function PeriodFilter() {
  const router    = useRouter();
  const pathname  = usePathname();
  const searchParams = useSearchParams();

  const period = searchParams.get("period") ?? "90d";
  const from   = searchParams.get("from")   ?? "";
  const to     = searchParams.get("to")     ?? "";

  function applyPeriod(newPeriod: string) {
    const params = new URLSearchParams();
    params.set("period", newPeriod);
    if (newPeriod === "custom") {
      if (from) params.set("from", from);
      if (to)   params.set("to", to);
    }
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  function applyDate(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else        params.delete(key);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => applyPeriod(p.value)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            period === p.value
              ? "bg-neutral-700 text-white"
              : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          {p.label}
        </button>
      ))}

      {period === "custom" && (
        <div className="flex items-center gap-1 ml-1">
          <input
            type="date"
            value={from}
            onChange={(e) => applyDate("from", e.target.value)}
            className="bg-neutral-900 border border-neutral-700 text-neutral-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
          />
          <span className="text-neutral-600 text-xs">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => applyDate("to", e.target.value)}
            className="bg-neutral-900 border border-neutral-700 text-neutral-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
          />
        </div>
      )}
    </div>
  );
}
