import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 10;
const MAX_PAGES = 3;

// GET /api/dashboard/activity?page=1 — 10 CaseEntry records per page, max 3 pages
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = Math.min(
    Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1),
    MAX_PAGES
  );

  const [entries, total] = await Promise.all([
    prisma.caseEntry.findMany({
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * PAGE_SIZE,
      take:    PAGE_SIZE,
      select: {
        id: true,
        caseId: true,
        entryType: true,
        authorTeam: true,
        createdAt: true,
        author: { select: { name: true, role: true } },
        case:   { select: { caseId: true } },
      },
    }),
    prisma.caseEntry.count(),
  ]);

  const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES);

  return NextResponse.json({
    items: entries.map((e) => ({
      id:             e.id,
      caseId:         e.caseId,
      entryType:      e.entryType,
      authorTeam:     e.authorTeam,
      createdAt:      e.createdAt.toISOString(),
      author:         e.author,
      caseFriendlyId: e.case.caseId,
    })),
    page,
    totalPages,
  });
}
