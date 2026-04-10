import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCaseAccess } from "@/lib/caseAccess";
import { getFileStream } from "@/lib/storage";
import { Readable } from "stream";

// GET /api/artifacts/[artifactId]/download — authenticated, TLP:RED gated
// Streams the file with the original filename in Content-Disposition.
// storedPath is never exposed in response headers or body.
export async function GET(
  _req: NextRequest,
  { params }: { params: { artifactId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch artifact (including storedPath for server-side use only)
  const artifact = await prisma.artifact.findUnique({
    where: { id: params.artifactId },
    select: {
      id: true,
      caseId: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      storedPath: true, // server-side only — not returned in response
    },
  });

  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // TLP:RED access check via shared utility
  const { allowed } = await getCaseAccess(artifact.caseId, session);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Stream the file (storedPath stays server-side, never in response headers)
  let nodeStream: ReturnType<typeof getFileStream>;
  try {
    nodeStream = getFileStream(artifact.storedPath);
  } catch {
    return NextResponse.json({ error: "File not found on server." }, { status: 404 });
  }

  // Convert Node.js ReadStream → Web API ReadableStream (Node.js 18+)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  // Sanitize filename for Content-Disposition (strip non-ASCII and quotes)
  const safeFilename = artifact.filename.replace(/[^\w.\-]/g, "_");

  return new Response(webStream, {
    headers: {
      "Content-Type": artifact.mimeType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Content-Length": String(artifact.sizeBytes),
      // Prevent the browser from sniffing content type — honor the stored value
      "X-Content-Type-Options": "nosniff",
    },
  });
}
