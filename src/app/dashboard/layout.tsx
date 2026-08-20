"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Brain,
  CalendarDays,
  ChevronsLeft,
  FileText,
  LayoutGrid,
  LogOut,
  MessageSquare,
  Settings,
  Upload,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navigation is grouped by intent rather than listed flat: what you are
 * working with, what you study from, and how the system is behaving.
 */
const navGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutGrid },
      { label: "Documents", href: "/dashboard/documents", icon: FileText },
      { label: "Chat", href: "/dashboard/chat", icon: MessageSquare },
    ],
  },
  {
    label: "Study",
    items: [
      { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
      { label: "Flashcards", href: "/dashboard/flashcards", icon: BookOpen },
      { label: "Quizzes", href: "/dashboard/quizzes", icon: Brain },
    ],
  },
  {
    label: "System",
    items: [{ label: "Pipeline", href: "/dashboard/pipeline", icon: Activity }],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss the account menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-line bg-surface-50 transition-[width] duration-200",
          collapsed ? "w-[60px]" : "w-[228px]"
        )}
      >
        {/* ── Identity ── */}
        <div className="flex h-14 items-center gap-2.5 px-3.5">
          <Link
            href="/"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-900 font-mono text-sm font-bold text-white"
            aria-label="Arcus home"
          >
            A
          </Link>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-surface-900">
                Arcus
              </p>
              <p className="font-mono text-2xs text-surface-400">
                hybrid retrieval
              </p>
            </div>
          )}
        </div>

        {/* ── Primary action ── */}
        <div className="px-2.5 pb-3">
          <Link
            href="/dashboard/documents"
            className={cn(
              "flex h-8 items-center gap-2 rounded-md bg-surface-900 text-sm font-medium text-white transition-colors hover:bg-surface-800",
              collapsed ? "justify-center px-0" : "px-2.5"
            )}
            title={collapsed ? "Upload document" : undefined}
          >
            <Upload className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {!collapsed && <span>Upload</span>}
          </Link>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-2.5 pb-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-2 font-mono text-2xs tracking-[0.12em] text-surface-400 uppercase">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-8 items-center gap-2.5 rounded-md text-sm transition-colors",
                        collapsed ? "justify-center px-0" : "px-2",
                        active
                          ? "bg-surface-200/70 font-medium text-surface-900"
                          : "text-surface-500 hover:bg-surface-100 hover:text-surface-900"
                      )}
                    >
                      {/* The accent appears only here — it marks where you are. */}
                      {active && (
                        <span className="absolute top-1/2 -left-2.5 h-4 w-[2px] -translate-y-1/2 rounded-r bg-arcus-600" />
                      )}
                      <item.icon
                        className="h-4 w-4 shrink-0"
                        strokeWidth={active ? 2 : 1.75}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Account ── */}
        <div className="border-t border-line p-2.5" ref={menuRef}>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={cn(
                "flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-surface-100",
                collapsed && "justify-center"
              )}
            >
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-200 font-mono text-2xs font-semibold text-surface-600">
                  {session?.user?.name?.[0]?.toUpperCase() ?? (
                    <User className="h-3 w-3" />
                  )}
                </span>
              )}
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-surface-800">
                    {session?.user?.name ?? "Account"}
                  </span>
                  <span className="block truncate font-mono text-2xs text-surface-400">
                    {session?.user?.email ?? ""}
                  </span>
                </span>
              )}
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-50 mb-1.5 w-full min-w-[200px] overflow-hidden rounded-lg border border-line bg-surface-0 shadow-lg"
              >
                <Link
                  href="/dashboard/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-surface-600 transition-colors hover:bg-surface-50 hover:text-surface-900"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Link>
                <button
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-2.5 border-t border-line px-3 py-2 text-sm text-surface-600 transition-colors hover:bg-err-soft hover:text-err"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              "mt-1 flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-xs text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700",
              collapsed && "justify-center px-0"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronsLeft
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform",
                collapsed && "rotate-180"
              )}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
