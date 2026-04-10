import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCaseAccess } from "@/lib/caseAccess";
import { saveFile } from "@/lib/storage";
import path from "path";

// ---------------------------------------------------------------------------
// MIME + extension allowlist
// Browser-declared MIME types are not cryptographically verified (no magic
// byte check — would require a library not installed here). The extension
// check provides a secondary layer. Both must pass.
// ---------------------------------------------------------------------------
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".txt", ".log", ".pcap", ".zip",
  ".png", ".jpg", ".jpeg", ".json", ".csv", ".yar",
]);

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.tcpdump.pcap",
  "application/x-pcap",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "image/png",
  "image/jpeg",
  "application/json",
  "text/csv",
  "application/csv",
  "text/csv; charset=utf-8",
]);

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB ?? "50", 10);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// ---------------------------------------------------------------------------
// GET /api/cases/[id]/artifacts — list artifact metadata (no storedPath)
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const artifacts = await prisma.artifact.findMany({
    where: { caseId: params.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      caseId: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      sha256: true,
      description: true,
      uploadedById: true,
      createdAt: true,
      // storedPath intentionally excluded — never exposed to client
    },
  });

  // Hydrate uploader info in a second query
  const uploaderIds = Array.from(new Set(artifacts.map((a) => a.uploadedById)));
  const uploaders = uploaderIds.length
    ? await prisma.user.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, name: true, team: true, role: true },
      })
    : [];
  const uploaderMap = Object.fromEntries(uploaders.map((u) => [u.id, u]));

  return NextResponse.json(
    artifacts.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      uploadedBy: uploaderMap[a.uploadedById] ?? { name: "Unknown", team: null, role: null },
    }))
  );
}

// ---------------------------------------------------------------------------
// POST /api/cases/[id]/artifacts — upload a file
// Accepts multipart/form-data with fields: file (required), description (optional)
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { c, allowed } = await getCaseAccess(params.id, session);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const fileField = formData.get("file");
  if (!(fileField instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 422 });
  }

  const file = fileField as File;
  const description = (formData.get("description") as string | null)?.trim() ?? undefined;

  // Size check (fast-fail before reading buffer)
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${MAX_UPLOAD_MB} MB.` },
      { status: 413 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 422 });
  }

  // Extension check
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `File type '${ext}' is not allowed.` },
      { status: 422 }
    );
  }

  // MIME type check (browser-declared — not cryptographically verified)
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIMES.has(mimeType.toLowerCase())) {
    return NextResponse.json(
      { error: `MIME type '${mimeType}' is not allowed.` },
      { status: 422 }
    );
  }

  // Read buffer and compute SHA256 server-side
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { storagePath, sha256 } = await saveFile(buffer, file.name, mimeType);

  // Create Artifact + EVIDENCE_ADDED CaseEntry atomically
  const artifact = await prisma.$transaction(async (tx) => {
    const created = await tx.artifact.create({
      data: {
        caseId: params.id,
        filename: file.name,
        storedPath: storagePath,
        mimeType,
        sizeBytes: file.size,
        sha256,
        description,
        uploadedById: session.user.id,
      },
      select: {
        id: true,
        caseId: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        sha256: true,
        description: true,
        uploadedById: true,
        createdAt: true,
        // storedPath excluded
      },
    });

    await tx.caseEntry.create({
      data: {
        caseId: params.id,
        authorId: session.user.id,
        authorTeam: session.user.team ?? "SOC",
        entryType: "EVIDENCE_ADDED",
        body: `Artifact uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB) SHA256: ${sha256.slice(0, 16)}…`,
      },
    });

    return created;
  });

  // Fetch uploader info for the response
  const uploader = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, team: true, role: true },
  });

  return NextResponse.json(
    {
      ...artifact,
      createdAt: artifact.createdAt.toISOString(),
      uploadedBy: uploader ?? { name: session.user.name, team: session.user.team, role: session.user.role },
    },
    { status: 201 }
  );
}
