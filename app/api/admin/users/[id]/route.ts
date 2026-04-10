import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { z } from "zod";
import { writeAuditLog, getRequestIp } from "@/lib/auditLog";

const patchUserSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  team: z.enum(["SOC", "IR", "MALWARE", "CTI", "COUNTERMEASURES"]).nullable().optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/[id] — update role, team, or active status
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== Role.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Prevent self-demotion or self-deactivation
  if (params.id === session.user.id)
    return NextResponse.json(
      { error: "You cannot modify your own account via the admin panel." },
      { status: 400 }
    );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { role, team, isActive } = parsed.data;

  if (role === undefined && team === undefined && isActive === undefined)
    return NextResponse.json({ error: "No fields to update." }, { status: 422 });

  const existing = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, team: true, isActive: true },
  });
  if (!existing) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Prevent deactivating the last ADMIN
  if (isActive === false && existing.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN, isActive: true } });
    if (adminCount <= 1)
      return NextResponse.json(
        { error: "Cannot deactivate the last active admin account." },
        { status: 400 }
      );
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(role !== undefined ? { role } : {}),
      ...(team !== undefined ? { team } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      team: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  // Determine audit action
  let action = "USER_ROLE_CHANGED";
  if (isActive !== undefined && isActive !== existing.isActive) {
    action = isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED";
  }

  await writeAuditLog({
    userId: session.user.id,
    action,
    targetType: "User",
    targetId: params.id,
    detail: {
      before: { role: existing.role, team: existing.team, isActive: existing.isActive },
      after: { role: updated.role, team: updated.team, isActive: updated.isActive },
    },
    ipAddress: getRequestIp(req),
  });

  return NextResponse.json(updated);
}
