import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "secondary";
type ButtonSize = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
  outline:
    "border border-border bg-background hover:bg-secondary disabled:opacity-50",
  ghost: "hover:bg-secondary disabled:opacity-50",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "rounded-lg px-4 py-2 text-sm font-medium",
  sm: "h-8 rounded-lg px-3 text-sm font-medium",
  lg: "h-11 rounded-lg px-6 text-base font-medium",
  icon: "size-9 rounded-lg p-0",
};

export function buttonClassName({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 transition-colors",
    sizeClasses[size],
    variantClasses[variant],
    className,
  );
}

export function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
}
