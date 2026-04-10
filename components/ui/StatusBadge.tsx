import { Status } from "@prisma/client";

const statusStyles: Record<Status, string> = {
  NEW:            "bg-neutral-800 text-neutral-300 border border-neutral-700",
  IN_PROGRESS:    "bg-amber-950 text-amber-400 border border-amber-800",
  PENDING_REVIEW: "bg-orange-950 text-orange-400 border border-orange-800",
  CLOSED:         "bg-green-950 text-green-400 border border-green-800",
};

const statusLabels: Record<Status, string> = {
  NEW:            "New",
  IN_PROGRESS:    "In Progress",
  PENDING_REVIEW: "Pending Review",
  CLOSED:         "Closed",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
