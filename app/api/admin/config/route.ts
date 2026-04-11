import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/auditLog";
import { invalidateConfigCache } from "@/lib/config";
import { z } from "zod";

const createSchema = z.object({
  category:   z.string().min(1).max(50),
  value:      z.string().min(1).max(100),
  label:      z.string().min(1).max(200),
  shortLabel: z.string().min(1).max(50),
  color:      z.string().max(50).nullable().optional(),
  sortOrder:  z.number().int().default(0),
});

// GET /api/admin/config — all options grouped by category
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.configOption.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true, category: true, value: true, label: true,
      shortLabel: true, color: true, sortOrder: true, isActive: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });

  // Group by category
  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  return NextResponse.json(grouped);
}

// POST /api/admin/config — create a new config option
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { category, value, label, shortLabel, color, sortOrder } = parsed.data;

  // Check for duplicate
  const existing = await prisma.configOption.findUnique({
    where: { category_value: { category, value } },
  });
  if (existing) {
    return NextResponse.json({ error: "Option already exists for this category/value." }, { status: 409 });
  }

  const option = await prisma.configOption.create({
    data: { category, value, label, shortLabel, color: color ?? null, sortOrder, updatedById: session.user.id },
  });

  invalidateConfigCache(category);

  await writeAuditLog({
    userId:     session.user.id,
    action:     "CONFIG_OPTION_CREATED",
    targetType: "ConfigOption",
    targetId:   option.id,
    detail:     { category, value, label, shortLabel },
  });

  return NextResponse.json(option, { status: 201 });
}
