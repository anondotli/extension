
import { useState, useEffect, useCallback } from "preact/hooks";
import { getApiKey, setApiKey, getBaseUrl, setBaseUrl, getSyncDropKeys, setSyncDropKeys } from "../lib/storage";
import { apiGet } from "../lib/api";
import { DEFAULT_BASE_URL } from "../lib/constants";
import type { User } from "../lib/types";
import { Toggle } from "./ui/Toggle";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [apiKey, setApiKeyState] = useState("");
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [syncDropKeys, setSyncDropKeysState] = useState(true);

  useEffect(() => {
    (async () => {
      const [key, url, sync] = await Promise.all([getApiKey(), getBaseUrl(), getSyncDropKeys()]);
      if (key) setApiKeyState(key);
      if (url) setBaseUrlState(url);
      setSyncDropKeysState(sync);
    })();
  }, []);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  async function handleSave(e: Event) {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (trimmed && !trimmed.startsWith("ak_")) {
      setApiKeyError("API key must start with ak_");
      return;
    }
    setApiKeyError(null);
    setSaving(true);
    try {
      await Promise.all([
        setApiKey(trimmed),
        setBaseUrl(baseUrl.trim() || DEFAULT_BASE_URL),
        setSyncDropKeys(syncDropKeys),
      ]);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    const trimmed = apiKey.trim();
    if (trimmed && !trimmed.startsWith("ak_")) {
      setApiKeyError("API key must start with ak_");
      return;
    }
    setApiKeyError(null);
    setTesting(true);
    setTestResult(null);
    try {
      await setApiKey(trimmed);
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

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <span className="text-sm font-medium text-foreground">Settings</span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Close settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Form */}
      <div className="p-4">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5" for="settings-apiKey">
              API Key
            </label>
            <input
              id="settings-apiKey"
              type="password"
              value={apiKey}
              onInput={(e) => { setApiKeyState((e.target as HTMLInputElement).value); setApiKeyError(null); setSaved(false); }}
              placeholder="ak_..."
              className={`h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset ${apiKeyError ? "border-destructive" : "border-input"}`}
              autoComplete="off"
            />
            {apiKeyError && (
              <p className="text-xs text-destructive mt-1">{apiKeyError}</p>
            )}
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
            <label className="block text-xs font-medium text-foreground mb-1.5" for="settings-baseUrl">
              Base URL
            </label>
            <input
              id="settings-baseUrl"
              type="url"
              value={baseUrl}
              onInput={(e) => setBaseUrlState((e.target as HTMLInputElement).value)}
              placeholder="https://anon.li"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Only change if self-hosting</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-foreground">Sync encryption keys</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Capture drop decryption keys when visiting drop pages
              </p>
            </div>
            <Toggle checked={syncDropKeys} onChange={() => setSyncDropKeysState((v) => !v)} />
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2.5 px-3.5 py-3 rounded-md text-sm border ${
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
              {testing ? "Testing…" : "Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
