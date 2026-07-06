"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { TutorialProvider } from "@/components/tutorial/TutorialProvider";
import { Toaster } from "@/components/ui/sonner";
import { isFullWidthPage, isSplitNavPage } from "@/lib/page-layout";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const fullWidth = isFullWidthPage(pathname);
  const splitNav = isSplitNavPage(pathname);

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed, hydrated]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((value) => !value);
  }

  return (
    <SessionProvider>
      <TutorialProvider>
      <Toaster />
      <div className="flex min-h-screen">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader onMenuClick={() => setMobileOpen(true)} />
          <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <div
              className={cn(
                fullWidth || splitNav ? "w-full" : "mx-auto w-full max-w-5xl",
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
      </TutorialProvider>
    </SessionProvider>
  );
}
