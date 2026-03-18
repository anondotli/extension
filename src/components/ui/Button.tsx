import type { ComponentChildren } from "preact";
import { clsx } from "./clsx";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "icon";

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  class?: string;
  onClick?: (e: MouseEvent) => void;
  type?: "button" | "submit" | "reset";
  children: ComponentChildren;
  title?: string;
  "aria-label"?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  disabled,
  loading,
  class: className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      class={clsx(
        "inline-flex items-center justify-center font-medium rounded-md cursor-pointer",
        "transition-all duration-300",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        size === "sm" && "text-xs px-2.5 py-1.5 gap-1",
        size === "md" && "text-sm px-3 py-2 gap-1.5",
        size === "icon" && "w-7 h-7 p-0",
        variant === "primary" &&
          "bg-primary text-primary-foreground luxury-shadow-sm hover:scale-[1.02] active:scale-[0.98]",
        variant === "secondary" &&
          "bg-secondary text-secondary-foreground border border-border hover:bg-accent",
        variant === "outline" &&
          "border border-input bg-transparent text-foreground hover:bg-secondary/50 backdrop-blur-sm",
        variant === "ghost" &&
          "text-foreground hover:bg-accent/50",
        variant === "destructive" &&
          "bg-destructive text-destructive-foreground luxury-shadow-sm hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      {loading ? <Spinner size="xs" /> : null}
      {children}
    </button>
  );
}

function Spinner({ size }: { size: "xs" }) {
  return (
    <svg
      class={clsx("animate-spin", size === "xs" && "w-3 h-3")}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
