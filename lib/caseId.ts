import { Prisma } from "@prisma/client";

/**
 * Generates the next DCO-YYYY-NNNN case ID inside a serializable transaction.
 *
 * NNNN resets to 0001 each calendar year.
 * The caller must pass the Prisma transaction client so this runs atomically
 * within the same transaction that creates the Case row.
 */
export async function generateCaseId(
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `DCO-${year}-`;

  // Find the highest sequence in use for this year
  const latest = await tx.case.findFirst({
    where: { caseId: { startsWith: prefix } },
    orderBy: { caseId: "desc" },
    select: { caseId: true },
  });

  let next = 1;
  if (latest) {
    // caseId format: DCO-YYYY-NNNN — last segment is the sequence
    const parts = latest.caseId.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) next = lastSeq + 1;
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
}
