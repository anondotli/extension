import { forwardRef } from "preact/compat";
import { clsx } from "./clsx";

interface InputProps {
  value?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  class?: string;
  onInput?: (e: Event) => void;
  onChange?: (e: Event) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  id?: string;
  name?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ class: className, ...props }, ref) => {
    return (
      <input
        {...props}
        ref={ref}
        class={clsx(
          "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
          "text-foreground placeholder:text-muted-foreground",
          "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
    );
  }
);
