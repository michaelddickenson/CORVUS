import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// GET /api/admin/audit — paginated audit log (ADMIN only)
// Query params: page (1-based), action, userId, targetType
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== Role.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const action = searchParams.get("action")?.trim() ?? "";
  const userId = searchParams.get("userId")?.trim() ?? "";
  const targetType = searchParams.get("targetType")?.trim() ?? "";

  const where = {
    ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
    ...(userId ? { userId } : {}),
    ...(targetType ? { targetType: { contains: targetType, mode: "insensitive" as const } } : {}),
  };

  const [total, entries] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        detail: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
  ]);

  return NextResponse.json({
    entries,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  });
}
