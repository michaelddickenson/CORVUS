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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 369.728 369.728"
      className={className}
      fill="currentColor"
    >
      <path d="M369.016,240.962c-1.982-1.651-13.604-8.932-28.318-18.149c-21.381-13.395-53.554-33.55-55.862-36.658c0.051-0.224,0.302-0.402,1.534-0.402c0.628,0,1.366,0.052,2.22,0.111c1.071,0.075,2.285,0.16,3.588,0.16c1.722,0,3.254-0.151,4.686-0.462c1.621-0.353,2.052-1.345,2.165-1.904c0.783-3.888-10.221-13.857-32.708-29.631c-11.753-8.245-16.994-9.599-20.462-10.495c-2.218-0.572-3.331-0.86-5.022-2.763c-2.172-2.443-10.525-8.399-20.196-15.296c-11.589-8.264-24.724-17.63-29.655-22.713c-21.789-22.457-54.663-22.715-56.051-22.715c-0.582,0-1.032,0.015-1.404,0.039c-4.27,0-36.225-12.942-40.845-15.075c-0.827-0.381-2.082-1.084-3.535-1.898c-5.356-3.001-13.451-7.536-20.434-8.002c-4.785-0.318-12.451,1.678-19.147,3.431c-4.931,1.29-9.588,2.51-12.029,2.51c-0.337,0-0.619-0.023-0.837-0.07l-0.053-0.01c-2.918-0.703-7.352-1.446-11.13-1.446c-1.152,0-2.18,0.074-3.057,0.211C17.398,60.535-0.232,74.362,0.002,77.347c0.056,0.704,0.657,1.407,1.985,1.113c3.827-0.842,7.6-1.242,11.214-1.242c12.508,0,19.471,4.738,20.449,6.738c-0.013,0-0.027,0-0.041,0c-6.262,0-19.425,1.521-25.129,2.743c-1.325,0.283-2.742,0.631-2.795,1.822c-0.066,1.485,1.999,2.122,6.522,3.519c1.74,0.537,3.712,1.146,5.466,1.808c6.368,2.404,15.324,7.514,15.884,7.865c2.551,1.854,3.977,6.791,5.628,12.507c3.561,12.323,8.438,29.202,29.065,34.702c18.888,5.037,33.491,22.67,42.415,36.574c5.819,9.066,24.424,28.869,40.037,43.752c-0.004,2.406,0.066,5.926,0.196,11.127c0.173,6.914,0.37,14.754,0,17.067c-0.531,3.315-8.24,13.198-12.702,17.506c-0.229-0.005-0.459-0.017-0.687-0.017c-1.549,0-2.982,0.13-4.24,0.376c-6.329-4.207-13.989-6.656-21.033-6.656c-3.022,0-5.613,0.529-7.296,1.429c-3.477,1.863-3.711,5.94-3.468,6.908l0.235,0.965h0.78l0.806-0.198l0.2-0.865c0.227-0.84,2.645-3.483,6.599-3.483c2.231,0,4.519,0.839,6.799,2.5c1.543,1.123,1.851,1.836,1.79,2.083c-0.111,0.449-1.368,1.07-3.28,1.348c-4.883,0.713-9.731,1.854-15.33,8.16c-1.649,1.857-1.993,2.202-1.667,2.927l0.31,0.527h0.647c0.414,0,0.747-0.11,1.848-0.75c2.436-1.415,7.503-4.277,13.139-4.63c1.038-0.065,2.051-0.098,3.011-0.098c5.162,0,8.325,0.921,11.383,1.813c1.112,0.324,2.202,0.637,3.343,0.896c-2.153,1.169-4.379,2.895-6.74,5.554c-1.649,1.857-1.993,2.123-1.667,2.847l0.31,0.368h0.647c0.414,0,0.747,0.05,1.848-0.591c2.436-1.415,7.504-4.117,13.14-4.47c1.039-0.065,2.053-0.099,3.013-0.099c5.162,0,8.323,0.922,11.381,1.813c2.662,0.776,5.176,1.509,8.653,1.509c2.666,0,5.672-0.443,9.189-1.354c6.413-1.661,13.962,0.347,21.201,5.539l0.179,0.128c0.287,0.203,0.562,0.303,0.841,0.303l0.579-0.037l0.3-0.397c0.242-0.319,0.294-0.73,0.156-1.221c-0.444-1.569-2.392-5.008-5.728-7.551c-5.32-4.058-7.794-4.529-9.601-4.874c-0.968-0.185-1.645-0.313-2.573-0.968c0.618-1.183,3.475-4.214,5.809-6.691c5.769-6.123,9.552-10.327,9.574-12.878c0.017-1.956,2.153-11.066,3.869-18.387c0.483-2.061,0.881-3.758,1.208-5.169c8.888-0.849,16.551-2.391,20.494-3.186l0.832-0.168c2.198-0.439,4.23-0.976,6.023-1.448c2.888-0.762,5.382-1.419,7.515-1.419c1.864,0,3.349,0.515,4.674,1.619c3.352,2.793,13.476,9.055,23.267,15.11c4.127,2.553,8.024,4.964,11.438,7.125c6.972,4.416,24.304,23.433,36.959,37.317c12.478,13.691,13.535,14.688,14.456,14.688l0.532-0.019l0.3-0.385c0.122-0.156,0.308-0.492,0.185-0.985c-0.021-0.084-0.034-0.152-0.042-0.209c0.729,0.054,2.686,0.687,7.862,4.014c1.337,0.859,1.913,1.036,2.366,1.036c0.475,0,0.888-0.235,1.104-0.63c0.551-1.004-0.204-2.26-3.489-7.416c-1.599-2.51-3.589-5.634-5.57-9.1c-3.031-5.306-15.467-22.157-28.632-39.998c-13.272-17.985-26.986-36.569-29.678-41.557c5.662,0.415,32.071,13.312,51.438,22.771c18.631,9.098,26.389,12.804,28.087,12.805h0.001c0.495,0,0.785-0.223,0.94-0.409c0.222-0.267,0.315-0.609,0.263-0.965c-0.226-1.527-4.014-4.233-16.927-12.745c-4.724-3.113-10.321-6.803-13.061-8.926c4.381,1.085,13.837,4.165,22.373,6.946c14.682,4.782,24.486,7.918,26.904,7.918c0.897,0,1.241-0.431,1.372-0.792C369.854,242.017,369.638,241.481,369.016,240.962z M176.174,246.693c0.173,6.913,0.37,14.747,0,17.059c-0.651,4.066-12.092,17.993-15.107,19.422c-4.131-3.145-5.855-3.901-6.914-4.108c-0.676-0.337-1.363-0.649-2.055-0.948c0.823-1.311,3.456-4.112,5.652-6.442c5.769-6.123,9.551-10.327,9.574-12.877c0.017-1.977,2.285-10.954,3.941-17.508c0.036-0.144,0.07-0.279,0.106-0.419c1.494,0.298,3.053,0.547,4.685,0.741C176.086,243.1,176.126,244.78,176.174,246.693z" />
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

function IconIoc({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
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
  { href: "/dashboard", label: "Dashboard",   icon: IconDashboard },
  { href: "/cases",     label: "Cases",       icon: IconFolder    },
  { href: "/iocs",      label: "IOC Manager", icon: IconIoc       },
  { href: "/reports",   label: "Reports",     icon: IconChart     },
];

const adminNavItems: NavItem[] = [
  { href: "/admin",        label: "Overview",      icon: IconCog       },
  { href: "/admin/users",  label: "Users",          icon: IconUsers     },
  { href: "/admin/audit",  label: "Audit Log",      icon: IconClipboard },
  { href: "/admin/config", label: "Configuration",  icon: IconCog       },
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
          <IconRaven className="w-6 h-6 text-white flex-shrink-0" />
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

          {/* Admin section — ADMIN role only (not shown to OBSERVER) */}
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
              <p className={`text-xs truncate ${session.user.role === "OBSERVER" ? "text-amber-600" : "text-neutral-500"}`}>
                {session.user.role === "OBSERVER" ? "OBSERVER (read-only)" : session.user.role}
              </p>
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
