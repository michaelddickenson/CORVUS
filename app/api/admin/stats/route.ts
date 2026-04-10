import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, Status } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/admin/stats — system overview (ADMIN only)
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== Role.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [
    totalUsers,
    activeUsers,
    usersByRole,
    totalCases,
    casesByStatus,
    totalAuditEntries,
    latestAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.case.count(),
    prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.auditLog.count(),
    prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const openCases = casesByStatus
    .filter((r) => r.status !== Status.CLOSED)
    .reduce((acc, r) => acc + r._count._all, 0);

  return NextResponse.json({
    users: {
      total: totalUsers,
      active: activeUsers,
      byRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all])),
    },
    cases: {
      total: totalCases,
      open: openCases,
      byStatus: Object.fromEntries(casesByStatus.map((r) => [r.status, r._count._all])),
    },
    audit: {
      total: totalAuditEntries,
      lastEntryAt: latestAudit?.createdAt.toISOString() ?? null,
    },
    system: {
      authMode: process.env.LDAP_URI ? "LDAP" : "Credentials (Demo)",
      nodeVersion: process.version,
      appVersion: process.env.APP_VERSION ?? "dev",
    },
  });
}
