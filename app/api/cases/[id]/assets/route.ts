import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addAssetSchema } from "@/lib/validations/asset";
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

  const assets = await prisma.asset.findMany({
    where: { caseId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(assets);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = addAssetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const asset = await prisma.asset.create({
    data: {
      caseId: params.id,
      addedById: session.user.id,
      ...parsed.data,
    },
  });

  return NextResponse.json(asset, { status: 201 });
}
