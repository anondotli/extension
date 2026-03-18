
import { useState, useEffect, useCallback } from "preact/hooks";
import { clsx } from "./clsx";

export type ToastType = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastProps {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ items, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-14 left-3 right-3 flex flex-col gap-2 z-50 pointer-events-none">
      {items.map((item) => (
        <Toast key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 3000);
    return () => clearTimeout(t);
  }, [item.id, onDismiss]);

  return (
    <div
      style={{ maxWidth: "340px" }}
      class={clsx(
        "flex items-center gap-2.5 px-3.5 py-2.5 rounded-md text-sm font-medium pointer-events-auto luxury-shadow-sm border",
        item.type === "success" && "bg-success text-success-foreground border-transparent",
        item.type === "error" && "bg-destructive text-destructive-foreground border-transparent",
        item.type === "info" && "bg-primary text-primary-foreground border-transparent"
      )}
    >
      {item.type === "success" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {item.type === "error" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      <span className="flex-1 min-w-0">{item.message}</span>
      {item.action && (
        <button
          type="button"
          onClick={item.action.onClick}
          className="shrink-0 text-xs underline underline-offset-2 opacity-90 hover:opacity-100 transition-opacity"
        >
          {item.action.label}
        </button>
      )}
    </div>
  );
}

let toastCount = 0;

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = "info", action?: ToastAction) => {
    const id = `toast-${++toastCount}`;
    setItems((prev) => [...prev, { id, message, type, action }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { items, show, dismiss };
}
