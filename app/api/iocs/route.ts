import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IocType, TLP, Prisma } from "@prisma/client";

const PAGE_SIZE = 25;

// Confidence bucket helpers
function confidenceBucket(n: number): "HIGH" | "MEDIUM" | "LOW" {
  if (n >= 75) return "HIGH";
  if (n >= 25) return "MEDIUM";
  return "LOW";
}

function confidenceFilter(buckets: string[]): Prisma.IntFilter | undefined {
  if (buckets.length === 0) return undefined;
  if (buckets.length === 1) {
    const b = buckets[0];
    if (b === "HIGH")   return { gte: 75, lte: 100 };
    if (b === "MEDIUM") return { gte: 25, lte: 74 };
    return { gte: 0, lte: 24 };
  }
  // Multiple buckets: pick widest range
  const hasHigh = buckets.includes("HIGH");
  const hasMed  = buckets.includes("MEDIUM");
  const hasLow  = buckets.includes("LOW");
  const min = hasLow ? 0 : hasMed ? 25 : 75;
  const max = hasHigh ? 100 : hasMed ? 74 : 24;
  return { gte: min, lte: max };
}

// GET /api/iocs?search=&type=&confidence=&page=&sort=
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search      = searchParams.get("search")?.trim() ?? "";
  const types       = searchParams.getAll("type") as IocType[];
  const confidences = searchParams.getAll("confidence");
  const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const sort        = searchParams.get("sort") ?? "createdAt";

  // TLP:RED access filter — only show IOCs from cases the user can access
  const userTeam = session.user.team;
  const userRole = session.user.role;
  const userId   = session.user.id;

  const caseWhere: Prisma.CaseWhereInput =
    userRole === "ADMIN" || userRole === "TEAM_LEAD"
      ? {}
      : {
          OR: [
            { tlp: { not: TLP.RED } },
            { createdById: userId },
            { assignedToId: userId },
            ...(userTeam ? [{ teamsInvolved: { has: userTeam } }] : []),
          ],
        };

  const where: Prisma.IocWhereInput = {
    ...(search ? { value: { contains: search, mode: "insensitive" } } : {}),
    ...(types.length > 0 ? { type: { in: types } } : {}),
    ...(confidences.length > 0 ? { confidence: confidenceFilter(confidences) } : {}),
    case: Object.keys(caseWhere).length > 0 ? caseWhere : undefined,
  };

  // Sort order
  const orderBy: Prisma.IocOrderByWithRelationInput[] =
    sort === "type"   ? [{ type: "asc" }] :
    sort === "caseId" ? [{ case: { caseId: "asc" } }] :
                        [{ createdAt: "desc" }];

  const [iocs, total] = await Promise.all([
    prisma.ioc.findMany({
      where,
      orderBy,
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
      include: {
        case: {
          select: {
            id:     true,
            caseId: true,
            title:  true,
            tlp:    true,
          },
        },
      },
    }),
    prisma.ioc.count({ where }),
  ]);

  // Fetch user names for addedById
  const userIds = Array.from(new Set(iocs.map((i) => i.addedById)));
  const users   = await prisma.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  // Detect duplicate IOC values — count distinct occurrences per value
  const resultValues = Array.from(new Set(iocs.map((i) => i.value)));
  const valueCounts: Record<string, number> = {};
  if (resultValues.length > 0) {
    const counts = await prisma.ioc.groupBy({
      by:    ["value"],
      where: {
        value: { in: resultValues },
        case:  Object.keys(caseWhere).length > 0 ? caseWhere : undefined,
      },
      _count: { caseId: true },
    });
    for (const row of counts) {
      valueCounts[row.value] = row._count.caseId;
    }
  }

  const rows = iocs.map((ioc) => ({
    id:               ioc.id,
    value:            ioc.value,
    type:             ioc.type,
    confidence:       ioc.confidence,
    confidenceBucket: confidenceBucket(ioc.confidence),
    createdAt:        ioc.createdAt.toISOString(),
    addedByName:      userMap[ioc.addedById] ?? "Unknown",
    caseUuid:         ioc.case.id,
    caseId:           ioc.case.caseId,
    caseTitle:        ioc.case.title,
    caseTlp:          ioc.case.tlp,
    caseCount:        valueCounts[ioc.value] ?? 1,
  }));

  return NextResponse.json({
    rows,
    total,
    page,
    pageSize:  PAGE_SIZE,
    pageCount: Math.ceil(total / PAGE_SIZE),
  });
}
