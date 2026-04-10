import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// PATCH /api/notifications/read-all — mark all unread notifications as read
export async function PATCH() {
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

  await prisma.notification.updateMany({
    where,
    data: { isRead: true, readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
