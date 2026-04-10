import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addIocSchema } from "@/lib/validations/ioc";
import { getCaseAccess } from "@/lib/caseAccess";

// GET /api/cases/[id]/iocs
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const iocs = await prisma.ioc.findMany({
    where: { caseId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(iocs);
}

// POST /api/cases/[id]/iocs — add IOC + collision check + CaseEntry
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = addIocSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type, value, description, confidence, tlp } = parsed.data;

  // Create IOC + CaseEntry atomically
  const ioc = await prisma.$transaction(async (tx) => {
    const created = await tx.ioc.create({
      data: {
        caseId: params.id,
        type,
        value,
        description,
        confidence,
        tlp,
        addedById: session.user.id,
      },
    });

    await tx.caseEntry.create({
      data: {
        caseId: params.id,
        authorId: session.user.id,
        authorTeam: session.user.team ?? "SOC",
        entryType: "IOC_ADDED",
        body: `IOC added: [${type}] ${value}`,
      },
    });

    return created;
  });

  // Collision check — run outside transaction (read-only, non-blocking)
  const rawCollisions = await prisma.ioc.findMany({
    where: { value, caseId: { not: params.id } },
    distinct: ["caseId"],
    select: {
      case: { select: { id: true, caseId: true, title: true } },
    },
  });

  const collisions = rawCollisions.map((r) => ({
    id: r.case.id,
    caseId: r.case.caseId,
    title: r.case.title,
  }));

  return NextResponse.json({ ioc, collisions }, { status: 201 });
}
