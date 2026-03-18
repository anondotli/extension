import { useState, useEffect, useRef } from "preact/hooks";

export interface MenuItem {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface MenuProps {
  items: MenuItem[];
}

export function Menu({ items }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus first item when menu opens
  useEffect(() => {
    if (open) {
      setFocusedIndex(0);
      requestAnimationFrame(() => {
        itemRefs.current[0]?.focus();
      });
    }
  }, [open]);

  // Focus item when focusedIndex changes
  useEffect(() => {
    if (open) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, open]);

  // Outside click handler
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleDropdownKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((i) => (i + 1) % items.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((i) => (i - 1 + items.length) % items.length);
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
      case "Tab":
        e.preventDefault();
        close();
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="true"
        aria-expanded={open}
        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
        title="More options"
        aria-label="More options"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5"/>
          <circle cx="12" cy="12" r="1.5"/>
          <circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-md luxury-shadow-sm min-w-[120px] overflow-hidden"
          role="menu"
          onKeyDown={handleDropdownKeyDown}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              ref={(el) => { itemRefs.current[i] = el; }}
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              class={`w-full text-left px-3 py-2 text-xs transition-colors ${
                item.variant === "destructive"
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground hover:bg-secondary/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
