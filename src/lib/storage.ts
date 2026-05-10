import { DEFAULT_BASE_URL } from "./constants";
import { storageKey } from "./cache";
import type { User } from "./types";

const STORAGE_SCHEMA_VERSION = 3;
const STORAGE_SCHEMA_VERSION_KEY = "storageSchemaVersion";

async function migrateStorageIfNeeded(): Promise<void> {
  const result = await browser.storage.local.get(STORAGE_SCHEMA_VERSION_KEY);
  const currentVersion = result[STORAGE_SCHEMA_VERSION_KEY] as number | undefined;

  if (currentVersion === STORAGE_SCHEMA_VERSION) {
    return;
  }

  await browser.storage.local.remove([
    "cachedUser",
    storageKey("aliases"),
    storageKey("drops"),
    DROP_KEYS_STORAGE_KEY,
  ]);
  await browser.storage.local.set({ [STORAGE_SCHEMA_VERSION_KEY]: STORAGE_SCHEMA_VERSION });
}

export async function getApiKey(): Promise<string | null> {
  const result = await browser.storage.local.get("apiKey");
  return (result.apiKey as string) || null;
}

export async function setApiKey(key: string): Promise<void> {
  await browser.storage.local.set({ apiKey: key });
}

export async function getBaseUrl(): Promise<string> {
  const result = await browser.storage.local.get("baseUrl");
  return (result.baseUrl as string) || DEFAULT_BASE_URL;
}

export async function setBaseUrl(url: string): Promise<void> {
  await browser.storage.local.set({ baseUrl: url.replace(/\/$/, "") });
}

export async function getTheme(): Promise<"light" | "dark" | null> {
  const result = await browser.storage.local.get("theme");
  return (result.theme as "light" | "dark") || null;
}

export async function setTheme(theme: "light" | "dark" | null): Promise<void> {
  await browser.storage.local.set({ theme: theme ?? null });
}

export interface AliasSettings {
  domain: string;
  defaultFormat: "random" | "custom";
}

export async function getAliasSettings(): Promise<AliasSettings> {
  const result = await browser.storage.local.get("aliasSettings");
  return (result.aliasSettings as AliasSettings) ?? { domain: "anon.li", defaultFormat: "random" };
}

export async function setAliasSettings(s: AliasSettings): Promise<void> {
  await browser.storage.local.set({ aliasSettings: s });
}

export async function getCachedUser(): Promise<User | null> {
  const result = await browser.storage.local.get("cachedUser");
  return (result.cachedUser as User) || null;
}

export async function setCachedUser(user: User | null): Promise<void> {
  await browser.storage.local.set({
    cachedUser: user ?? null,
    cachedUserAt: user ? Date.now() : null,
  });
}

export async function getCachedUserAt(): Promise<number | null> {
  const result = await browser.storage.local.get("cachedUserAt");
  return (result.cachedUserAt as number) ?? null;
}

// ── UI state persistence (tabs, sort, filter) ───────────────────────

export interface UiState {
  lastTab: "alias" | "drop";
  aliasSort: "newest" | "oldest";
  aliasFilter: "all" | "active" | "inactive";
  dropSort: "newest" | "oldest" | "downloads";
}

const UI_STATE_KEY = "uiState";

export const DEFAULT_UI_STATE: UiState = {
  lastTab: "alias",
  aliasSort: "newest",
  aliasFilter: "all",
  dropSort: "newest",
};

export async function getUiState(): Promise<UiState> {
  const result = await browser.storage.local.get(UI_STATE_KEY);
  return { ...DEFAULT_UI_STATE, ...(result[UI_STATE_KEY] as Partial<UiState> ?? {}) };
}

export async function setUiState(state: Partial<UiState>): Promise<void> {
  const current = await getUiState();
  await browser.storage.local.set({ [UI_STATE_KEY]: { ...current, ...state } });
}

// ── Initial state (loaded once on startup) ───────────────────────────

export interface InitialState {
  apiKey: string | null;
  baseUrl: string;
  theme: "light" | "dark" | null;
  cachedUser: User | null;
  cachedUserAt: number | null;
  uiState: UiState;
}

export async function getInitialState(): Promise<InitialState> {
  await migrateStorageIfNeeded();
  const result = await browser.storage.local.get([
    "apiKey",
    "baseUrl",
    "theme",
    "cachedUser",
    "cachedUserAt",
    UI_STATE_KEY,
  ]);
  return {
    apiKey: (result.apiKey as string) || null,
    baseUrl: (result.baseUrl as string) || DEFAULT_BASE_URL,
    theme: (result.theme as "light" | "dark") || null,
    cachedUser: (result.cachedUser as User) || null,
    cachedUserAt: (result.cachedUserAt as number) ?? null,
    uiState: { ...DEFAULT_UI_STATE, ...(result[UI_STATE_KEY] as Partial<UiState> ?? {}) },
  };
}

// ── Drop encryption keys ─────────────────────────────────────────────

const DROP_KEYS_STORAGE_KEY = "dropKeys";

export async function getDropKeys(): Promise<Record<string, string>> {
  const result = await browser.storage.local.get(DROP_KEYS_STORAGE_KEY);
  return (result[DROP_KEYS_STORAGE_KEY] as Record<string, string>) ?? {};
}

export async function setDropKey(dropId: string, key: string): Promise<void> {
  const keys = await getDropKeys();
  keys[dropId] = key;
  await browser.storage.local.set({ [DROP_KEYS_STORAGE_KEY]: keys });
}

export async function removeDropKey(dropId: string): Promise<void> {
  const keys = await getDropKeys();
  delete keys[dropId];
  await browser.storage.local.set({ [DROP_KEYS_STORAGE_KEY]: keys });
}

// ── Ignored sites ────────────────────────────────────────────────────

const IGNORED_SITES_KEY = "ignoredSites";

export async function getIgnoredSites(): Promise<string[]> {
  const result = await browser.storage.local.get(IGNORED_SITES_KEY);
  return (result[IGNORED_SITES_KEY] as string[]) ?? [];
}

export async function setIgnoredSites(sites: string[]): Promise<void> {
  await browser.storage.local.set({ [IGNORED_SITES_KEY]: sites });
}

export async function addIgnoredSite(site: string): Promise<void> {
  const sites = await getIgnoredSites();
  const normalized = site.toLowerCase().replace(/^www\./, "");
  if (!sites.includes(normalized)) {
    sites.push(normalized);
    await setIgnoredSites(sites);
  }
}

export async function removeIgnoredSite(site: string): Promise<void> {
  const sites = await getIgnoredSites();
  await setIgnoredSites(sites.filter((s) => s !== site));
}

export function isHostnameIgnored(hostname: string, ignoredSites: string[]): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return ignoredSites.some((entry) => {
    if (entry.startsWith("regex:")) {
      try {
        return new RegExp(entry.slice(6), "i").test(h);
      } catch {
        return false;
      }
    }
    return entry === h;
  });
}
