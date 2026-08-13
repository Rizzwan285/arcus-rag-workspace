"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  FileText,
  MessageSquare,
  BookOpen,
  Brain,
  LayoutDashboard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Upload,
  Sparkles,
  LogOut,
  User,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Documents",
    href: "/dashboard/documents",
    icon: FileText,
  },
  {
    label: "Chat",
    href: "/dashboard/chat",
    icon: MessageSquare,
  },
  {
    label: "Flashcards",
    href: "/dashboard/flashcards",
    icon: BookOpen,
  },
  {
    label: "Quizzes",
    href: "/dashboard/quizzes",
    icon: Brain,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <div className="flex h-screen bg-surface-50">
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "flex flex-col border-r border-surface-200 bg-white transition-all duration-300",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-surface-200 px-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-arcus-500 to-arcus-700 font-bold text-white shadow-md">
            A
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-surface-900">
              Arcus
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-arcus-50 text-arcus-700 shadow-sm"
                    : "text-surface-500 hover:bg-surface-100 hover:text-surface-900"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0 transition-colors",
                    isActive
                      ? "text-arcus-600"
                      : "text-surface-400 group-hover:text-surface-600"
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Upload Button */}
        <div className="border-t border-surface-200 p-3">
          <Link
            href="/dashboard/documents"
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-arcus-600 to-arcus-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-arcus-600/20 transition-all hover:shadow-arcus-600/30",
              collapsed ? "px-2" : ""
            )}
          >
            <Upload className="h-4 w-4" />
            {!collapsed && <span>Upload Document</span>}
          </Link>
        </div>

        {/* Collapse Toggle */}
        <div className="border-t border-surface-200 p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg py-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-surface-200 bg-white/80 px-8 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-arcus-500" />
            <span className="text-sm text-surface-500">
              AI-Powered Academic Workspace
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600">
              <Settings className="h-5 w-5" />
            </button>

            {/* User Avatar & Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-surface-100"
              >
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-surface-200"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-arcus-500 to-purple-500 text-xs font-bold text-white">
                    {session?.user?.name?.[0] || <User className="h-4 w-4" />}
                  </div>
                )}
              </button>

              {/* Dropdown */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-surface-200 bg-white shadow-xl">
                    <div className="border-b border-surface-100 p-4">
                      <p className="truncate text-sm font-semibold text-surface-900">
                        {session?.user?.name || "User"}
                      </p>
                      <p className="truncate text-xs text-surface-500">
                        {session?.user?.email || ""}
                      </p>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
