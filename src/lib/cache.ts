import type { Alias } from "./types";
import type { Drop } from "./types";

export interface CacheEntry<T> {
  data: T;
  total: number;
  fetchedAt: number;
}

const CACHE_PREFIX = "cache:";
const TTL_LIST = 2 * 60 * 1000; // 2 minutes
const TTL_USER = 5 * 60 * 1000; // 5 minutes

export type CacheKey = "aliases" | "drops";

function storageKey(key: CacheKey): string {
  return `${CACHE_PREFIX}${key}`;
}

export function isFresh(entry: CacheEntry<unknown>, ttlMs = TTL_LIST): boolean {
  return Date.now() - entry.fetchedAt < ttlMs;
}

export async function getCached<T>(key: CacheKey): Promise<CacheEntry<T> | null> {
  const result = await browser.storage.local.get(storageKey(key));
  const entry = result[storageKey(key)] as CacheEntry<T> | undefined;
  return entry ?? null;
}

export async function setCache<T>(key: CacheKey, data: T, total: number): Promise<void> {
  const entry: CacheEntry<T> = { data, total, fetchedAt: Date.now() };
  await browser.storage.local.set({ [storageKey(key)]: entry });
}

export async function invalidateCache(key: CacheKey): Promise<void> {
  await browser.storage.local.remove(storageKey(key));
}
