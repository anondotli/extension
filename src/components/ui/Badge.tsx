import type { ComponentChildren } from "preact";
import { clsx } from "./clsx";

type Variant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

interface BadgeProps {
  variant?: Variant;
  children: ComponentChildren;
  class?: string;
}

export function Badge({ variant = "default", children, class: className }: BadgeProps) {
  return (
    <span
      class={clsx(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "default" && "border-transparent bg-primary text-primary-foreground",
        variant === "secondary" && "border-transparent bg-secondary text-secondary-foreground",
        variant === "success" && "border-transparent bg-success text-success-foreground",
        variant === "warning" && "border-transparent bg-yellow-500 text-white",
        variant === "destructive" && "border-transparent bg-destructive text-destructive-foreground",
        variant === "outline" && "border-border text-foreground bg-transparent",
        className
      )}
    >
      {children}
    </span>
  );
}
