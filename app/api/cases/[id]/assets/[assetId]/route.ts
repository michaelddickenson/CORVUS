import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; assetId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "OBSERVER") {
    return NextResponse.json({ error: "Observers may not perform write operations." }, { status: 403 });
  }

  const exists = await prisma.case.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    select: { caseId: true },
  });
  if (!asset || asset.caseId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.asset.delete({ where: { id: params.assetId } });
  return new NextResponse(null, { status: 204 });
}
