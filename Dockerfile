# =============================================================================
# DCO Case Management System — Multi-stage Dockerfile
# Base image: node:20-alpine throughout (musl libc, Prisma linux-musl binary)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — deps
# Install ALL npm dependencies (dev + prod) needed for the build.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2 — builder
# Generate the Prisma client and compile the Next.js application.
# No real database connection is made during this stage.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files (see .dockerignore for exclusions)
COPY . .

# Generate Prisma client for linux-musl (matches the runner image)
RUN npx prisma generate

# Placeholder env vars — prevent Next.js / NextAuth from erroring during
# static analysis.  Real values are injected at container start via .env.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost/placeholder
ENV NEXTAUTH_SECRET=build-time-placeholder
ENV NEXTAUTH_URL=http://localhost:3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — runner
# Minimal production image.  Only the standalone output is copied.
# Runs as non-root user `nextjs` (uid 1001).
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Default upload directory inside the container.
# Override via UPLOAD_DIR env var or by bind-mounting a volume here.
ENV UPLOAD_DIR=/app/uploads

# OpenSSL is required by the Prisma query engine (linux-musl build)
RUN apk add --no-cache openssl

# Create non-root user and group
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Create upload directory with correct ownership before switching user
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

# Copy standalone server (includes bundled node_modules subset)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets and public directory (not included in standalone)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Ensure the Prisma query engine binary is present.
# Next.js's file tracer may not trace it; we copy it explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

# next/standalone outputs a self-contained server.js at the workdir root
CMD ["node", "server.js"]
