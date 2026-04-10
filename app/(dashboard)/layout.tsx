import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AppSidebar } from "@/components/AppNav";
import { ToastProvider } from "@/components/ui/Toast";
import { KeyboardHandler } from "@/components/KeyboardHandler";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const { id: userId, team: userTeam } = session.user;
  const notifWhere: Prisma.NotificationWhereInput = {
    isRead: false,
    OR: [
      { targetUserId: userId },
      ...(userTeam ? [{ targetTeam: userTeam, targetUserId: null }] : []),
    ],
  };
  const unreadCount = await prisma.notification.count({ where: notifWhere });

  return (
    <ToastProvider>
      <div className="flex h-screen bg-neutral-950 text-white overflow-hidden">
        <AppSidebar unreadCount={unreadCount} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <header className="flex-shrink-0 h-12 bg-neutral-900 border-b border-neutral-800 flex items-center px-6">
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <span className="text-neutral-500 text-xs font-mono">
                {session.user.role}
                {session.user.team ? ` · ${session.user.team}` : ""}
              </span>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>

        <KeyboardHandler />
      </div>
    </ToastProvider>
  );
}
