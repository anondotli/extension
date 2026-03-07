import { useEffect } from "preact/hooks";

interface ShortcutsHelpProps {
  onClose: () => void;
}

const shortcuts = [
  { key: "1", description: "Switch to Alias tab" },
  { key: "2", description: "Switch to Drop tab" },
  { key: "n", description: "Toggle create form" },
  { key: "/", description: "Focus search (Alias tab)" },
  { key: "j", description: "Next item in list" },
  { key: "k", description: "Previous item in list" },
  { key: "Enter", description: "Copy focused item" },
  { key: "?", description: "Toggle this help" },
];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm animate-slide-up"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col gap-4 p-5 rounded-2xl border border-border bg-card luxury-shadow-md max-w-[300px] w-full mx-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Keyboard Shortcuts
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between py-1 text-xs"
            >
              <span className="text-muted-foreground">{s.description}</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-foreground font-mono text-[11px] min-w-[24px] text-center">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
