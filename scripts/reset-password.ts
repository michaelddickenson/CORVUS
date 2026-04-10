/**
 * Reset a user's password by email.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/reset-password.ts <email> <newpassword>
 *
 * Only works when ENABLE_CREDENTIAL_AUTH=true (credential/demo mode).
 * Not applicable in LDAP deployments — AD owns all credentials there.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: ts-node scripts/reset-password.ts <email> <newpassword>");
  process.exit(1);
}

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { email },
    data: { password: hash },
  });

  console.log(`Password updated for ${user.name} (${user.email})`);
}

main()
  .catch((err) => {
    console.error("Error:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
