import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCaseAccess } from "@/lib/caseAccess";

// POST /api/cases/[id]/complete-team — mark requesting team's work as COMPLETE
// Permission: user must belong to a team that is currently ACTIVE on the case.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { c, allowed, canWrite } = await getCaseAccess(params.id, session);
  if (!c)        return NextResponse.json({ error: "Not found"  }, { status: 404 });
  if (!allowed)  return NextResponse.json({ error: "Forbidden"  }, { status: 403 });
  if (!canWrite) return NextResponse.json({ error: "Observers may not perform write operations." }, { status: 403 });

  const team = session.user.team;
  if (!team) {
    return NextResponse.json({ error: "You have no team assignment." }, { status: 403 });
  }

  const myStatus = await prisma.caseTeamStatus.findUnique({
    where: { caseId_team: { caseId: params.id, team } },
  });

  if (!myStatus || myStatus.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Your team must be ACTIVE on this case to mark work complete." },
      { status: 403 }
    );
  }

  const entryBody = `${team} marked their work complete.`;

  await prisma.$transaction(async (tx) => {
    await tx.caseTeamStatus.update({
      where: { caseId_team: { caseId: params.id, team } },
      data:  { status: "COMPLETE", updatedById: session.user.id },
    });

    await tx.caseEntry.create({
      data: {
        caseId:     params.id,
        authorId:   session.user.id,
        authorTeam: team,
        entryType:  "NOTE",
        body:       entryBody,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
