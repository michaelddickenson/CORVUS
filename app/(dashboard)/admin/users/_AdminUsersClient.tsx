"use client";

import { useEffect, useState, useCallback } from "react";
import { Role, Team } from "@prisma/client";
import { TEAM_LABEL } from "@/lib/teamDisplay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  team: Team | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROLES: Role[] = [
  "ADMIN",
  "TEAM_LEAD",
  "SOC_ANALYST",
  "IR_ANALYST",
  "MALWARE_ANALYST",
  "CTI_ANALYST",
  "COUNTERMEASURES",
  "OBSERVER",
];

const TEAMS: (Team | "")[] = ["", "SOC", "IR", "MALWARE", "CTI", "COUNTERMEASURES"];

const ROLE_LABEL: Record<Role, string> = {
  ADMIN:            "Admin",
  TEAM_LEAD:        "Team Lead",
  SOC_ANALYST:      "SOC Analyst",
  IR_ANALYST:       "IR Analyst",
  MALWARE_ANALYST:  "Malware Analyst",
  CTI_ANALYST:      "CTI Analyst",
  COUNTERMEASURES:  "Countermeasures",
  OBSERVER:         "Observer",
};

function formatUtc(iso: string | null) {
  if (!iso) return "Never";
  return iso.replace("T", " ").slice(0, 16) + " UTC";
}

// ---------------------------------------------------------------------------
// Create User Form
// ---------------------------------------------------------------------------
function CreateUserForm({
  onCreated,
  isLdap,
}: {
  onCreated: (u: AdminUser) => void;
  isLdap: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("SOC_ANALYST");
  const [team, setTeam] = useState<Team | "">("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function handleRoleChange(newRole: Role) {
    setRole(newRole);
    // OBSERVER has no team affiliation
    if (newRole === "OBSERVER") setTeam("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:  name.trim(),
        email: email.trim(),
        role,
        team:  role === "OBSERVER" ? null : (team || null),
        ...(!isLdap && password ? { password } : {}),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : "Failed to create user."
      );
      return;
    }

    if (data.temporaryPassword) {
      setNotice(
        `User created. Temporary password: ${data.temporaryPassword} — share securely.`
      );
    }
    onCreated(data as AdminUser);
    setName("");
    setEmail("");
    setRole("SOC_ANALYST");
    setTeam("");
    setPassword("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
      >
        New User
      </button>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-5 mb-6">
      <h2 className="text-sm font-semibold text-white mb-4">Create New User</h2>
      {notice && (
        <div className="mb-3 p-3 bg-green-950 border border-green-800 rounded text-green-300 text-sm font-mono">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 p-3 bg-red-950 border border-red-800 rounded text-red-300 text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Full Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
        {role !== "OBSERVER" ? (
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Team (optional)</label>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value as Team | "")}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
            >
              {TEAMS.map((t) => (
                <option key={t} value={t}>{t || "— No team —"}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Team</label>
            <p className="text-xs text-neutral-600 italic pt-2">
              Observers have no team affiliation.
            </p>
          </div>
        )}

        {/* Password field — hidden in LDAP mode */}
        {!isLdap ? (
          <div className="col-span-2">
            <label className="block text-xs text-neutral-400 mb-1">
              Password (leave blank to use DEFAULT_USER_PASSWORD from .env)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        ) : (
          <div className="col-span-2">
            <p className="text-xs text-neutral-500 bg-neutral-800 border border-neutral-700 rounded px-3 py-2">
              User will authenticate via Active Directory. No password is stored.
            </p>
          </div>
        )}

        <div className="col-span-2 flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => { setOpen(false); setError(""); }}
            className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md"
          >
            {saving ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Row
// ---------------------------------------------------------------------------
function UserRow({ user, onUpdated }: { user: AdminUser; onUpdated: (u: AdminUser) => void }) {
  const [editing, setEditing] = useState(false);
  const [role,    setRole]    = useState<Role>(user.role);
  const [team,    setTeam]    = useState<Team | "">(user.team ?? "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  function handleRoleChange(newRole: Role) {
    setRole(newRole);
    if (newRole === "OBSERVER") setTeam("");
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ role, team: role === "OBSERVER" ? null : (team || null) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Update failed."); return; }
    onUpdated(data as AdminUser);
    setEditing(false);
  }

  async function toggleActive() {
    setSaving(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !user.isActive }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) onUpdated(data as AdminUser);
    else setError(data.error ?? "Update failed.");
  }

  return (
    <tr className={`border-b border-neutral-800 ${!user.isActive ? "opacity-50" : ""}`}>
      <td className="px-4 py-3">
        <p className="text-sm text-neutral-200">{user.name}</p>
        <p className="text-xs text-neutral-500 font-mono">{user.email}</p>
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
            className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-neutral-300">{ROLE_LABEL[user.role]}</span>
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          role === "OBSERVER" ? (
            <span className="text-xs text-neutral-600 italic">N/A</span>
          ) : (
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value as Team | "")}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
            >
              {TEAMS.map((t) => (
                <option key={t} value={t}>{t || "— None —"}</option>
              ))}
            </select>
          )
        ) : (
          <span className="text-xs font-mono text-neutral-400">{user.team ? TEAM_LABEL[user.team] : "—"}</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-neutral-500">
        {formatUtc(user.lastLoginAt)}
      </td>
      <td className="px-4 py-3 text-xs text-neutral-500">
        {user.isActive ? (
          <span className="text-green-400">Active</span>
        ) : (
          <span className="text-neutral-600">Inactive</span>
        )}
      </td>
      <td className="px-4 py-3">
        {error && <p className="text-xs text-red-400 mb-1">{error}</p>}
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setEditing(false); setRole(user.role); setTeam(user.team ?? ""); setError(""); }}
                className="text-xs px-2 py-1 text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded"
              >
                Edit
              </button>
              <button
                onClick={toggleActive}
                disabled={saving}
                className="text-xs px-2 py-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-300 rounded"
              >
                {user.isActive ? "Deactivate" : "Activate"}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------
interface AdminUsersClientProps {
  isLdap: boolean;
}

export function AdminUsersClient({ isLdap }: AdminUsersClientProps) {
  const [users,       setUsers]       = useState<AdminUser[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [roleFilter,  setRoleFilter]  = useState<Role | "">("");
  const [showInactive, setShowInactive] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)      params.set("search",       search);
    if (roleFilter)  params.set("role",          roleFilter);
    if (showInactive) params.set("showInactive", "true");
    const res = await fetch(`/api/admin/users?${params.toString()}`);
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, [search, roleFilter, showInactive]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function handleCreated(u: AdminUser) {
    setUsers((prev) => [u, ...prev]);
  }

  function handleUpdated(updated: AdminUser) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">User Management</h1>
        <CreateUserForm onCreated={handleCreated} isLdap={isLdap} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-blue-500 w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "")}
          className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-blue-500"
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-neutral-600">No users found.</p>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-neutral-900 border-b border-neutral-800">
              <tr>
                {["User", "Role", "Team", "Last Login", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-neutral-950">
              {users.map((u) => (
                <UserRow key={u.id} user={u} onUpdated={handleUpdated} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
