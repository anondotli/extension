import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { getApiKey, setApiKey, getBaseUrl, setBaseUrl, getSyncDropKeys, setSyncDropKeys, getTheme, setTheme, getIgnoredSites, addIgnoredSite, removeIgnoredSite } from "../../lib/storage";
import { apiGet } from "../../lib/api";
import { DEFAULT_BASE_URL, EXTENSION_VERSION } from "../../lib/constants";
import type { User } from "../../lib/types";
import { Toggle } from "../../components/ui/Toggle";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";
import "../../assets/tailwind.css";

function OptionsPage() {
  const [apiKey, setApiKeyState] = useState("");
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [syncDropKeys, setSyncDropKeysState] = useState(true);
  const [themeState, setThemeState] = useState<"light" | "dark" | null>(null);
  const [ignoredSites, setIgnoredSitesState] = useState<string[]>([]);
  const [newIgnoredSite, setNewIgnoredSite] = useState("");

  useEffect(() => {
    (async () => {
      const [key, url, sync, theme, ignored] = await Promise.all([
        getApiKey(), getBaseUrl(), getSyncDropKeys(), getTheme(), getIgnoredSites(),
      ]);
      if (key) setApiKeyState(key);
      if (url) setBaseUrlState(url);
      setSyncDropKeysState(sync);
      setThemeState(theme);
      setIgnoredSitesState(ignored);
      if (theme) {
        document.documentElement.setAttribute("data-theme", theme);
      }
    })();
  }, []);

  async function handleSave(e: Event) {
    e.preventDefault();
    setSaving(true);
    try {
      await setApiKey(apiKey.trim());
      await setBaseUrl(baseUrl.trim() || DEFAULT_BASE_URL);
      await setSyncDropKeys(syncDropKeys);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      await setApiKey(apiKey.trim());
      await setBaseUrl(baseUrl.trim() || DEFAULT_BASE_URL);
      const result = await apiGet<User>("/api/v1/me");
      setTestResult({
        ok: true,
        message: `Connected as ${result.data.email} (${result.data.tier})`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Connection failed",
      });
    } finally {
      setTesting(false);
    }
  }

  async function toggleTheme() {
    const effectiveDark = themeState === "dark" || (themeState === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next: "light" | "dark" = effectiveDark ? "light" : "dark";
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    await setTheme(next);
  }

  const effectiveDark = themeState === "dark" || (themeState === null && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">anon.li</h1>
            <p className="text-sm text-muted-foreground mt-1">Extension settings</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground transition-colors p-2"
            title={effectiveDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={effectiveDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {effectiveDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" for="apiKey">
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onInput={(e) => setApiKeyState((e.target as HTMLInputElement).value)}
                placeholder="ak_..."
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Generate at{" "}
                <a
                  href="https://anon.li/dashboard/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  anon.li/dashboard/settings
                </a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" for="baseUrl">
                Base URL
              </label>
              <input
                id="baseUrl"
                type="url"
                value={baseUrl}
                onInput={(e) => setBaseUrlState((e.target as HTMLInputElement).value)}
                placeholder="https://anon.li"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Only change if self-hosting
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Sync encryption keys</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Capture drop decryption keys when visiting drop pages
                </p>
              </div>
              <Toggle checked={syncDropKeys} onChange={() => setSyncDropKeysState((v) => !v)} />
            </div>

            {/* Ignored sites */}
            <div className="border-t border-border/40 pt-5">
              <p className="text-sm font-medium text-foreground mb-1">Ignored sites</p>
              <p className="text-xs text-muted-foreground mb-3">
                The anon.li button won't appear on these sites. Prefix with{" "}
                <code className="text-[10px] bg-muted px-1 py-0.5 rounded">regex:</code>{" "}
                for pattern matching.
              </p>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newIgnoredSite}
                  onInput={(e) => setNewIgnoredSite((e.target as HTMLInputElement).value)}
                  placeholder="example.com or regex:.*\.bank\.com"
                  className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = newIgnoredSite.trim();
                      if (!val) return;
                      addIgnoredSite(val).then(() => getIgnoredSites().then(setIgnoredSitesState));
                      setNewIgnoredSite("");
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!newIgnoredSite.trim()}
                  onClick={() => {
                    const val = newIgnoredSite.trim();
                    if (!val) return;
                    addIgnoredSite(val).then(() => getIgnoredSites().then(setIgnoredSitesState));
                    setNewIgnoredSite("");
                  }}
                  className="h-9 px-4 text-sm font-medium rounded-md bg-primary text-primary-foreground transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
                >
                  Add
                </button>
              </div>

              {ignoredSites.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {ignoredSites.map((site) => (
                    <div key={site} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/50 group">
                      <span className="text-sm text-foreground truncate" title={site}>
                        {site.startsWith("regex:") ? (
                          <><code className="text-xs text-muted-foreground">regex:</code>{site.slice(6)}</>
                        ) : site}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeIgnoredSite(site).then(() => getIgnoredSites().then(setIgnoredSitesState))}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                        title={`Remove ${site}`}
                        aria-label={`Remove ${site} from ignored sites`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {testResult && (
              <div
                class={`flex items-start gap-2.5 px-3.5 py-3 rounded-md text-sm border ${
                  testResult.ok
                    ? "bg-success/10 text-foreground border-success/20"
                    : "bg-destructive/10 text-foreground border-destructive/20"
                }`}
              >
                {testResult.ok ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" className="text-success shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" className="text-destructive shrink-0 mt-0.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
                {testResult.message}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || !apiKey.trim()}
                className="flex-1 h-9 text-sm font-medium rounded-md bg-primary text-primary-foreground luxury-shadow-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
              >
                {saved ? "Saved!" : saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !apiKey.trim()}
                className="px-4 h-9 text-sm font-medium rounded-md border border-input bg-transparent text-foreground hover:bg-secondary/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {testing ? "Testing…" : "Test connection"}
              </button>
            </div>
          </form>
        </div>

        {/* Version */}
        <p className="text-xs text-muted-foreground/50 text-center mt-6">
          anon.li v{EXTENSION_VERSION}
        </p>
      </div>
    </div>
  );
}

render(
  <ErrorBoundary>
    <OptionsPage />
  </ErrorBoundary>,
  document.getElementById("app")!
);
