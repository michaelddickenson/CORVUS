import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assignCaseSchema } from "@/lib/validations/case";
import { Team } from "@prisma/client";

// PATCH /api/cases/[id]/assign — assign (or unassign) a case to a user
// Auto-writes an ASSIGNMENT CaseEntry and a Notification for the assignee.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const parsed = assignCaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    const { assignedToId } = parsed.data;

    const c = await prisma.case.findUnique({ where: { id: params.id }, select: { caseId: true, title: true } });
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let assigneeName: string | null = null;
    let assigneeTeam: Team | null = null;

    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || !assignee.isActive) {
        return NextResponse.json({ error: "Assignee not found or inactive" }, { status: 422 });
      }
      assigneeName = assignee.name;
      assigneeTeam = assignee.team as Team | null;
    }

    const entryBody = assignedToId ? `Case assigned to ${assigneeName ?? assignedToId}.` : "Case unassigned.";

    await prisma.case.update({ where: { id: params.id }, data: { assignedToId } });

    await prisma.caseEntry.create({
      data: {
        caseId:     params.id,
        authorId:   session.user.id,
        authorTeam: session.user.team ?? "SOC",
        entryType:  "ASSIGNMENT",
        body:       entryBody,
      },
    });

    if (assignedToId && assigneeTeam) {
      await prisma.notification.create({
        data: {
          caseId:       params.id,
          targetTeam:   assigneeTeam,
          targetUserId: assignedToId,
          message: `You have been assigned to case ${c.caseId}: ${c.title}`,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/cases/[id]/assign] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
