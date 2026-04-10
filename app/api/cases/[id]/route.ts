import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { z } from "zod";
import { patchIncidentDetailsSchema } from "@/lib/validations/case";

const patchCaseSchema = z.object({
  blufSummary:          z.string().max(10000).optional().nullable(),
  recommendedActions:   z.string().max(10000).optional().nullable(),
  classificationCustom: z.string().max(200).optional().nullable(),
}).merge(patchIncidentDetailsSchema);

// GET /api/cases/[id] — fetch full case detail
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const c = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(c);
}

// PATCH /api/cases/[id] — update blufSummary, recommendedActions, and/or classificationCustom
// blufSummary: any authenticated user
// recommendedActions: TEAM_LEAD or ADMIN only
// classificationCustom: any authenticated user
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exists = await prisma.case.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = patchCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const {
    blufSummary, recommendedActions, classificationCustom,
    incidentStartedAt, incidentEndedAt, incidentDetectedAt, incidentReportedAt,
    detectionSource, attackVector, affectedNetwork, missionImpact,
    reportingRequired, externalTicketId,
  } = parsed.data;

  // recommendedActions is TEAM_LEAD/ADMIN only
  if (
    recommendedActions !== undefined &&
    session.user.role !== Role.TEAM_LEAD &&
    session.user.role !== Role.ADMIN
  ) {
    return NextResponse.json(
      { error: "Only Team Leads and Admins may edit Recommended Actions." },
      { status: 403 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (blufSummary          !== undefined) updateData.blufSummary          = blufSummary;
  if (recommendedActions   !== undefined) updateData.recommendedActions   = recommendedActions;
  if (classificationCustom !== undefined) updateData.classificationCustom = classificationCustom;
  if (incidentStartedAt    !== undefined) updateData.incidentStartedAt    = incidentStartedAt ? new Date(incidentStartedAt) : null;
  if (incidentEndedAt      !== undefined) updateData.incidentEndedAt      = incidentEndedAt   ? new Date(incidentEndedAt)   : null;
  if (incidentDetectedAt   !== undefined) updateData.incidentDetectedAt   = incidentDetectedAt ? new Date(incidentDetectedAt) : null;
  if (incidentReportedAt   !== undefined) updateData.incidentReportedAt   = incidentReportedAt ? new Date(incidentReportedAt) : null;
  if (detectionSource      !== undefined) updateData.detectionSource      = detectionSource;
  if (attackVector         !== undefined) updateData.attackVector         = attackVector;
  if (affectedNetwork      !== undefined) updateData.affectedNetwork      = affectedNetwork;
  if (missionImpact        !== undefined) updateData.missionImpact        = missionImpact;
  if (reportingRequired    !== undefined) updateData.reportingRequired    = reportingRequired;
  if (externalTicketId     !== undefined) updateData.externalTicketId     = externalTicketId;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const fields = Object.keys(updateData).join(", ");

  try {
    await prisma.case.update({ where: { id: params.id }, data: updateData });
    await prisma.caseEntry.create({
      data: {
        caseId:     params.id,
        authorId:   session.user.id,
        authorTeam: session.user.team ?? "SOC",
        entryType:  "FIELD_EDIT",
        body:       `Updated ${fields}.`,
      },
    });
  } catch (err) {
    console.error("PATCH /api/cases/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
