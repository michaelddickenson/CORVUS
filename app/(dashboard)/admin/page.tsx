import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, Status } from "@prisma/client";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-neutral-600 mt-1">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-neutral-800 last:border-0 flex justify-between items-center">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="text-sm text-neutral-200 font-mono">{value}</dd>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) redirect("/dashboard");

  const [
    totalUsers,
    activeUsers,
    totalCases,
    casesByStatus,
    totalAuditEntries,
    latestAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.case.count(),
    prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.auditLog.count(),
    prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const openCases = casesByStatus
    .filter((r) => r.status !== Status.CLOSED)
    .reduce((acc, r) => acc + r._count._all, 0);

  const authMode = process.env.LDAP_URI ? "LDAP / Active Directory" : "Credentials (Demo Mode)";

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold text-white mb-6">Admin Overview</h1>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={totalUsers} sub={`${activeUsers} active`} />
        <StatCard label="Total Cases" value={totalCases} sub={`${openCases} open`} />
        <StatCard label="Audit Log Entries" value={totalAuditEntries} />
        <StatCard
          label="Last Audit Event"
          value={
            latestAudit
              ? latestAudit.createdAt.toISOString().replace("T", " ").slice(0, 16) + " UTC"
              : "—"
          }
        />
      </div>

      {/* Case breakdown */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
          Cases by Status
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
          {casesByStatus.length === 0 ? (
            <p className="p-4 text-sm text-neutral-600">No cases yet.</p>
          ) : (
            casesByStatus
              .sort((a, b) => b._count._all - a._count._all)
              .map((r) => (
                <div key={r.status} className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-sm text-neutral-300 font-mono">{r.status}</span>
                  <span className="text-sm text-neutral-500 tabular-nums">{r._count._all}</span>
                </div>
              ))
          )}
        </div>
      </section>

      {/* System information */}
      <section>
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
          System Information
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4">
          <dl>
            <InfoRow label="Auth Mode" value={authMode} />
            <InfoRow label="Node.js" value={process.version} />
            <InfoRow label="App Version" value={process.env.APP_VERSION ?? "dev"} />
            <InfoRow
              label="Environment"
              value={process.env.NODE_ENV ?? "unknown"}
            />
          </dl>
        </div>
      </section>
    </div>
  );
}
