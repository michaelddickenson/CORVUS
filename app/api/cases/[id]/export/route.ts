import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getCaseAccess } from "@/lib/caseAccess";

// ---------------------------------------------------------------------------
// GET /api/cases/[id]/export
// TEAM_LEAD and ADMIN only. TLP:RED gated via getCaseAccess.
// Returns full case JSON as a downloadable attachment.
// storedPath is intentionally excluded from artifact records.
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== Role.ADMIN && session.user.role !== Role.TEAM_LEAD) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fullCase = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      createdBy:  { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      entries: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorId: true,
          authorTeam: true,
          entryType: true,
          body: true,
          corrects: true,
          createdAt: true,
          author: { select: { id: true, name: true, role: true } },
        },
      },
      iocs: {
        select: {
          id: true,
          type: true,
          value: true,
          description: true,
          confidence: true,
          tlp: true,
          addedById: true,
          createdAt: true,
        },
      },
      assets: {
        select: {
          id: true,
          hostname: true,
          ipAddress: true,
          macAddress: true,
          os: true,
          assetType: true,
          impact: true,
          owner: true,
          description: true,
          addedById: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      ttps: {
        select: {
          id: true,
          techniqueId: true,
          techniqueName: true,
          tactic: true,
          description: true,
          addedById: true,
          createdAt: true,
        },
      },
      artifacts: {
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          sha256: true,
          description: true,
          uploadedById: true,
          createdAt: true,
          // storedPath intentionally excluded
        },
      },
      linkedFrom: {
        select: { id: true, targetCaseId: true, note: true, createdAt: true },
      },
      linkedTo: {
        select: { id: true, sourceCaseId: true, note: true, createdAt: true },
      },
    },
  });

  if (!fullCase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Destructure to rename tlp → classification in the export payload
  const { tlp, classificationCustom, ...caseRest } = fullCase;

  const payload = {
    exportedAt: new Date().toISOString(),
    exportedBy: {
      id:   session.user.id,
      name: session.user.name,
      role: session.user.role,
    },
    case: {
      ...caseRest,
      classification:       tlp,
      classificationCustom: classificationCustom ?? null,
      createdAt: fullCase.createdAt.toISOString(),
      updatedAt: fullCase.updatedAt.toISOString(),
      closedAt:  fullCase.closedAt?.toISOString() ?? null,
      entries:   fullCase.entries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      iocs: fullCase.iocs.map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
      })),
      assets: fullCase.assets.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
      ttps: fullCase.ttps.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      })),
      artifacts: fullCase.artifacts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      linkedFrom: fullCase.linkedFrom.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
      linkedTo: fullCase.linkedTo.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
    },
  };

  const json = JSON.stringify(payload, null, 2);
  // Sanitize case ID for use in filename — replace any characters outside [A-Za-z0-9._-]
  const safeId = fullCase.caseId.replace(/[^A-Za-z0-9._-]/g, "-");
  const filename = `${safeId}-export.json`;

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
