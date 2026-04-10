import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addNoteSchema } from "@/lib/validations/case";

// ---------------------------------------------------------------------------
// GET /api/cases/[id]/entries — chronological entry feed (oldest first)
// Includes author name + role so the display layer can apply the ADMIN label.
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exists = await prisma.case.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await prisma.caseEntry.findMany({
    where: { caseId: params.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      authorTeam: true,
      entryType: true,
      body: true,
      corrects: true,
      createdAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json(entries);
}

// ---------------------------------------------------------------------------
// POST /api/cases/[id]/entries — add a NOTE entry
// Only NOTE type is accepted here. System entries are created by their
// respective action routes (status, assign, escalate).
// CaseEntry is immutable — no PATCH or DELETE endpoint exists.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = addNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const exists = await prisma.case.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entry = await prisma.caseEntry.create({
    data: {
      caseId: params.id,
      authorId: session.user.id,
      // ADMIN users have no Team enum value — store SOC as placeholder;
      // the display layer renders "ADMIN" when author.role === ADMIN.
      authorTeam: session.user.team ?? "SOC",
      entryType: "NOTE",
      body: parsed.data.body,
    },
    select: {
      id: true,
      authorTeam: true,
      entryType: true,
      body: true,
      corrects: true,
      createdAt: true,
      author: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
