import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addLinkSchema } from "@/lib/validations/link";
import { Prisma } from "@prisma/client";
import { getCaseAccess } from "@/lib/caseAccess";

// Unified link shape returned to the client — abstracts directionality
interface LinkRow {
  id:        string;
  otherCase: { id: string; caseId: string; title: string; cat: string; status: string };
  note:      string | null;
}

// GET /api/cases/[id]/links — return all links in both directions
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [asSource, asTarget] = await Promise.all([
    prisma.caseLink.findMany({
      where:   { sourceCaseId: params.id },
      include: {
        targetCase: { select: { id: true, caseId: true, title: true, cat: true, status: true } },
      },
    }),
    prisma.caseLink.findMany({
      where:   { targetCaseId: params.id },
      include: {
        sourceCase: { select: { id: true, caseId: true, title: true, cat: true, status: true } },
      },
    }),
  ]);

  const links: LinkRow[] = [
    ...asSource.map((l) => ({
      id:        l.id,
      otherCase: {
        id:     l.targetCase.id,
        caseId: l.targetCase.caseId,
        title:  l.targetCase.title,
        cat:    l.targetCase.cat as string,
        status: l.targetCase.status as string,
      },
      note: l.note,
    })),
    ...asTarget.map((l) => ({
      id:        l.id,
      otherCase: {
        id:     l.sourceCase.id,
        caseId: l.sourceCase.caseId,
        title:  l.sourceCase.title,
        cat:    l.sourceCase.cat as string,
        status: l.sourceCase.status as string,
      },
      note: l.note,
    })),
  ];

  return NextResponse.json(links);
}

// POST /api/cases/[id]/links — create a bidirectional link
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = addLinkSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { targetCaseId, note } = parsed.data;

  if (targetCaseId === params.id) {
    return NextResponse.json({ error: "Cannot link a case to itself." }, { status: 422 });
  }

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await prisma.case.findUnique({
    where:  { id: targetCaseId },
    select: { id: true, caseId: true },
  });
  if (!target) return NextResponse.json({ error: "Target case not found." }, { status: 422 });

  try {
    const link = await prisma.caseLink.create({
      data: { sourceCaseId: params.id, targetCaseId, note: note ?? null },
    });
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "These cases are already linked." }, { status: 409 });
    }
    throw err;
  }
}
