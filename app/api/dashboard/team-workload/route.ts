import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, Status } from "@prisma/client";

// GET /api/dashboard/team-workload — TEAM_LEAD or ADMIN only
// TEAM_LEAD: users on their own team
// ADMIN: all users
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, team } = session.user;
  if (role !== Role.TEAM_LEAD && role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(role === Role.TEAM_LEAD && team ? { team } : {}),
    },
    select: {
      id: true,
      name: true,
      role: true,
      team: true,
      casesAssigned: {
        where: { status: { not: Status.CLOSED } },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      team: u.team,
      openCaseCount: u.casesAssigned.length,
    }))
  );
}
