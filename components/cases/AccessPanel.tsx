"use client";

import { useState, useEffect } from "react";
import { CaseAccess } from "@prisma/client";

interface Permission {
  id:          string;
  accessLevel: CaseAccess;
  grantedAt:   string;
  expiresAt:   string | null;
  user:        { id: string; name: string; email: string; role: string };
  grantedBy:   { id: string; name: string };
}

interface User {
  id:    string;
  name:  string;
  email: string;
  role:  string;
  team:  string | null;
}

interface Props {
  caseUuid: string;
}

function formatUtc(iso: string) {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function AccessPanel({ caseUuid }: Props) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [users,       setUsers]       = useState<User[]>([]);
  const [revoking,    setRevoking]    = useState<string | null>(null);
  const [granting,    setGranting]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const [form, setForm] = useState({
    userId:      "",
    accessLevel: "READ" as CaseAccess,
    expiresAt:   "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/cases/${caseUuid}/permissions`).then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ])
      .then(([perms, us]) => {
        setPermissions(Array.isArray(perms) ? perms : []);
        setUsers(Array.isArray(us) ? us : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [caseUuid]);

  async function handleRevoke(permId: string) {
    setRevoking(permId);
    try {
      await fetch(`/api/cases/${caseUuid}/permissions/${permId}`, { method: "DELETE" });
      setPermissions((prev) => prev.filter((p) => p.id !== permId));
    } finally {
      setRevoking(null);
    }
  }

  async function handleGrant() {
    if (!form.userId) { setError("Select a user."); return; }
    setError(null);
    setGranting(true);
    try {
      const res = await fetch(`/api/cases/${caseUuid}/permissions`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId:      form.userId,
          accessLevel: form.accessLevel,
          expiresAt:   form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to grant access."); return; }
      // Reload permissions list
      const perms = await fetch(`/api/cases/${caseUuid}/permissions`).then((r) => r.json());
      setPermissions(Array.isArray(perms) ? perms : []);
      setForm({ userId: "", accessLevel: "READ", expiresAt: "" });
    } catch {
      setError("Network error.");
    } finally {
      setGranting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Current permissions */}
      {loading ? (
        <p className="text-neutral-600 text-xs">Loading...</p>
      ) : permissions.length === 0 ? (
        <p className="text-neutral-600 text-xs">No explicit permissions granted on this case.</p>
      ) : (
        <div className="border border-neutral-800 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/50">
                <th className="px-3 py-2 text-left text-neutral-500 font-medium">User</th>
                <th className="px-3 py-2 text-left text-neutral-500 font-medium">Access</th>
                <th className="px-3 py-2 text-left text-neutral-500 font-medium">Expires</th>
                <th className="px-3 py-2 text-left text-neutral-500 font-medium">Granted by</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.id} className="border-b border-neutral-800/50 last:border-0">
                  <td className="px-3 py-2">
                    <p className="text-neutral-200">{p.user.name}</p>
                    <p className="text-neutral-600 font-mono">{p.user.role}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-mono font-medium ${p.accessLevel === "WRITE" ? "text-amber-400" : "text-blue-400"}`}>
                      {p.accessLevel}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {p.expiresAt ? (
                      <span className="font-mono text-neutral-400">{formatUtc(p.expiresAt)}</span>
                    ) : (
                      <span className="text-neutral-600">Never</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-400">{p.grantedBy.name}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleRevoke(p.id)}
                      disabled={revoking === p.id}
                      className="text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {revoking === p.id ? "..." : "Revoke"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grant access form */}
      <div className="border-t border-neutral-800 pt-4">
        <h4 className="text-xs font-medium text-neutral-400 mb-3 uppercase tracking-wider">Grant Access</h4>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">User</label>
            <select
              value={form.userId}
              onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select user...</option>
              {users
                .filter((u) => !permissions.some((p) => p.user.id === u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}{u.team ? ` / ${u.team}` : ""})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-neutral-500 mb-1">Level</label>
              <select
                value={form.accessLevel}
                onChange={(e) => setForm((p) => ({ ...p, accessLevel: e.target.value as CaseAccess }))}
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="READ">READ</option>
                <option value="WRITE">WRITE</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-neutral-500 mb-1">Expires (optional)</label>
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleGrant}
            disabled={granting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
          >
            {granting ? "Granting..." : "Grant Access"}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
    </div>
  );
}
