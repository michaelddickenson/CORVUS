import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface WriteAuditLogParams {
  userId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Write an append-only audit log entry.
 * Call from admin API routes after each user management action.
 * Never throws — a failed audit write should not roll back the primary action,
 * but callers wrapping in a transaction will naturally roll it back together.
 */
export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      detail: params.detail as Prisma.InputJsonValue ?? undefined,
      ipAddress: params.ipAddress,
    },
  });
}

/**
 * Extract the real client IP from a Next.js request.
 * Prefers x-forwarded-for (set by reverse proxies), falls back to x-real-ip.
 */
export function getRequestIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? undefined;
}
