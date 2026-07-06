"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import { TeamSwitcher } from "@/components/TeamSwitcher";
import { SidebarTutorialMenu } from "@/components/tutorial/SidebarTutorialMenu";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  {
    href: "/dashboard",
    label: "Home",
    isActive: (pathname: string) => pathname === "/dashboard",
  },
  {
    href: "/teams",
    label: "Teams",
    isActive: (pathname: string) =>
      pathname === "/teams" || pathname.startsWith("/teams/"),
  },
  {
    href: "/sessions",
    label: "Bingo sessions",
    isActive: (pathname: string) =>
      pathname === "/sessions" || pathname.startsWith("/sessions/"),
  },
] as const;

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function TeamsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function navIcon(label: string) {
  if (label === "Home") return <HomeIcon />;
  if (label === "Teams") return <TeamsIcon />;
  if (label === "Bingo sessions") return <SessionsIcon />;
  return null;
}

function UserAvatar({
  image,
  label,
}: {
  image?: string | null;
  label: string;
}) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function AppSidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const profileActive = pathname.startsWith("/profile");
  const displayName = session?.user?.name ?? session?.user?.email ?? "Profile";
  const avatarLabel = session?.user?.name ?? session?.user?.email ?? "?";
  const expanded = !collapsed || mobileOpen;

  async function handleSignOut() {
    await signOut({ redirect: false });
    window.location.assign("/login");
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh flex-col border-r border-zinc-200 bg-white transition-transform duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 lg:transition-none",
          expanded ? "w-64" : "w-16",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "lg:relative lg:sticky lg:top-0 lg:z-20 lg:h-dvh lg:max-h-dvh lg:shrink-0 lg:self-start",
        )}
      >
        <div
          className={cn(
            "flex border-b border-zinc-200 dark:border-zinc-800",
            expanded
              ? "items-center justify-between gap-2 px-3 py-4"
              : "flex-col items-center gap-2 px-2 py-3",
          )}
        >
          {expanded ? (
            <Link
              href="/dashboard"
              onClick={onMobileClose}
              className="min-w-0 text-lg font-semibold leading-tight text-emerald-600"
            >
              Bingo Playlist Configurator
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="flex size-10 items-center justify-center rounded-lg text-lg font-bold text-emerald-600 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              title="Bingo Playlist Configurator"
            >
              B
            </Link>
          )}

          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 lg:hidden dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="size-5" />
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 lg:inline-flex dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          </button>
        </div>

        <div
          data-tutorial="team-switcher"
          className={cn(
            "border-b border-zinc-200 dark:border-zinc-800",
            expanded ? "px-4 py-4" : "flex justify-center px-2 py-3",
          )}
        >
          {expanded ? (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Team</p>
              <TeamSwitcher fullWidth />
            </>
          ) : (
            <TeamSwitcher compact />
          )}
        </div>

        <nav className={cn("flex-1 space-y-1 py-4", expanded ? "px-3" : "px-2")}>
          {navItems.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                title={expanded ? undefined : item.label}
                data-tutorial={item.label === "Bingo sessions" ? "nav-sessions" : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  expanded ? "gap-3 px-3 py-2" : "justify-center p-2.5",
                  active
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                )}
              >
                {navIcon(item.label)}
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={cn("border-t border-zinc-200 dark:border-zinc-800", expanded ? "px-3 py-4" : "px-2 py-3")}>
          {session?.user && (
            <div className={cn("space-y-2", !expanded && "flex flex-col items-center")}>
              <SidebarTutorialMenu expanded={expanded} onNavigate={onMobileClose} />
              <Link
                href="/profile"
                onClick={onMobileClose}
                title={expanded ? undefined : displayName}
                className={cn(
                  "flex items-center rounded-lg transition-colors",
                  expanded ? "gap-3 px-3 py-2" : "justify-center p-1",
                  profileActive
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                )}
              >
                <UserAvatar image={session.user.image} label={avatarLabel} />
                {expanded && (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">Profile</p>
                  </div>
                )}
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                title={expanded ? undefined : "Sign out"}
                className={cn(
                  "rounded-lg border border-zinc-300 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900",
                  expanded ? "w-full px-3 py-1.5" : "flex size-10 items-center justify-center p-0",
                )}
              >
                {expanded ? (
                  "Sign out"
                ) : (
                  <LogOut className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
