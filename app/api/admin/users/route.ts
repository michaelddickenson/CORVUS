import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { writeAuditLog, getRequestIp } from "@/lib/auditLog";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.nativeEnum(Role),
  team: z.enum(["SOC", "IR", "MALWARE", "CTI", "COUNTERMEASURES"]).nullable().optional(),
  // password only used in credential (demo) mode — never stored in LDAP deployments
  password: z.string().min(8).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/admin/users — list all users (ADMIN only)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== Role.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const roleFilter = searchParams.get("role") ?? "";
  const showInactive = searchParams.get("showInactive") === "true";

  const users = await prisma.user.findMany({
    where: {
      ...(showInactive ? {} : { isActive: true }),
      ...(roleFilter ? { role: roleFilter as Role } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      team: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

// ---------------------------------------------------------------------------
// POST /api/admin/users — create a new user (ADMIN only)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== Role.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { email, name, role, team, password } = parsed.data;

  // Check for email collision
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json({ error: "Email already in use." }, { status: 409 });

  const isLdap = Boolean(process.env.LDAP_URI);

  let hashedPassword: string | undefined;
  if (!isLdap) {
    // Credential (demo) mode — hash provided password or fall back to DEFAULT_USER_PASSWORD
    const rawPassword = password ?? process.env.DEFAULT_USER_PASSWORD;
    if (!rawPassword) {
      return NextResponse.json(
        {
          error:
            "No password provided and DEFAULT_USER_PASSWORD is not set. " +
            "Set DEFAULT_USER_PASSWORD in .env or include a password in the request.",
        },
        { status: 422 }
      );
    }
    hashedPassword = await bcrypt.hash(rawPassword, 12);
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role,
      team: team ?? null,
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      team: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "USER_CREATED",
    targetType: "User",
    targetId: user.id,
    detail: { email, name, role, team: team ?? null },
    ipAddress: getRequestIp(req),
  });

  // In credential mode, return the plaintext password once so admin can hand it off
  const response: Record<string, unknown> = { ...user };
  if (!isLdap && password === undefined && process.env.DEFAULT_USER_PASSWORD) {
    response.temporaryPassword = process.env.DEFAULT_USER_PASSWORD;
    response.passwordNote =
      "This is the DEFAULT_USER_PASSWORD. The user should change it on first login.";
  } else if (!isLdap && password) {
    response.temporaryPassword = password;
    response.passwordNote = "This is the password you provided. Share it securely with the user.";
  }

  return NextResponse.json(response, { status: 201 });
}
