import { useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = "teacher" | "student" | "parent";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Nav definitions per role
// ---------------------------------------------------------------------------

const teacherNav: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Questions", path: "/questions", icon: <BookOpen size={20} /> },
  { label: "Assessments", path: "/assessments", icon: <ClipboardList size={20} /> },
  { label: "Classrooms", path: "/classrooms", icon: <Users size={20} /> },
  { label: "Settings", path: "/settings", icon: <Settings size={20} /> },
];

const studentNav: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Classrooms", path: "/classrooms", icon: <Users size={20} /> },
  { label: "Assessments", path: "/assessments", icon: <ClipboardList size={20} /> },
];

const parentNav: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
  { label: "Classrooms", path: "/classrooms", icon: <Users size={20} /> },
];

const navByRole: Record<Role, NavItem[]> = {
  teacher: teacherNav,
  student: studentNav,
  parent: parentNav,
};

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

interface SidebarProps {
  /** Role determines visible nav items. Defaults to "teacher" until Clerk metadata wired. */
  role?: Role;
  /** Controlled mobile open state */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ role = "teacher", mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const navItems = navByRole[role];

  const sidebarWidth = collapsed
    ? "var(--sidebar-width-collapsed)"
    : "var(--sidebar-width)";

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-30 h-full flex flex-col",
          "bg-[var(--color-card)] border-r border-[var(--color-border)]",
          "transition-all duration-200 ease-in-out",
          // Desktop: always visible; mobile: slide in/out
          "md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ width: sidebarWidth }}
      >
        {/* Logo area */}
        <div
          className="flex items-center px-4 shrink-0 border-b border-[var(--color-border)]"
          style={{ height: "var(--header-height)" }}
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{ background: "var(--color-primary)" }}
          >
            <span
              className="text-white text-sm font-bold"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              T
            </span>
          </div>
          {!collapsed && (
            <span
              className="ml-3 text-base font-semibold truncate"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-foreground)",
              }}
            >
              Teaching
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.path ||
              (item.path !== "/dashboard" && currentPath.startsWith(item.path));

            return (
              <button
                key={item.path}
                onClick={() => {
                  router.navigate({ to: item.path });
                  onMobileClose?.();
                }}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
                  "transition-colors duration-150",
                  isActive
                    ? "font-semibold"
                    : "font-normal hover:bg-[var(--color-muted)]",
                  collapsed && "justify-center"
                )}
                style={
                  isActive
                    ? {
                        background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                        color: "var(--color-primary)",
                      }
                    : { color: "var(--color-muted-foreground)" }
                }
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="shrink-0 p-2 border-t border-[var(--color-border)]">
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "w-full flex items-center justify-center h-9 rounded-xl",
              "hover:bg-[var(--color-muted)] transition-colors",
              "text-[var(--color-muted-foreground)]"
            )}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>
    </>
  );
}
