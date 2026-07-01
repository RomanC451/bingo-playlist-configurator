import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TrackPageLayoutProps {
  nav?: ReactNode;
  children: ReactNode;
  /** Keep main content in max-w-5xl while nav spans the left edge (review page). */
  constrainContent?: boolean;
}

export function TrackPageLayout({ nav, children, constrainContent }: TrackPageLayoutProps) {
  return (
    <div
      className={cn(
        nav != null &&
          "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]",
        nav != null && (constrainContent ? "lg:gap-4" : "lg:gap-8"),
      )}
    >
      {nav != null && (
        <div className="relative hidden h-0 min-h-full min-w-0 lg:block">
          {nav}
        </div>
      )}
      <div
        className={cn(
          "min-w-0 [contain:layout]",
          constrainContent && "mx-auto w-full max-w-5xl",
        )}
      >
        {children}
      </div>
    </div>
  );
}
