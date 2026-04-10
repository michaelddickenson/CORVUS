import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCaseAccess } from "@/lib/caseAccess";

// GET /api/cases/[id]/team-status — all CaseTeamStatus records for the case
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c)       return NextResponse.json({ error: "Not found"  }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden"  }, { status: 403 });

  const teamStatuses = await prisma.caseTeamStatus.findMany({
    where:   { caseId: params.id },
    orderBy: { updatedAt: "asc" },
    select: {
      id:        true,
      team:      true,
      status:    true,
      updatedAt: true,
      updatedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(teamStatuses);
}
