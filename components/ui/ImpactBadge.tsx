import { ImpactLevel } from "@prisma/client";
import { IMPACT_STYLE } from "@/lib/catDisplay";

export function ImpactBadge({ level }: { level: ImpactLevel }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${IMPACT_STYLE[level]}`}
    >
      {level}
    </span>
  );
}
