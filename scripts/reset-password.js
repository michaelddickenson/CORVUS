/**
 * Reset a user's password by email.
 * Reads credentials from environment variables — no shell quoting issues.
 *
 * Usage (PowerShell):
 *   $env:RESET_EMAIL="admin@example.com"; $env:RESET_PASSWORD="newpassword"; node scripts/reset-password.js
 *
 * Usage (bash):
 *   RESET_EMAIL=admin@example.com RESET_PASSWORD=newpassword node scripts/reset-password.js
 *
 * Only applies in credential/demo mode (ENABLE_CREDENTIAL_AUTH=true).
 * LDAP deployments: AD owns all credentials — this script is not applicable.
 */

// Load .env so DATABASE_URL is available
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const email = process.env.RESET_EMAIL;
const password = process.env.RESET_PASSWORD;

if (!email || !password) {
  console.error("RESET_EMAIL and RESET_PASSWORD environment variables must be set.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("RESET_PASSWORD must be at least 8 characters.");
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

  console.log(`Found user: ${user.name} (${user.email}), isActive=${user.isActive}, current password field: ${user.password ? "set" : "null"}`);

  const hash = await bcrypt.hash(password, 12);
  console.log(`Bcrypt hash generated (prefix: ${hash.slice(0, 7)}...)`);

  const updated = await prisma.user.update({
    where: { email },
    data: { password: hash },
    select: { email: true, password: true },
  });

  if (!updated.password) {
    console.error("ERROR: password field is still null after update — write may have been silently dropped.");
    process.exit(1);
  }

  console.log(`Updated password hash for ${updated.email} (stored hash prefix: ${updated.password.slice(0, 7)}...)`);
}

main()
  .catch((err) => {
    console.error("Error:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
