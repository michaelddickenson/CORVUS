import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCaseAccess } from "@/lib/caseAccess";
import { writeAuditLog } from "@/lib/auditLog";
import { z } from "zod";
import { CaseAccess } from "@prisma/client";

const grantSchema = z.object({
  userId:      z.string().uuid(),
  accessLevel: z.nativeEnum(CaseAccess),
  expiresAt:   z.string().datetime().optional().nullable(),
});

// GET /api/cases/[id]/permissions — list permissions for this case (TEAM_LEAD/ADMIN only)
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "TEAM_LEAD") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c)       return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const permissions = await prisma.casePermission.findMany({
    where: { caseId: params.id },
    orderBy: { grantedAt: "desc" },
    select: {
      id: true,
      accessLevel: true,
      grantedAt: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      grantedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(permissions);
}

// POST /api/cases/[id]/permissions — grant access (TEAM_LEAD/ADMIN only)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "TEAM_LEAD") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c)       return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { userId, accessLevel, expiresAt } = parsed.data;

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({ where: { id: userId, isActive: true } });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found or inactive." }, { status: 422 });
  }

  // Upsert (grant or update existing)
  const perm = await prisma.casePermission.upsert({
    where:  { caseId_userId: { caseId: params.id, userId } },
    update: { accessLevel, expiresAt: expiresAt ? new Date(expiresAt) : null, grantedById: session.user.id, grantedAt: new Date() },
    create: { caseId: params.id, userId, accessLevel, expiresAt: expiresAt ? new Date(expiresAt) : null, grantedById: session.user.id },
  });

  await writeAuditLog({
    userId:     session.user.id,
    action:     "CASE_PERMISSION_GRANTED",
    targetType: "Case",
    targetId:   params.id,
    detail:     { caseId: c.caseId, targetUserId: userId, targetUserName: targetUser.name, accessLevel },
  });

  return NextResponse.json(perm, { status: 201 });
}
