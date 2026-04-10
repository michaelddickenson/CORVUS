# CORVUS
**Cyber Operations | Case Management**

A purpose-built case management system for defensive cyber operations (DCO) teams.
Supports multi-team workflows: SOC → IR → Malware Analysis → CTI → Countermeasures.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Auth | NextAuth.js — LDAP (production) / Credentials (demo) |
| Styling | Tailwind CSS |

---

## Quick Start (Demo / Vercel)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions.

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET, etc.
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Navigate to `http://localhost:3000` and sign in with the admin credentials from your `.env`.

---

## Production (Docker)

```bash
cp docker/.env.example .env
# Edit .env — set DB passwords, NEXTAUTH_SECRET, NEXTAUTH_URL, LDAP vars
docker compose up -d
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full configuration reference.
