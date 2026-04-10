import { IncidentCat, ImpactLevel } from "@prisma/client";

// ---------------------------------------------------------------------------
// Incident category labels
// ---------------------------------------------------------------------------
export const CAT_LABEL: Record<IncidentCat, string> = {
  CAT_1: "CAT 1 — Unauthorized Root/Admin Access",
  CAT_2: "CAT 2 — Unauthorized User-Level Access",
  CAT_3: "CAT 3 — Unsuccessful Activity Attempt",
  CAT_4: "CAT 4 — Denial of Service",
  CAT_5: "CAT 5 — Non-Compliance Activity",
  CAT_6: "CAT 6 — Reconnaissance/Scanning",
  CAT_7: "CAT 7 — Malicious Logic Detected",
  CAT_8: "CAT 8 — Investigating / Undetermined",
  CAT_9: "CAT 9 — Explained Anomaly",
};

export const CAT_SHORT: Record<IncidentCat, string> = {
  CAT_1: "CAT 1",
  CAT_2: "CAT 2",
  CAT_3: "CAT 3",
  CAT_4: "CAT 4",
  CAT_5: "CAT 5",
  CAT_6: "CAT 6",
  CAT_7: "CAT 7",
  CAT_8: "CAT 8",
  CAT_9: "CAT 9",
};

// Badge: bg + text + border classes
export const CAT_STYLE: Record<IncidentCat, string> = {
  CAT_1: "bg-red-950 text-red-400 border-red-800",
  CAT_2: "bg-red-950 text-red-400 border-red-800",
  CAT_3: "bg-neutral-900 text-neutral-400 border-neutral-700",
  CAT_4: "bg-orange-950 text-orange-400 border-orange-800",
  CAT_5: "bg-amber-950 text-amber-400 border-amber-800",
  CAT_6: "bg-neutral-900 text-neutral-400 border-neutral-700",
  CAT_7: "bg-amber-950 text-amber-400 border-amber-800",
  CAT_8: "bg-blue-950 text-blue-400 border-blue-800",
  CAT_9: "bg-neutral-900 text-neutral-400 border-neutral-700",
};

// Dashboard widget styles (border + bg + text for count blocks)
export const CAT_WIDGET_STYLE: Record<IncidentCat, { border: string; bg: string; text: string }> = {
  CAT_1: { border: "border-red-800",     bg: "bg-red-950/50",     text: "text-red-400"     },
  CAT_2: { border: "border-red-800",     bg: "bg-red-950/50",     text: "text-red-400"     },
  CAT_3: { border: "border-neutral-700", bg: "bg-neutral-900",    text: "text-neutral-400" },
  CAT_4: { border: "border-orange-800",  bg: "bg-orange-950/50",  text: "text-orange-400"  },
  CAT_5: { border: "border-amber-800",   bg: "bg-amber-950/50",   text: "text-amber-400"   },
  CAT_6: { border: "border-neutral-700", bg: "bg-neutral-900",    text: "text-neutral-400" },
  CAT_7: { border: "border-amber-800",   bg: "bg-amber-950/50",   text: "text-amber-400"   },
  CAT_8: { border: "border-blue-800",    bg: "bg-blue-950/50",    text: "text-blue-400"    },
  CAT_9: { border: "border-neutral-700", bg: "bg-neutral-900",    text: "text-neutral-400" },
};

// ---------------------------------------------------------------------------
// Impact level styles
// ---------------------------------------------------------------------------
export const IMPACT_STYLE: Record<ImpactLevel, string> = {
  HIGH:   "bg-red-950 text-red-400 border-red-800",
  MEDIUM: "bg-amber-950 text-amber-400 border-amber-800",
  LOW:    "bg-blue-950 text-blue-400 border-blue-800",
};

export const IMPACT_WIDGET_STYLE: Record<ImpactLevel, { border: string; bg: string; text: string }> = {
  HIGH:   { border: "border-red-800",    bg: "bg-red-950/50",    text: "text-red-400"    },
  MEDIUM: { border: "border-amber-800",  bg: "bg-amber-950/50",  text: "text-amber-400"  },
  LOW:    { border: "border-blue-800",   bg: "bg-blue-950/50",   text: "text-blue-400"   },
};

export const ALL_CATS: IncidentCat[] = [
  "CAT_1","CAT_2","CAT_3","CAT_4","CAT_5","CAT_6","CAT_7","CAT_8","CAT_9",
];

export const ALL_IMPACTS: ImpactLevel[] = ["HIGH", "MEDIUM", "LOW"];
