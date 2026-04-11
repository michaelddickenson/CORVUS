import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { deleteFile } from "@/lib/storage";

// DELETE /api/cases/[id]/artifacts/[artifactId] — ADMIN and TEAM_LEAD only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; artifactId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "OBSERVER") {
    return NextResponse.json({ error: "Observers may not perform write operations." }, { status: 403 });
  }

  // Role gate: ADMIN or TEAM_LEAD only
  const { role } = session.user;
  if (role !== Role.ADMIN && role !== Role.TEAM_LEAD) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch artifact — verify it belongs to the specified case (prevent IDOR)
  const artifact = await prisma.artifact.findUnique({
    where: { id: params.artifactId },
    select: { id: true, caseId: true, storedPath: true, filename: true },
  });

  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (artifact.caseId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete file from storage first, then remove DB record
  // (If file deletion fails, we abort — the DB record is preserved so the
  //  artifact is not orphaned in the UI.)
  try {
    await deleteFile(artifact.storedPath);
  } catch {
    return NextResponse.json(
      { error: "Failed to delete file from storage." },
      { status: 500 }
    );
  }

  await prisma.artifact.delete({ where: { id: params.artifactId } });

  return NextResponse.json({ ok: true });
}
