export interface CacheEntry<T> {
  data: T;
  total: number;
  fetchedAt: number;
  /** Monotonic counter — increments on every write so listeners can detect changes. */
  generation: number;
}

const CACHE_PREFIX = "cache:";
const TTL_MS = 5 * 60 * 1000; // 5 minutes — aligns with background prefetch interval

export type CacheKey = "aliases" | "drops";

export function storageKey(key: CacheKey): string {
  return `${CACHE_PREFIX}${key}`;
}

export function isFresh(entry: CacheEntry<unknown>, ttlMs = TTL_MS): boolean {
  return Date.now() - entry.fetchedAt < ttlMs;
}

export async function getCached<T>(key: CacheKey): Promise<CacheEntry<T> | null> {
  const result = await browser.storage.local.get(storageKey(key));
  const entry = result[storageKey(key)] as CacheEntry<T> | undefined;
  return entry ?? null;
}

export async function setCache<T>(key: CacheKey, data: T, total: number): Promise<void> {
  const sk = storageKey(key);
  // Read current generation to increment it
  const prev = await browser.storage.local.get(sk);
  const prevGen = (prev[sk] as CacheEntry<T> | undefined)?.generation ?? 0;
  const entry: CacheEntry<T> = { data, total, fetchedAt: Date.now(), generation: prevGen + 1 };
  await browser.storage.local.set({ [sk]: entry });
}

export async function invalidateCache(key: CacheKey): Promise<void> {
  await browser.storage.local.remove(storageKey(key));
}
