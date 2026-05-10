import { useState } from "preact/hooks";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Toggle } from "./ui/Toggle";

interface VaultUnlockScreenProps {
  email: string;
  supported: boolean;
  trustSupported: boolean;
  unlocking: boolean;
  error: string | null;
  onUnlock: (password: string, trustBrowser: boolean) => Promise<void>;
}

export function VaultUnlockScreen({
  email,
  supported,
  trustSupported,
  unlocking,
  error,
  onUnlock,
}: VaultUnlockScreenProps) {
  const [password, setPassword] = useState("");
  const [trustBrowser, setTrustBrowser] = useState(trustSupported);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!password || unlocking) return;
    try {
      await onUnlock(password, trustBrowser);
      setPassword("");
    } catch {
      // Parent owns the error display.
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <svg
            role="img"
            viewBox="0 0 74.4482 80.1979"
            fill="currentColor"
            height="40"
            width="37.2"
            className="text-foreground"
            aria-label="anon.li logo"
          >
            <path d="M35.7493 80.0307c-11.8-4.1933-24.826-17.7872-30.599-31.9333-1.4649-3.5892-1.4868-3.8341-.2161-2.4151 1.491 1.6651 2.7252 2.7875 3.9088 3.5544.7994.518 1.3515 1.2376 2.2164 2.8886 5.089 9.7142 13.0484 17.6656 23.1522 23.1285 3.0907 1.6711 3.1433 1.6692 6.5703-.2365 10.2187-5.6827 18.0893-13.657 22.9154-23.2176.571-1.1312 1.1923-1.8855 2.1047-2.5552.712-.5227 2.1423-1.8427 3.1784-2.9334 3.8482-4.0513-2.0974 8.5941-7.2876 15.4995-7.4726 9.9421-21.5054 19.7973-25.9435 18.2201zm-20.4374-30.926C5.8412 46.5475.4083 36.3923.0452 20.5681-.2105 9.427.1017 9.1148 15.4513 5.1608a28388.79 28388.79 0 0 0 16.0671-4.1436c5.7483-1.4856 5.7483-1.4856 15.2135.9505 5.206 1.3399 12.2632 3.1506 15.683 4.024C73.8979 8.9238 74.4567 9.573 74.448 19.9694c-.0157 19.0525-7.6385 30.0487-20.4999 29.5722-16.6233-.6158-18.3918-24.4894-2.0617-27.8319 5.4395-1.1133 12.1037.5125 11.8897 2.9007-.7265 8.1069-9.4624 13.4982-17.4348 10.7598-4.7851-1.6437-1.5047 7.2862 3.5416 9.6408 10.7055 4.9953 19.8165-4.7554 21.02-22.4957.722-10.6436.9781-10.3791-13.6475-14.0872-5.5298-1.402-12.3-3.1316-15.045-3.8436-4.991-1.2947-4.991-1.2947-6.8792-.7722-1.0386.2873-7.3056 1.904-13.9268 3.5928-15.9272 4.0621-15.3558 3.884-16.4933 5.143-3.1219 3.4555-1.0734 19.9929 3.3182 26.7875 6.1488 9.5133 19.1903 8.8993 21.7753-1.0252.8928-3.4276.6746-3.7862-1.7872-2.9374-7.6683 2.6438-15.3542-1.748-17.2453-9.8544-.9618-4.1227 8.8938-5.7768 15.403-2.5851 15.559 7.6291 5.7964 30.7234-11.0633 26.1711zm12.1309-17.2585c5.9332-1.97-4.7-8.1755-11.297-6.593-1.5902.3816-1.5297.2062-.6678 1.935 2.3447 4.7031 6.7102 6.4026 11.9648 4.658zm26.955.0335c2.2498-.9952 4.5867-3.5591 5.2228-5.7301.4371-1.4922-6.1598-1.5769-9.275-.1192-2.6823 1.2553-5.1286 3.5616-5.1286 4.8353 0 1.35 6.7386 2.0943 9.1808 1.014z"/>
          </svg>
          <span className="absolute -bottom-1 -right-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-background border border-border text-muted-foreground">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V8a5 5 0 0 1 10 0v3" />
            </svg>
          </span>
        </div>
        <h2 className="text-base font-semibold tracking-tight">Unlock your vault</h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">
          Enter your vault password to decrypt alias metadata and drop keys for <span className="text-foreground font-medium break-all">{email}</span>.
        </p>
      </div>

      {!supported ? (
        <div className="w-full max-w-[260px] text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 text-left">
          This browser does not support the Web Crypto APIs required for vault features.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-[260px] flex flex-col gap-3">
          <Input
            type="password"
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            autoComplete="current-password"
            placeholder="Vault password"
            minLength={12}
          />

          <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card px-3 py-2.5 text-left cursor-pointer">
            <span className="flex flex-col">
              <span className="text-xs font-medium text-foreground">Trust this browser</span>
              <span className="text-xs text-muted-foreground mt-0.5">
                Skip the password on future popups for 30 days.
              </span>
            </span>
            <Toggle
              checked={trustBrowser}
              onChange={() => setTrustBrowser((v) => !v)}
              disabled={!trustSupported}
            />
          </label>

          {!trustSupported && (
            <p className="text-xs text-muted-foreground text-left">
              Persistent unlock is unavailable because secure local key storage is blocked in this browser.
            </p>
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 text-left">
              {error}
            </div>
          )}

          <Button type="submit" loading={unlocking} disabled={!password}>
            {unlocking ? "Unlocking…" : "Unlock"}
          </Button>
        </form>
      )}
    </div>
  );
}
