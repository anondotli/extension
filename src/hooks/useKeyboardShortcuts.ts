import { useEffect } from "preact/hooks";
import { isInputFocused } from "../lib/keyboard";

interface ShortcutDef {
  handler: () => void;
  allowInInput?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: Record<string, ShortcutDef>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const def = shortcuts[e.key];
      if (!def) return;

      if (!def.allowInInput && isInputFocused()) return;

      e.preventDefault();
      def.handler();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}
