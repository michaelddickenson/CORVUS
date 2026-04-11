import { AdminUsersClient } from "./_AdminUsersClient";

export const metadata = { title: "User Management — CORVUS" };

export default function AdminUsersPage() {
  const isLdap = Boolean(process.env.LDAP_URI);
  return <AdminUsersClient isLdap={isLdap} />;
}
