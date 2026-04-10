import { IncidentCat } from "@prisma/client";
import { CAT_SHORT, CAT_STYLE } from "@/lib/catDisplay";

export function CatBadge({ cat }: { cat: IncidentCat }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium font-mono border ${CAT_STYLE[cat]}`}
    >
      {CAT_SHORT[cat]}
    </span>
  );
}
