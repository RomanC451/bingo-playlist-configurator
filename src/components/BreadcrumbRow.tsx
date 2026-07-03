import { cn } from "@/lib/utils";

interface BreadcrumbRowProps {
  breadcrumb: React.ReactNode;
  action: React.ReactNode;
  className?: string;
}

export function BreadcrumbRow({ breadcrumb, action, className }: BreadcrumbRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <div className="min-w-0 grow-[999] basis-auto">{breadcrumb}</div>
      <div className="grow basis-auto [&>button]:w-full">{action}</div>
    </div>
  );
}
