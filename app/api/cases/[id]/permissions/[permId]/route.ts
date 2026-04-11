import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";

// DELETE /api/cases/[id]/permissions/[permId] — revoke access (TEAM_LEAD/ADMIN only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; permId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "TEAM_LEAD") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const perm = await prisma.casePermission.findUnique({
    where: { id: params.permId },
    select: {
      id: true,
      caseId: true,
      accessLevel: true,
      userId: true,
      user: { select: { name: true } },
      case: { select: { caseId: true } },
    },
  });

  if (!perm || perm.caseId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.casePermission.delete({ where: { id: params.permId } });

  await writeAuditLog({
    userId:     session.user.id,
    action:     "CASE_PERMISSION_REVOKED",
    targetType: "Case",
    targetId:   params.id,
    detail:     { caseId: perm.case.caseId, targetUserId: perm.userId, targetUserName: perm.user.name, accessLevel: perm.accessLevel },
  });

  return new NextResponse(null, { status: 204 });
}
