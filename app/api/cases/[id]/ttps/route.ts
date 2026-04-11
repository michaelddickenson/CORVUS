import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addTtpSchema } from "@/lib/validations/ttp";
import { getCaseAccess } from "@/lib/caseAccess";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ttps = await prisma.ttp.findMany({
    where: { caseId: params.id },
    orderBy: { techniqueId: "asc" },
  });
  return NextResponse.json(ttps);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = addTtpSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { c, allowed, canWrite } = await getCaseAccess(params.id, session);
  if (!c)        return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed)  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!canWrite) return NextResponse.json({ error: "Observers may not perform write operations." }, { status: 403 });

  const ttp = await prisma.$transaction(async (tx) => {
    const created = await tx.ttp.create({
      data: {
        caseId: params.id,
        addedById: session.user.id,
        ...parsed.data,
      },
    });

    await tx.caseEntry.create({
      data: {
        caseId: params.id,
        authorId: session.user.id,
        authorTeam: session.user.team ?? "SOC",
        entryType: "TTP_TAGGED",
        body: `TTP tagged: ${parsed.data.techniqueId} — ${parsed.data.techniqueName} [${parsed.data.tactic}]`,
      },
    });

    return created;
  });

  return NextResponse.json(ttp, { status: 201 });
}
