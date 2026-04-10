import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCaseId } from "@/lib/caseId";
import { createCaseSchema } from "@/lib/validations/case";
import { Prisma, Status, IncidentCat, ImpactLevel, Category } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/cases — list cases with filtering
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;

  const statuses    = searchParams.getAll("status")    as Status[];
  const cats        = searchParams.getAll("cat")        as IncidentCat[];
  const impacts     = searchParams.getAll("impact")     as ImpactLevel[];
  const categories  = searchParams.getAll("category")  as Category[];
  const search      = searchParams.get("search")        ?? "";
  const assignedTo  = searchParams.get("assignedTo")    ?? "";
  const ttpId       = searchParams.get("ttpId")         ?? "";
  const createdFrom = searchParams.get("createdFrom")   ?? "";
  const createdTo   = searchParams.get("createdTo")     ?? "";
  const sortBy      = searchParams.get("sortBy")        ?? "createdAt";
  const sortDir     = (searchParams.get("sortDir")      ?? "desc") as "asc" | "desc";

  const where: Prisma.CaseWhereInput = {};
  if (statuses.length > 0)   where.status      = { in: statuses };
  if (cats.length > 0)       where.cat         = { in: cats };
  if (impacts.length > 0)    where.impactLevel = { in: impacts };
  if (categories.length > 0) where.category    = { in: categories };
  if (assignedTo)            where.assignedToId = assignedTo;
  if (ttpId)                 where.ttps         = { some: { techniqueId: ttpId } };
  if (createdFrom || createdTo) {
    where.createdAt = {
      ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
      ...(createdTo   ? { lte: new Date(createdTo + "T23:59:59Z") } : {}),
    };
  }
  if (search) {
    where.OR = [
      { caseId:      { contains: search, mode: "insensitive" } },
      { title:       { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const allowedSort: Record<string, Prisma.CaseOrderByWithRelationInput> = {
    caseId:    { caseId:    sortDir },
    createdAt: { createdAt: sortDir },
    updatedAt: { updatedAt: sortDir },
    cat:       { cat:       sortDir },
    status:    { status:    sortDir },
    category:  { category:  sortDir },
  };
  const orderBy = allowedSort[sortBy] ?? { createdAt: "desc" };

  try {
    const cases = await prisma.case.findMany({
      where,
      orderBy,
      select: {
        id: true, caseId: true, title: true,
        cat: true, impactLevel: true,
        status: true, category: true, tlp: true,
        classificationCustom: true,
        createdAt: true, updatedAt: true,
        assignedTo:   { select: { id: true, name: true } },
        createdBy:    { select: { id: true, name: true } },
        teamStatuses: {
          where:  { status: "ACTIVE" },
          select: { team: true },
        },
      },
    });
    return NextResponse.json(cases);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code ?? "unknown";
    console.error(`GET /api/cases error [${code}]:`, msg, err);
    return NextResponse.json({ error: "Failed to load cases", detail: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/cases — create a new case
// Role is read from session — never from request body.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = createCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { title, description, cat, impactLevel, category, tlp, classificationCustom, assignedToId } = parsed.data;

  const newCase = await prisma.$transaction(
    async (tx) => {
      const caseId = await generateCaseId(tx);

      const created = await tx.case.create({
        data: {
          caseId, title, description,
          cat, impactLevel, category, tlp,
          classificationCustom: classificationCustom ?? null,
          status: Status.NEW,
          createdById: session.user.id,
          assignedToId: assignedToId ?? null,
          teamsInvolved: session.user.team ? [session.user.team] : [],
        },
      });

      await tx.caseEntry.create({
        data: {
          caseId: created.id,
          authorId: session.user.id,
          authorTeam: session.user.team ?? "SOC",
          entryType: "STATUS_CHANGE",
          body: "Case created with status NEW.",
        },
      });

      // Set creator's team as ACTIVE in CaseTeamStatus
      if (session.user.team) {
        await tx.caseTeamStatus.create({
          data: {
            caseId:      created.id,
            team:        session.user.team,
            status:      "ACTIVE",
            updatedById: session.user.id,
          },
        });
      }

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return NextResponse.json(newCase, { status: 201 });
}
