# CORVUS — Deployment Guide

Two deployment paths are supported:

| Path | Use case | Auth |
|---|---|---|
| Vercel + Supabase | Demo, evaluation, development | Credential (email + password) |
| Docker Compose | Production, air-gapped, self-hosted | LDAP / Active Directory |

---

## Option 1: Vercel + Supabase (Demo)

This path uses email/password authentication. It is not suitable for production
deployments that require AD integration or an air-gapped environment.

### Prerequisites

- [Vercel account](https://vercel.com) and Vercel CLI (`npm i -g vercel`)
- [Supabase account](https://supabase.com) (free tier is sufficient for demo)
- Node.js 20+ on your local machine

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project.
2. Choose a region close to your Vercel deployment region.
3. Note the database password you set — you will need it.

### 2. Get the connection string

In your Supabase project:
**Project Settings → Database → Connection string → URI**

Copy the **Session mode** string (port `5432`). It looks like:
```
postgresql://postgres.xxxxxxxxxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

**Important — pgbouncer parameters:**
Next.js serverless functions open a new DB connection on every request.
Without the connection pooler parameters, you will exhaust Supabase's
connection limit quickly. Append the following to your connection string:
```
?pgbouncer=true&connection_limit=1
```

Final `DATABASE_URL`:
```
postgresql://postgres.xxxx:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
```

### 3. Link the Vercel project

```bash
vercel link
```

### 4. Set environment variables

Run each command and enter the value when prompted:

```bash
vercel env add DATABASE_URL
vercel env add NEXTAUTH_SECRET       # openssl rand -base64 32
vercel env add NEXTAUTH_URL          # https://your-project.vercel.app
vercel env add SEED_ADMIN_EMAIL
vercel env add SEED_ADMIN_NAME
vercel env add SEED_ADMIN_PASSWORD
vercel env add ENABLE_CREDENTIAL_AUTH   # value: true
vercel env add NEXT_PUBLIC_DEMO_MODE    # value: true
```

Select **Production**, **Preview**, and **Development** environments for each.

### 5. Run the database migration

From your local machine with the same `DATABASE_URL` set:

```bash
DATABASE_URL="<your-supabase-url>" npx prisma migrate deploy
DATABASE_URL="<your-supabase-url>" npx prisma db seed
```

This creates the schema and the bootstrap admin account.

### 6. Deploy

```bash
vercel deploy --prod
```

### 7. First login

Navigate to your Vercel URL. Log in with the email and password from
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Assign roles to other users via
**Admin → Users**.

---

## Option 2: Docker Compose (Production)

Self-hosted deployment on Linux. Designed for air-gapped environments and
Active Directory integration.

### Prerequisites

- Linux host (Ubuntu 22.04 LTS or later recommended)
- [Docker Engine 24+](https://docs.docker.com/engine/install/)
- Docker Compose v2 (included with Docker Engine 24+)
- Network access to your AD/LDAP server from the Docker host

No other runtime dependencies are required. The image is self-contained.

### 1. Clone the repository

```bash
git clone <repo-url> corvus
cd corvus
```

### 2. Configure environment variables

```bash
cp docker/.env.example .env
nano .env          # or your preferred editor
```

**Required changes** — do not skip any of these:

| Variable | Description |
|---|---|
| `DB_OWNER_PASSWORD` | Strong random password for the dco_owner PostgreSQL role. Generate: `openssl rand -base64 24` |
| `DB_APP_PASSWORD` | Different strong password for the dco_app runtime role |
| `DATABASE_URL` | Copy from template; replace password with `DB_OWNER_PASSWORD` value |
| `APP_DATABASE_URL` | Copy from template; replace password with `DB_APP_PASSWORD` value |
| `NEXTAUTH_SECRET` | 32+ char random string. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Full URL of this deployment, e.g. `http://cms.corp.local:3000` |
| `SEED_ADMIN_EMAIL` | Email address for the bootstrap admin account |
| `SEED_ADMIN_NAME` | Display name for the bootstrap admin |
| `LDAP_URI` | LDAP server URI, e.g. `ldap://dc01.corp.local:389` |
| `LDAP_BASE_DN` | AD base DN, e.g. `DC=corp,DC=local` |
| `LDAP_BIND_DN` | Service account DN for LDAP searches |
| `LDAP_BIND_PASSWORD` | Service account password |

**Note:** `DB_OWNER_PASSWORD` in `.env` must exactly match the password you put
in `DATABASE_URL`. `DB_APP_PASSWORD` must match `APP_DATABASE_URL`. Docker
Compose passes the standalone password vars to PostgreSQL and to the
initialization script; it cannot derive them from the URL automatically.

### 3. Start the stack

```bash
docker compose up -d
```

Docker Compose starts three services in dependency order:

1. **db** — PostgreSQL 15. On first start, `docker/init.sh` runs automatically
   (see [Database initialization](#database-initialization) below).
2. **migrate** — Applies Prisma migrations (`prisma migrate deploy`) then
   creates the admin seed account (`prisma db seed`). Exits when done.
3. **app** — The Next.js server. Starts only after **migrate** exits
   successfully.

Allow 30–60 seconds on first boot for migrations to complete.

Check logs:
```bash
docker compose logs -f migrate   # watch migration progress
docker compose logs -f app       # watch app startup
```

### 4. First login

Navigate to `http://<host>:3000`. Log in with the email from `SEED_ADMIN_EMAIL`
and your Active Directory password (LDAP mode) or `SEED_ADMIN_PASSWORD`
(credential/demo mode only).

Go to **Admin → Users** to create accounts and assign roles for your team.
In LDAP mode: user records are created automatically on first login; you can
pre-create them and assign roles before the user logs in.

---

### LDAP configuration

The application binds to AD using a service account to look up users by email,
then binds again as the authenticating user to verify their password.

| Variable | AD mapping | Example |
|---|---|---|
| `LDAP_URI` | LDAP server address | `ldap://dc01.corp.local:389` or `ldaps://` |
| `LDAP_BASE_DN` | Search base | `DC=corp,DC=local` |
| `LDAP_BIND_DN` | Service account DN | `CN=svc-dco,OU=ServiceAccounts,DC=corp,DC=local` |
| `LDAP_BIND_PASSWORD` | Service account password | — |

**Service account requirements:**
- Read permission on user objects in the search base
- Able to search `subtree` scope
- Filter used: `(mail=<user-email>)`

**LDAPS (TLS):** Change `LDAP_URI` to `ldaps://dc01.corp.local:636`. Ensure
your AD certificate is trusted by the host (or add it to the container's trust
store via a custom base image).

---

### File storage

Uploaded artifacts are stored in `./uploads/` on the host, bind-mounted to
`/app/uploads` inside the container. Include this directory in your backup
schedule alongside the PostgreSQL volume.

```bash
# Backup uploads
tar -czf uploads_$(date +%Y%m%d).tar.gz ./uploads/

# Backup database
docker exec $(docker compose ps -q db) \
  pg_dump -U dco_owner dco_cms > db_$(date +%Y%m%d).sql
```

---

### Upgrading

```bash
git pull
docker compose up -d --build
```

On each `compose up`, the **migrate** service runs `prisma migrate deploy`
automatically, applying any new schema migrations before the app starts.

---

### Database initialization

`docker/init.sh` is mounted into PostgreSQL's `/docker-entrypoint-initdb.d/`
directory. PostgreSQL runs this script **once**, on first container
initialization (i.e., when the `dco_postgres_data` volume is empty).

**It will not re-run** on subsequent `docker compose up` invocations while the
volume exists. This is standard PostgreSQL Docker behavior.

If you need to re-initialize (e.g., to change role passwords), you must:
1. Take a full database backup.
2. `docker compose down -v` (destroys the volume and all data).
3. Restore the backup after bringing the stack back up.

---

### AuditLog append-only enforcement

`docker/init.sh` installs a PostgreSQL **event trigger** on the database.
When Prisma's `migrate deploy` creates the `audit_logs` table, the trigger
automatically fires and executes:

```sql
REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM dco_app;
```

This means the running Next.js application (which connects as `dco_app`) is
**physically unable** to modify or delete audit log entries. The enforcement is:

- **Database-level** — not just application code; cannot be bypassed by a bug
  or a compromised app process
- **Automatic** — no manual SQL required after deployment
- **Persistent** — survives container restarts, image rebuilds, and application
  upgrades
- **Tied to the volume** — removed only if `docker compose down -v` is run

The `dco_owner` role (used only by the migrate service) retains full privileges.
No normal application path connects as `dco_owner` at runtime.

---

### Reverse proxy (recommended for production)

Expose port 3000 behind nginx or Traefik for TLS termination. Example nginx
snippet:

```nginx
server {
    listen 443 ssl;
    server_name cms.corp.local;

    ssl_certificate     /etc/ssl/certs/cms.crt;
    ssl_certificate_key /etc/ssl/private/cms.key;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

Update `NEXTAUTH_URL` in `.env` to the HTTPS URL after adding TLS.
