import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, Status } from "@prisma/client";
import { z } from "zod";
import { VALID_TRANSITIONS } from "@/lib/validations/case";

const statusUpdateSchema = z.object({
  status:   z.nativeEnum(Status),
  override: z.boolean().optional().default(false),
});

// PATCH /api/cases/[id]/status — transition case status
// Normal transitions: validated against VALID_TRANSITIONS map.
// Override (TEAM_LEAD/ADMIN only): bypass transition rules; writes a manual override note.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "OBSERVER") {
    return NextResponse.json({ error: "Observers may not perform write operations." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { status: newStatus, override } = parsed.data;

  // Override is available to all non-OBSERVER authenticated users (OBSERVER already blocked above)

  const c = await prisma.case.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!override) {
    // Validate normal transition
    const allowed = VALID_TRANSITIONS[c.status];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Transition from ${c.status} to ${newStatus} is not permitted.` },
        { status: 422 }
      );
    }
  }

  const entryBody = override
    ? `Status manually overridden from ${c.status} to ${newStatus} by ${session.user.name ?? session.user.email}.`
    : `Status changed from ${c.status} to ${newStatus}.`;

  const [updated] = await prisma.$transaction([
    prisma.case.update({
      where: { id: params.id },
      data: {
        status:   newStatus,
        closedAt: newStatus === "CLOSED" ? new Date() : (c.status === "CLOSED" ? null : undefined),
      },
    }),
    prisma.caseEntry.create({
      data: {
        caseId:     params.id,
        authorId:   session.user.id,
        authorTeam: session.user.team ?? "SOC",
        entryType:  "STATUS_CHANGE",
        body:       entryBody,
      },
    }),
  ]);

  return NextResponse.json(updated);
}
