
import { useState, useEffect, useRef, useMemo } from "preact/hooks";
import { AliasTab } from "./tabs/AliasTab";
import { DropTab } from "./tabs/DropTab";
import { AccountPanel } from "./tabs/AccountTab";
import { SettingsPanel } from "./SettingsPanel";
import { LogoSpinner } from "./ui/LogoSpinner";
import { Button } from "./ui/Button";
import { ShortcutsHelp } from "./ui/ShortcutsHelp";
import { ToastContainer, useToast } from "./ui/Toast";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { apiGet } from "../lib/api";
import { getInitialState, setCachedUser, setTheme, setUiState, setApiKey, setBaseUrl } from "../lib/storage";
import { formatBytes } from "../lib/utils";
import { DEFAULT_BASE_URL } from "../lib/constants";
import type { User } from "../lib/types";

type Tab = "alias" | "drop";

export interface PopupActions {
  focusSearch?: () => void;
  toggleCreate?: () => void;
  navigateList?: (dir: "up" | "down") => void;
  activateItem?: () => void;
}

export function App() {
  const _params = new URLSearchParams(window.location.search);
  const _initialTab = _params.get("tab") === "drop" ? "drop" : null;

  const [activeTab, setActiveTab] = useState<Tab>("alias");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [theme, setThemeState] = useState<"light" | "dark" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { items: toasts, show: showToast, dismiss: dismissToast } = useToast();

  const popupActions = useRef<PopupActions>({});

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init is stable (only called on mount)
  }, []);

  // Global Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showShortcuts) setShowShortcuts(false);
        else if (showSettings) setShowSettings(false);
        else if (showAccount) setShowAccount(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showSettings, showAccount, showShortcuts]);

  // Whether the main tabbed UI is showing (shortcuts only active here)
  const mainUIActive = !authLoading && hasApiKey && !showSettings && !showAccount;

  const shortcutMap = useMemo(
    () => ({
      "1": { handler: () => handleTabChange("alias") },
      "2": { handler: () => handleTabChange("drop") },
      n: { handler: () => popupActions.current.toggleCreate?.() },
      "/": { handler: () => popupActions.current.focusSearch?.() },
      j: { handler: () => popupActions.current.navigateList?.("down") },
      k: { handler: () => popupActions.current.navigateList?.("up") },
      Enter: {
        handler: () => popupActions.current.activateItem?.(),
      },
      "?": {
        handler: () => setShowShortcuts((s) => !s),
      },
    }),
     
    []
  );

  useKeyboardShortcuts(shortcutMap, mainUIActive && !showShortcuts);

  async function init() {
    const state = await getInitialState();

    // Apply theme immediately
    setThemeState(state.theme);
    if (state.theme) {
      document.documentElement.setAttribute("data-theme", state.theme);
    }

    setHasApiKey(!!state.apiKey);

    // Restore last active tab (URL param takes precedence)
    if (_initialTab) {
      setActiveTab(_initialTab as Tab);
    } else {
      setActiveTab(state.uiState.lastTab);
    }

    if (!state.apiKey) {
      setAuthLoading(false);
      return;
    }

    if (state.cachedUser) {
      setUser(state.cachedUser);
      setAuthLoading(false);
      refreshUser();
    } else {
      try {
        const result = await apiGet<User>("/api/v1/me");
        setUser(result.data);
        await setCachedUser(result.data);
      } catch {
        // Invalid API key or network error
      } finally {
        setAuthLoading(false);
      }
    }
  }

  async function refreshUser() {
    try {
      const result = await apiGet<User>("/api/v1/me");
      setUser(result.data);
      await setCachedUser(result.data);
    } catch {
      // Keep showing cached data on failure
    }
  }

  async function toggleTheme() {
    const effectiveDark = theme === "dark" || (theme === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next: "light" | "dark" = effectiveDark ? "light" : "dark";
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    await setTheme(next);
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setUiState({ lastTab: tab });
  }

  const effectiveDark = theme === "dark" || (theme === null && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const storageUsed = user ? Number(user.storage.used) : 0;
  const storageLimit = user ? Number(user.storage.limit) : 1;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <svg role="img" viewBox="0 0 74.4482 80.1979" fill="currentColor" height="16" width="14.9" aria-label="anon.li logo">
            <path d="M35.7493 80.0307c-11.8-4.1933-24.826-17.7872-30.599-31.9333-1.4649-3.5892-1.4868-3.8341-.2161-2.4151 1.491 1.6651 2.7252 2.7875 3.9088 3.5544.7994.518 1.3515 1.2376 2.2164 2.8886 5.089 9.7142 13.0484 17.6656 23.1522 23.1285 3.0907 1.6711 3.1433 1.6692 6.5703-.2365 10.2187-5.6827 18.0893-13.657 22.9154-23.2176.571-1.1312 1.1923-1.8855 2.1047-2.5552.712-.5227 2.1423-1.8427 3.1784-2.9334 3.8482-4.0513-2.0974 8.5941-7.2876 15.4995-7.4726 9.9421-21.5054 19.7973-25.9435 18.2201zm-20.4374-30.926C5.8412 46.5475.4083 36.3923.0452 20.5681-.2105 9.427.1017 9.1148 15.4513 5.1608a28388.79 28388.79 0 0 0 16.0671-4.1436c5.7483-1.4856 5.7483-1.4856 15.2135.9505 5.206 1.3399 12.2632 3.1506 15.683 4.024C73.8979 8.9238 74.4567 9.573 74.448 19.9694c-.0157 19.0525-7.6385 30.0487-20.4999 29.5722-16.6233-.6158-18.3918-24.4894-2.0617-27.8319 5.4395-1.1133 12.1037.5125 11.8897 2.9007-.7265 8.1069-9.4624 13.4982-17.4348 10.7598-4.7851-1.6437-1.5047 7.2862 3.5416 9.6408 10.7055 4.9953 19.8165-4.7554 21.02-22.4957.722-10.6436.9781-10.3791-13.6475-14.0872-5.5298-1.402-12.3-3.1316-15.045-3.8436-4.991-1.2947-4.991-1.2947-6.8792-.7722-1.0386.2873-7.3056 1.904-13.9268 3.5928-15.9272 4.0621-15.3558 3.884-16.4933 5.143-3.1219 3.4555-1.0734 19.9929 3.3182 26.7875 6.1488 9.5133 19.1903 8.8993 21.7753-1.0252.8928-3.4276.6746-3.7862-1.7872-2.9374-7.6683 2.6438-15.3542-1.748-17.2453-9.8544-.9618-4.1227 8.8938-5.7768 15.403-2.5851 15.559 7.6291 5.7964 30.7234-11.0633 26.1711zm12.1309-17.2585c5.9332-1.97-4.7-8.1755-11.297-6.593-1.5902.3816-1.5297.2062-.6678 1.935 2.3447 4.7031 6.7102 6.4026 11.9648 4.658zm26.955.0335c2.2498-.9952 4.5867-3.5591 5.2228-5.7301.4371-1.4922-6.1598-1.5769-9.275-.1192-2.6823 1.2553-5.1286 3.5616-5.1286 4.8353 0 1.35 6.7386 2.0943 9.1808 1.014z"/>
          </svg>
          <span className="font-medium text-sm tracking-tight text-foreground">anon.li</span>
        </div>
        <div className="flex items-center gap-1">
          {user && (
            <button
              type="button"
              onClick={() => setShowAccount((s) => !s)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Account"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M20 21a8 8 0 1 0-16 0" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={effectiveDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {effectiveDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {showSettings ? (
          <SettingsPanel onClose={() => { setShowSettings(false); init(); }} />
        ) : showAccount ? (
          <AccountPanel user={user} onClose={() => setShowAccount(false)} />
        ) : authLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LogoSpinner />
          </div>
        ) : !hasApiKey ? (
          <SetupScreen onOpenSettings={() => setShowSettings(true)} onConnect={init} />
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-border">
              {(["alias", "drop"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`flex-1 h-10 text-sm font-medium transition-all duration-200 capitalize ${
                    activeTab === tab
                      ? "text-foreground border-b-2 border-primary -mb-px"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "alias" ? (
                <AliasTab
                  user={user}
                  onRefreshUser={refreshUser}
                  onError={(msg) => showToast(msg, "error")}
                  onSuccess={(msg) => showToast(msg, "success")}
                  popupActions={popupActions}
                />
              ) : (
                <DropTab
                  onError={(msg) => showToast(msg, "error")}
                  onSuccess={(msg) => showToast(msg, "success")}
                  popupActions={popupActions}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer: storage bar */}
      {user && (
        <footer className="px-4 py-2.5 border-t border-border/40">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Storage</span>
            <span>
              {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (storageUsed / storageLimit) * 100)}%`,
              }}
            />
          </div>
        </footer>
      )}

      {/* Shortcuts help overlay */}
      {showShortcuts && (
        <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
      )}

      <ToastContainer items={toasts} onDismiss={dismissToast} />
    </div>
  );
}

interface SetupScreenProps {
  onOpenSettings: () => void;
  onConnect: () => void;
}

function SetupScreen({ onOpenSettings, onConnect }: SetupScreenProps) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  async function handleConnect(e: Event) {
    e.preventDefault();
    const key = apiKeyInput.trim();
    if (!key) return;
    if (!key.startsWith("ak_")) {
      setConnectError("API key must start with ak_");
      return;
    }
    setConnecting(true);
    setConnectError("");
    try {
      await setApiKey(key);
      await setBaseUrl(DEFAULT_BASE_URL);
      // Validate the key by calling the API
      await apiGet<User>("/api/v1/me");
      await onConnect();
    } catch (err) {
      // Clear the invalid key
      await setApiKey("");
      setConnectError(err instanceof Error ? err.message : "Invalid API key or connection failed");
      setConnecting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <svg
          role="img"
          viewBox="0 0 74.4482 80.1979"
          fill="currentColor"
          height="40"
          width="37.2"
          className="animate-breathe text-foreground"
          aria-label="anon.li logo"
        >
          <path d="M35.7493 80.0307c-11.8-4.1933-24.826-17.7872-30.599-31.9333-1.4649-3.5892-1.4868-3.8341-.2161-2.4151 1.491 1.6651 2.7252 2.7875 3.9088 3.5544.7994.518 1.3515 1.2376 2.2164 2.8886 5.089 9.7142 13.0484 17.6656 23.1522 23.1285 3.0907 1.6711 3.1433 1.6692 6.5703-.2365 10.2187-5.6827 18.0893-13.657 22.9154-23.2176.571-1.1312 1.1923-1.8855 2.1047-2.5552.712-.5227 2.1423-1.8427 3.1784-2.9334 3.8482-4.0513-2.0974 8.5941-7.2876 15.4995-7.4726 9.9421-21.5054 19.7973-25.9435 18.2201zm-20.4374-30.926C5.8412 46.5475.4083 36.3923.0452 20.5681-.2105 9.427.1017 9.1148 15.4513 5.1608a28388.79 28388.79 0 0 0 16.0671-4.1436c5.7483-1.4856 5.7483-1.4856 15.2135.9505 5.206 1.3399 12.2632 3.1506 15.683 4.024C73.8979 8.9238 74.4567 9.573 74.448 19.9694c-.0157 19.0525-7.6385 30.0487-20.4999 29.5722-16.6233-.6158-18.3918-24.4894-2.0617-27.8319 5.4395-1.1133 12.1037.5125 11.8897 2.9007-.7265 8.1069-9.4624 13.4982-17.4348 10.7598-4.7851-1.6437-1.5047 7.2862 3.5416 9.6408 10.7055 4.9953 19.8165-4.7554 21.02-22.4957.722-10.6436.9781-10.3791-13.6475-14.0872-5.5298-1.402-12.3-3.1316-15.045-3.8436-4.991-1.2947-4.991-1.2947-6.8792-.7722-1.0386.2873-7.3056 1.904-13.9268 3.5928-15.9272 4.0621-15.3558 3.884-16.4933 5.143-3.1219 3.4555-1.0734 19.9929 3.3182 26.7875 6.1488 9.5133 19.1903 8.8993 21.7753-1.0252.8928-3.4276.6746-3.7862-1.7872-2.9374-7.6683 2.6438-15.3542-1.748-17.2453-9.8544-.9618-4.1227 8.8938-5.7768 15.403-2.5851 15.559 7.6291 5.7964 30.7234-11.0633 26.1711zm12.1309-17.2585c5.9332-1.97-4.7-8.1755-11.297-6.593-1.5902.3816-1.5297.2062-.6678 1.935 2.3447 4.7031 6.7102 6.4026 11.9648 4.658zm26.955.0335c2.2498-.9952 4.5867-3.5591 5.2228-5.7301.4371-1.4922-6.1598-1.5769-9.275-.1192-2.6823 1.2553-5.1286 3.5616-5.1286 4.8353 0 1.35 6.7386 2.0943 9.1808 1.014z"/>
        </svg>
        <h2 className="text-base font-semibold tracking-tight">Welcome to anon.li</h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
          Anonymous email aliases &amp; encrypted file sharing
        </p>
      </div>

      {/* Quick-start steps */}
      <div className="w-full max-w-[260px] text-left space-y-2">
        <div className="flex items-start gap-2.5">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center mt-0.5">1</span>
          <p className="text-xs text-muted-foreground leading-relaxed">Sign up or log in at <span className="text-foreground font-medium">anon.li</span></p>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center mt-0.5">2</span>
          <p className="text-xs text-muted-foreground leading-relaxed">Generate an <span className="text-foreground font-medium">API key</span> in Settings</p>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center mt-0.5">3</span>
          <p className="text-xs text-muted-foreground leading-relaxed">Paste your API key below</p>
        </div>
      </div>

      {/* Inline API key entry */}
      <form onSubmit={handleConnect} className="w-full max-w-[260px] flex flex-col gap-2">
        <input
          type="password"
          value={apiKeyInput}
          onInput={(e) => setApiKeyInput((e.target as HTMLInputElement).value)}
          placeholder="ak_..."
          autoComplete="off"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
        />
        {connectError && (
          <p className="text-xs text-destructive">{connectError}</p>
        )}
        <Button type="submit" disabled={connecting || !apiKeyInput.trim()}>
          {connecting ? "Connecting…" : "Connect"}
        </Button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.open("https://anon.li/dashboard/settings", "_blank")}
            className="flex-1 h-9 px-4 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Get API Key ↗
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex-1 h-9 px-4 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Settings
          </button>
        </div>
      </form>
    </div>
  );
}
