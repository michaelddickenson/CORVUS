"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Role } from "@prisma/client";
import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Icon components (inline SVG, no emojis)
// ---------------------------------------------------------------------------
function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function IconFolder({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function IconRaven({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M22 9.5 L17.5 7.5 C16 5.5 13.5 4.5 11.5 5.5 C9.5 6.5 8.5 8.5 7.5 11 C6.5 13 5.5 15.5 5 17 L4 20 L7 21.5 C8.5 21 10 20 11.5 19 C13.5 18 16 16 18 13.5 C19.5 12 20 11 19.5 10.5 Z" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function IconCog({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function IconSignOut({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Notification types
// ---------------------------------------------------------------------------
interface NotificationItem {
  id:        string;
  message:   string;
  createdAt: string;
  case:      { id: string; caseId: string };
}

// ---------------------------------------------------------------------------
// Notification panel
// ---------------------------------------------------------------------------
function NotificationPanel({
  unreadCount,
  collapsed,
  onClose,
  onRead,
}: {
  unreadCount: number;
  collapsed:   boolean;
  onClose:     () => void;
  onRead:      (delta: number) => void;
}) {
  const [items,      setItems]      = useState<NotificationItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleMarkOne(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setItems((prev) => prev.filter((n) => n.id !== id));
    onRead(1);
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    const count = items.length;
    setItems([]);
    onRead(count);
    setMarkingAll(false);
  }

  function formatTime(iso: string) {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }

  const leftOffset = collapsed ? "left-14" : "left-56";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className={`fixed ${leftOffset} top-0 h-screen w-80 z-50 bg-neutral-900 border-r border-neutral-800 shadow-2xl flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-blue-700 text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="text-xs text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
              <IconX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-neutral-500 text-xs text-center py-8">Loading...</p>
          )}
          {!loading && items.length === 0 && (
            <p className="text-neutral-600 text-xs text-center py-8">No unread notifications.</p>
          )}
          {!loading && items.map((n) => (
            <div
              key={n.id}
              className="px-4 py-3 border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/cases/${n.case.id}`}
                    onClick={() => handleMarkOne(n.id)}
                    className="font-mono text-xs text-blue-400 hover:text-blue-300"
                  >
                    {n.case.caseId}
                  </Link>
                  <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-neutral-600 mt-1 font-mono">{formatTime(n.createdAt)}</p>
                </div>
                <button
                  onClick={() => handleMarkOne(n.id)}
                  className="flex-shrink-0 text-neutral-700 hover:text-neutral-400 transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
                  title="Mark as read"
                >
                  <IconX className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Nav item definition
// ---------------------------------------------------------------------------
interface NavItem {
  href:   string;
  label:  string;
  icon:   (props: { className?: string }) => JSX.Element;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/cases",     label: "Cases",     icon: IconFolder    },
  { href: "/reports",   label: "Reports",   icon: IconChart     },
];

const adminNavItems: NavItem[] = [
  { href: "/admin",       label: "Overview",  icon: IconCog       },
  { href: "/admin/users", label: "Users",     icon: IconUsers     },
  { href: "/admin/audit", label: "Audit Log", icon: IconClipboard },
];

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------
export function AppSidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const [panelOpen,   setPanelOpen]   = useState(false);
  const [localUnread, setLocalUnread] = useState(unreadCount);
  const [collapsed,   setCollapsed]   = useState(false);

  // Sync prop changes into local state
  useEffect(() => { setLocalUnread(unreadCount); }, [unreadCount]);

  // Restore collapse state from localStorage (after hydration)
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  function handleRead(delta: number) {
    setLocalUnread((prev) => Math.max(0, prev - delta));
  }

  return (
    <>
      <aside
        className={`flex-shrink-0 bg-neutral-900 border-r border-neutral-800 flex flex-col h-full transition-all duration-200 ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        {/* Logo */}
        <div className={`border-b border-neutral-800 flex items-center gap-2.5 h-14 flex-shrink-0 ${collapsed ? "px-3 justify-center" : "px-4"}`}>
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
            <IconRaven className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <p className="text-white text-sm font-semibold leading-tight truncate">CORVUS</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 rounded text-sm transition-colors ${
                  collapsed ? "px-2.5 py-2 justify-center" : "px-2.5 py-2"
                } ${
                  isActive
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          {/* Admin section — ADMIN role only */}
          {userRole === Role.ADMIN && (
            <div className={collapsed ? "pt-3" : "pt-3"}>
              {!collapsed && (
                <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
                  Admin
                </p>
              )}
              {adminNavItems.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded text-sm transition-colors ${
                      collapsed ? "px-2.5 py-2 justify-center" : "px-2.5 py-2"
                    } ${
                      isActive
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Notifications bell button */}
          <button
            onClick={() => setPanelOpen((o) => !o)}
            title={collapsed ? "Notifications" : undefined}
            className={`w-full flex items-center gap-2.5 rounded text-sm transition-colors ${
              collapsed ? "px-2.5 py-2 justify-center" : "px-2.5 py-2"
            } ${
              panelOpen
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
            }`}
          >
            <div className="relative flex-shrink-0">
              <IconBell className="w-4 h-4" />
              {localUnread > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {localUnread > 99 ? "99+" : localUnread}
                </span>
              )}
            </div>
            {!collapsed && (
              <>
                Notifications
                {localUnread > 0 && (
                  <span className="ml-auto bg-blue-900 text-blue-300 text-xs px-1.5 py-0.5 rounded-full">
                    {localUnread}
                  </span>
                )}
              </>
            )}
          </button>
        </nav>

        {/* Collapse toggle */}
        <div className="px-2 pb-1">
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`w-full flex items-center rounded text-xs text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800/50 transition-colors py-1.5 ${
              collapsed ? "justify-center px-2" : "px-2.5 gap-1.5"
            }`}
          >
            {collapsed ? (
              <IconChevronRight className="w-3.5 h-3.5" />
            ) : (
              <>
                <IconChevronLeft className="w-3.5 h-3.5" />
                Collapse
              </>
            )}
          </button>
        </div>

        {/* User + sign-out */}
        <div className="px-2 py-3 border-t border-neutral-800">
          {!collapsed && session?.user && (
            <div className="px-2.5 py-2 mb-1">
              <p className="text-white text-xs font-medium truncate">{session.user.name}</p>
              <p className="text-neutral-500 text-xs truncate">{session.user.role}</p>
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title={collapsed ? "Sign out" : undefined}
            className={`w-full flex items-center gap-2.5 rounded text-sm text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-colors py-2 ${
              collapsed ? "justify-center px-2" : "px-2.5"
            }`}
          >
            <IconSignOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {/* Notification slide-out panel */}
      {panelOpen && (
        <NotificationPanel
          unreadCount={localUnread}
          collapsed={collapsed}
          onClose={() => setPanelOpen(false)}
          onRead={handleRead}
        />
      )}
    </>
  );
}
