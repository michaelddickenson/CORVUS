import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import { invalidateConfigCache } from "@/lib/config";
import { z } from "zod";

const patchSchema = z.object({
  label:      z.string().min(1).max(200).optional(),
  shortLabel: z.string().min(1).max(50).optional(),
  color:      z.string().max(50).nullable().optional(),
  isActive:   z.boolean().optional(),
  sortOrder:  z.number().int().optional(),
});

// PATCH /api/admin/config/[optionId] — update label/shortLabel/isActive/sortOrder
export async function PATCH(
  req: NextRequest,
  { params }: { params: { optionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.configOption.findUnique({
    where: { id: params.optionId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updates = { ...parsed.data, updatedById: session.user.id };
  const updated = await prisma.configOption.update({
    where: { id: params.optionId },
    data: updates,
  });

  invalidateConfigCache(existing.category);

  await writeAuditLog({
    userId:     session.user.id,
    action:     "CONFIG_OPTION_UPDATED",
    targetType: "ConfigOption",
    targetId:   params.optionId,
    detail:     { before: existing, after: updates },
  });

  return NextResponse.json(updated);
}
