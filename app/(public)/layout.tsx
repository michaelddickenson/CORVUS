// Public layout — no auth, no sidebar.
// Used by shareable read-only case summary pages.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
