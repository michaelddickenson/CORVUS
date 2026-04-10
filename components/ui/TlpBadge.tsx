import { TLP } from "@prisma/client";

const tlpStyles: Record<TLP, string> = {
  WHITE: "bg-neutral-800 text-neutral-200 border border-neutral-600",
  GREEN: "bg-green-950 text-green-400 border border-green-800",
  AMBER: "bg-amber-950 text-amber-400 border border-amber-800",
  RED:   "bg-red-950 text-red-400 border border-red-800",
};

const TLP_LABELS: Record<TLP, string> = {
  WHITE: "White",
  GREEN: "Green",
  AMBER: "Amber",
  RED:   "Red",
};

export function TlpBadge({ tlp, custom }: { tlp: TLP; custom?: string | null }) {
  const label = custom?.trim() || TLP_LABELS[tlp];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${tlpStyles[tlp]}`}
    >
      {label}
    </span>
  );
}
