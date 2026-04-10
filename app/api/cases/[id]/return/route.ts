import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCaseAccess } from "@/lib/caseAccess";
import { z } from "zod";
import { Team, Role } from "@prisma/client";

const returnSchema = z.object({
  targetTeam: z.nativeEnum(Team),
  message:    z.string().max(2000).optional(),
});

// POST /api/cases/[id]/return — bounce-back to a team
// Permission: requesting user's team must be ACTIVE on the case, or TEAM_LEAD/ADMIN.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c)       return NextResponse.json({ error: "Not found"  }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden"  }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = returnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { targetTeam, message } = parsed.data;
  const requestingTeam = session.user.team ?? null;
  const isPrivileged =
    session.user.role === Role.TEAM_LEAD || session.user.role === Role.ADMIN;

  // Permission: requesting team must be ACTIVE, or user is TEAM_LEAD/ADMIN
  if (!isPrivileged) {
    if (!requestingTeam) {
      return NextResponse.json({ error: "You have no team assignment." }, { status: 403 });
    }
    const myStatus = await prisma.caseTeamStatus.findUnique({
      where: { caseId_team: { caseId: params.id, team: requestingTeam } },
    });
    if (!myStatus || myStatus.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Your team must be ACTIVE on this case to issue a bounce-back." },
        { status: 403 }
      );
    }
  }

  // Target team must exist on the case and not already be ACTIVE
  const targetStatus = await prisma.caseTeamStatus.findUnique({
    where: { caseId_team: { caseId: params.id, team: targetTeam } },
  });
  if (!targetStatus) {
    return NextResponse.json(
      { error: "Target team is not involved in this case." },
      { status: 422 }
    );
  }
  if (targetStatus.status === "ACTIVE") {
    return NextResponse.json(
      { error: "Target team is already ACTIVE." },
      { status: 422 }
    );
  }

  const entryBody = message
    ? `${requestingTeam ?? "Admin"} returned case to ${targetTeam}. ${message}`
    : `${requestingTeam ?? "Admin"} returned case to ${targetTeam}.`;

  await prisma.$transaction(async (tx) => {
    // Requesting team → RETURNED
    if (requestingTeam) {
      await tx.caseTeamStatus.upsert({
        where:  { caseId_team: { caseId: params.id, team: requestingTeam } },
        update: { status: "RETURNED", updatedById: session.user.id },
        create: { caseId: params.id, team: requestingTeam, status: "RETURNED", updatedById: session.user.id },
      });
    }

    // Target team → ACTIVE
    await tx.caseTeamStatus.update({
      where: { caseId_team: { caseId: params.id, team: targetTeam } },
      data:  { status: "ACTIVE", updatedById: session.user.id },
    });

    // Timeline entry
    await tx.caseEntry.create({
      data: {
        caseId:     params.id,
        authorId:   session.user.id,
        authorTeam: session.user.team ?? "SOC",
        entryType:  "RETURNED",
        body:       entryBody,
      },
    });

    // Notification for target team
    await tx.notification.create({
      data: {
        caseId:     params.id,
        targetTeam,
        message:    `Case ${c.caseId} has been returned to your team (${targetTeam}) for further action.`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
