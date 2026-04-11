import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/cases/[id]/iocs/[iocId]
// IOC deletion is explicitly permitted (unlike CaseEntry or Case).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; iocId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "OBSERVER") {
    return NextResponse.json({ error: "Observers may not perform write operations." }, { status: 403 });
  }

  const exists = await prisma.case.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ioc = await prisma.ioc.findUnique({
    where: { id: params.iocId },
    select: { caseId: true },
  });
  if (!ioc || ioc.caseId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.ioc.delete({ where: { id: params.iocId } });
  return new NextResponse(null, { status: 204 });
}
