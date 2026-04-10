import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/notifications/[id]/read — mark a single notification as read
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId, team: userTeam } = session.user;

  const notif = await prisma.notification.findUnique({ where: { id: params.id } });
  if (!notif) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the intended recipient may mark as read
  const canRead =
    notif.targetUserId === userId ||
    (notif.targetTeam === userTeam && notif.targetUserId === null);
  if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.notification.update({
    where: { id: params.id },
    data: { isRead: true, readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
