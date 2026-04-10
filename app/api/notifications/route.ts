import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET /api/notifications — unread notifications for current user/team
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId, team: userTeam } = session.user;

  const where: Prisma.NotificationWhereInput = {
    isRead: false,
    OR: [
      { targetUserId: userId },
      ...(userTeam ? [{ targetTeam: userTeam, targetUserId: null }] : []),
    ],
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      case: { select: { id: true, caseId: true } },
    },
  });

  return NextResponse.json(
    notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    }))
  );
}
