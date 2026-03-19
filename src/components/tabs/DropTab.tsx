
import { useState, useEffect, useRef } from "preact/hooks";
import { DropList } from "../drop/DropList";
import { DropCreate } from "../drop/DropCreate";
import { DropListSkeleton } from "../drop/DropListSkeleton";
import { QRModal } from "../ui/QRModal";
import { apiGetList } from "../../lib/api";
import { getDropKeys, getBaseUrl, setUiState } from "../../lib/storage";
import { getCached, setCache, isFresh, storageKey } from "../../lib/cache";
import type { CacheEntry } from "../../lib/cache";
import { toUserMessage } from "../../lib/errors";
import { copyToClipboard } from "../../lib/utils";
import type { Drop } from "../../lib/types";
import type { PopupActions } from "../App";
import type { ToastAction } from "../ui/Toast";

type SortMode = "newest" | "oldest" | "downloads";

const PAGE_SIZE = 25;

interface DropTabProps {
  onError: (msg: string, action?: ToastAction) => void;
  onSuccess: (msg: string) => void;
  onCountChange?: (count: number) => void;
  popupActions: { current: PopupActions };
}

export function DropTab({ onError, onSuccess, onCountChange, popupActions }: DropTabProps) {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [dropKeys, setDropKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [qrTarget, setQrTarget] = useState<{ drop: Drop; url: string } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Track cache generation so we can detect external updates
  const cacheGenRef = useRef(0);

  async function loadDrops(reset = true) {
    if (reset) {
      // Try cache first for instant display
      const cached = await getCached<Drop[]>("drops");
      if (cached) {
        setDrops(cached.data);
        setDropKeys(await getDropKeys());
        setHasMore(cached.total > cached.data.length);
        cacheGenRef.current = cached.generation;
        setLoading(false);
        // Always revalidate in background to stay fresh
        revalidateDrops();
        return;
      }
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const offset = reset ? 0 : drops.length;

    try {
      const [result, keys] = await Promise.all([
        apiGetList<Drop>(`/api/v1/drop?limit=${PAGE_SIZE}&offset=${offset}`),
        reset ? getDropKeys() : Promise.resolve(dropKeys),
      ]);

      if (reset) {
        setDrops(result.data);
        setDropKeys(keys);
        await setCache("drops", result.data, result.total);
      } else {
        setDrops((prev) => [...prev, ...result.data]);
      }
      setHasMore(result.total > (reset ? result.data.length : drops.length + result.data.length));
    } catch (err) {
      const msg = toUserMessage(err);
      onError(msg.message, msg.action);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function revalidateDrops() {
    setRefreshing(true);
    try {
      const result = await apiGetList<Drop>(`/api/v1/drop?limit=${PAGE_SIZE}&offset=0`);
      setDrops(result.data);
      setHasMore(result.total > result.data.length);
      await setCache("drops", result.data, result.total);
    } catch {
      // Keep showing cached data on failure
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDrops();

    // Listen for external cache updates (e.g. background prefetch)
    const sk = storageKey("drops");
    function onStorageChanged(changes: Record<string, { newValue?: unknown }>) {
      const change = changes[sk];
      if (!change?.newValue) return;
      const entry = change.newValue as CacheEntry<Drop[]>;
      if (entry.generation > cacheGenRef.current) {
        cacheGenRef.current = entry.generation;
        setDrops(entry.data);
        setHasMore(entry.total > entry.data.length);
      }
    }
    browser.storage.onChanged.addListener(onStorageChanged);
    return () => browser.storage.onChanged.removeListener(onStorageChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  // Report count changes
  useEffect(() => {
    onCountChange?.(drops.length);
  }, [drops.length, onCountChange]);

  const sorted = [...drops].sort((a, b) => {
    if (sortMode === "downloads") return b.downloadCount - a.downloadCount;
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return sortMode === "newest" ? db - da : da - db;
  });

  // Register popupActions
  useEffect(() => {
    popupActions.current = {
      toggleCreate: () => setCreating((s) => !s),
      navigateList: (dir) => {
        setFocusedIndex((prev) => {
          if (sorted.length === 0) return -1;
          if (dir === "down") return Math.min(prev + 1, sorted.length - 1);
          return Math.max(prev - 1, 0);
        });
      },
      activateItem: () => {
        if (focusedIndex >= 0 && focusedIndex < sorted.length) {
          const drop = sorted[focusedIndex];
          getBaseUrl().then((baseUrl) => {
            const key = dropKeys[drop.id];
            const url = key ? `${baseUrl}/d/${drop.id}#${key}` : `${baseUrl}/d/${drop.id}`;
            copyToClipboard(url).then(() =>
              onSuccess(key ? "URL with key copied" : "URL copied (no key)")
            );
          });
        }
      },
    };
    return () => {
      popupActions.current = {};
    };
  }, [sorted, focusedIndex, dropKeys, onSuccess, popupActions]);

  // Reset focusedIndex when sort changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [sortMode]);

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    setUiState({ dropSort: mode });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const [result, keys] = await Promise.all([
        apiGetList<Drop>(`/api/v1/drop?limit=${PAGE_SIZE}&offset=0`),
        getDropKeys(),
      ]);
      setDrops(result.data);
      setDropKeys(keys);
      setHasMore(result.total > result.data.length);
      await setCache("drops", result.data, result.total);
    } catch (err) {
      const msg = toUserMessage(err);
      onError(msg.message, msg.action);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">My Drops</span>
          <select
            value={sortMode}
            onChange={(e) => handleSortChange((e.target as HTMLSelectElement).value as SortMode)}
            className="text-xs text-muted-foreground bg-background border-none outline-none cursor-pointer hover:text-foreground"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="downloads">Downloads</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          {/* New drop button */}
          <button
            type="button"
            onClick={() => setCreating((s) => !s)}
            class={`h-7 w-7 flex items-center justify-center rounded-md border transition-all ${
              creating
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
            title={creating ? "Cancel" : "New drop"}
            aria-label={creating ? "Cancel create" : "New drop"}
          >
            {creating ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
          </button>
          {/* Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Refresh"
            aria-label="Refresh drops"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class={refreshing ? "animate-spin" : ""}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Create drop panel */}
      {creating && (
        <div className="mb-3 p-3 border border-border/60 rounded-xl bg-card animate-slide-down">
          <DropCreate
            onCreated={(drop) => {
              const updated = [drop, ...drops];
              setDrops(updated);
              setCache("drops", updated, updated.length);
              setDropKeys((prev) => ({ ...prev }));
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
            onError={onError}
            onSuccess={onSuccess}
          />
        </div>
      )}

      {loading ? (
        <div className="py-4">
          <DropListSkeleton />
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <DropList
            drops={sorted}
            dropKeys={dropKeys}
            focusedIndex={focusedIndex}
            onUpdate={(updated) => {
              const newDrops = drops.map((d) => (d.id === updated.id ? updated : d));
              setDrops(newDrops);
              setCache("drops", newDrops, newDrops.length);
            }}
            onDelete={(id) => {
              const newDrops = drops.filter((d) => d.id !== id);
              setDrops(newDrops);
              setCache("drops", newDrops, newDrops.length);
            }}
            onError={onError}
            onSuccess={onSuccess}
            onOpenQr={(drop, url) => setQrTarget({ drop, url })}
          />

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-3 pb-1">
              <button
                type="button"
                onClick={() => loadDrops(false)}
                disabled={loadingMore}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* QR code overlay */}
      {qrTarget && (
        <QRModal url={qrTarget.url} onClose={() => setQrTarget(null)} />
      )}
    </div>
  );
}
