import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; linkId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exists = await prisma.case.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The link may appear as source or target — verify it belongs to this case
  const link = await prisma.caseLink.findUnique({ where: { id: params.linkId } });
  if (!link || (link.sourceCaseId !== params.id && link.targetCaseId !== params.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.caseLink.delete({ where: { id: params.linkId } });
  return new NextResponse(null, { status: 204 });
}
