"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  align = "right",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        {trigger}
      </div>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            "absolute top-full z-20 mt-1 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
          onMouseDown={(event) => event.preventDefault()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface DropdownMenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
}

export function DropdownMenuItem({
  children,
  onClick,
  href,
  target,
  rel,
  disabled = false,
  destructive = false,
  className,
}: DropdownMenuItemProps) {
  const itemClassName = cn(
    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
    destructive
      ? "text-destructive hover:bg-destructive/10"
      : "hover:bg-accent",
    disabled && "pointer-events-none opacity-50",
    className,
  );

  if (href && !disabled) {
    return (
      <a
        role="menuitem"
        href={href}
        target={target}
        rel={rel}
        className={itemClassName}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onClick?.();
      }}
      className={itemClassName}
    >
      {children}
    </button>
  );
}
