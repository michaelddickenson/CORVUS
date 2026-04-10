import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statusTransitionSchema, VALID_TRANSITIONS } from "@/lib/validations/case";

// PATCH /api/cases/[id]/status — transition case status
// Validates allowed transitions; auto-writes a STATUS_CHANGE CaseEntry.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = statusTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { status: newStatus } = parsed.data;

  const c = await prisma.case.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Validate the transition
  const allowed = VALID_TRANSITIONS[c.status];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Transition from ${c.status} to ${newStatus} is not permitted.` },
      { status: 422 }
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.case.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        closedAt: newStatus === "CLOSED" ? new Date() : undefined,
      },
    }),
    prisma.caseEntry.create({
      data: {
        caseId: params.id,
        authorId: session.user.id,
        authorTeam: session.user.team ?? "SOC",
        entryType: "STATUS_CHANGE",
        body: `Status changed from ${c.status} to ${newStatus}.`,
      },
    }),
  ]);

  return NextResponse.json(updated);
}
