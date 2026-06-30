"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { isFullWidthPage } from "@/lib/page-layout";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const fullWidth = isFullWidthPage(pathname);

  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        <AppSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader onMenuClick={() => setMobileOpen(true)} />
          <main className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <div className={cn(fullWidth ? "w-full" : "mx-auto w-full max-w-5xl")}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
