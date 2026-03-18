
import { clsx } from "./clsx";

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function Toggle({ checked, onChange, disabled, loading }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || loading}
      onClick={onChange}
      class={clsx(
        "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
        (disabled || loading) && "opacity-50 cursor-not-allowed"
      )}
    >
      {loading ? (
        <svg
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-foreground"
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
      ) : (
        <span
          class={clsx(
            "inline-block h-3 w-3 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      )}
    </button>
  );
}
