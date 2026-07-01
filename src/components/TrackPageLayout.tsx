import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TrackPageLayoutProps {
  nav?: ReactNode;
  children: ReactNode;
}

export function TrackPageLayout({ nav, children }: TrackPageLayoutProps) {
  return (
    <div
      className={cn(
        nav != null &&
          "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8",
      )}
    >
      {nav != null && (
        <div className="relative hidden h-0 min-h-full min-w-0 lg:block">
          {nav}
        </div>
      )}
      <div className="min-w-0 [contain:layout]">{children}</div>
    </div>
  );
}
