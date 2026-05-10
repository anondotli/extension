import { useState } from "preact/hooks";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Toggle } from "./ui/Toggle";

interface VaultPanelProps {
  email: string;
  supported: boolean;
  trustSupported: boolean;
  status: "locked" | "unlocking" | "unlocked";
  error: string | null;
  onUnlock: (password: string, trustBrowser: boolean) => Promise<void>;
  onLock: () => Promise<void>;
  onClose: () => void;
}

export function VaultPanel({
  email,
  supported,
  trustSupported,
  status,
  error,
  onUnlock,
  onLock,
  onClose,
}: VaultPanelProps) {
  const [password, setPassword] = useState("");
  const [trustBrowser, setTrustBrowser] = useState(trustSupported);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!password || status === "unlocking") {
      return;
    }

    try {
      await onUnlock(password, trustBrowser);
      setPassword("");
    } catch {
      // Error state is owned by the parent.
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <span className="text-sm font-medium text-foreground">Vault</span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Close vault"
          aria-label="Close vault"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            {status === "unlocked" ? "Vault unlocked" : "Unlock encrypted data"}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {status === "unlocked"
              ? `Unlocked for ${email}. Alias metadata and drop keys are available in this extension session.`
              : "Alias labels, notes, and saved drop keys stay encrypted until you unlock with your password."}
          </p>
        </div>

        {!supported ? (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            This browser does not support the Web Crypto APIs required for vault features.
          </div>
        ) : status === "unlocked" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Trusted browser</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Future popups can restore the wrapped vault key locally.
                </p>
              </div>
              <span className="text-xs text-success">Active</span>
            </div>
            <Button variant="outline" onClick={() => void onLock()}>
              Lock vault
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              autoComplete="current-password"
              placeholder="Vault password"
              minLength={12}
            />

            <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Trust this browser</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Keep a wrapped vault key locally for faster unlock next time.
                </p>
              </div>
              <Toggle
                checked={trustBrowser}
                onChange={() => setTrustBrowser((value) => !value)}
                disabled={!trustSupported}
              />
            </div>

            {!trustSupported && (
              <p className="text-xs text-muted-foreground">
                Persistent unlock is unavailable because secure local key storage is blocked in this browser.
              </p>
            )}

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" class="flex-1" loading={status === "unlocking"}>
                {status === "unlocking" ? "Unlocking…" : "Unlock"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
