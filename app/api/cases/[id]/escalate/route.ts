import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escalateSchema } from "@/lib/validations/case";
import { Team, Role } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role === "OBSERVER") {
      return NextResponse.json({ error: "Observers may not perform write operations." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const parsed = escalateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { targetTeam, note } = parsed.data;

    const c = await prisma.case.findUnique({
      where: { id: params.id },
      select: { caseId: true, title: true, teamsInvolved: true, createdById: true },
    });
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canEscalate =
      c.createdById === session.user.id ||
      session.user.role === Role.TEAM_LEAD ||
      session.user.role === Role.ADMIN;
    if (!canEscalate) {
      return NextResponse.json(
        { error: "Only the case creator, a Team Lead, or an Admin may loop in a team." },
        { status: 403 }
      );
    }

    const entryBody = note ? `Team ${targetTeam} looped in. ${note}` : `Team ${targetTeam} looped in.`;
    const currentTeams = c.teamsInvolved as Team[];
    const updatedTeams = currentTeams.includes(targetTeam) ? currentTeams : [...currentTeams, targetTeam];
    const escalatingTeam = (session.user.team ?? null) as Team | null;

    // Execute all writes sequentially (avoids interactive transaction issues with pgbouncer)
    await prisma.case.update({
      where: { id: params.id },
      data:  { teamsInvolved: updatedTeams },
    });

    await prisma.caseEntry.create({
      data: {
        caseId:     params.id,
        authorId:   session.user.id,
        authorTeam: session.user.team ?? "SOC",
        entryType:  "ESCALATION",
        body:       entryBody,
      },
    });

    await prisma.notification.create({
      data: {
        caseId:     params.id,
        targetTeam,
        message: `Your team (${targetTeam}) has been looped in to case ${c.caseId}: ${c.title}`,
      },
    });

    await prisma.caseTeamStatus.upsert({
      where:  { caseId_team: { caseId: params.id, team: targetTeam } },
      update: { status: "ACTIVE", updatedById: session.user.id },
      create: { caseId: params.id, team: targetTeam, status: "ACTIVE", updatedById: session.user.id },
    });

    if (escalatingTeam) {
      const existing = await prisma.caseTeamStatus.findUnique({
        where: { caseId_team: { caseId: params.id, team: escalatingTeam } },
      });
      if (existing && existing.status === "ACTIVE") {
        await prisma.caseTeamStatus.update({
          where: { caseId_team: { caseId: params.id, team: escalatingTeam } },
          data:  { status: "PENDING", updatedById: session.user.id },
        });
      } else if (!existing) {
        await prisma.caseTeamStatus.create({
          data: { caseId: params.id, team: escalatingTeam, status: "PENDING", updatedById: session.user.id },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/cases/[id]/escalate] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
