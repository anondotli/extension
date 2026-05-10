import { useState, useEffect, useRef } from "preact/hooks";
import { DropList } from "../drop/DropList";
import { DropCreate } from "../drop/DropCreate";
import { DropListSkeleton } from "../drop/DropListSkeleton";
import { QRModal } from "../ui/QRModal";
import { getBaseUrl, getDropKeys, setUiState } from "../../lib/storage";
import { getCached, isFresh, setCache, storageKey } from "../../lib/cache";
import type { CacheEntry } from "../../lib/cache";
import { toUserMessage } from "../../lib/errors";
import { copyToClipboard } from "../../lib/utils";
import { syncVaultDropKeys } from "../../lib/drop-keys";
import { listDrops } from "../../lib/service";
import type { Drop, User } from "../../lib/types";
import type { PopupActions } from "../App";
import type { ToastAction } from "../ui/Toast";

type SortMode = "newest" | "oldest" | "downloads";

const PAGE_SIZE = 25;

interface DropTabProps {
  user: User | null;
  vaultStatus: "locked" | "unlocking" | "unlocked";
  onRequireVault: (action?: () => Promise<void>) => void;
  onError: (msg: string, action?: ToastAction) => void;
  onSuccess: (msg: string) => void;
  onCountChange?: (count: number) => void;
  popupActions: { current: PopupActions };
}

export function DropTab({
  user,
  vaultStatus,
  onRequireVault,
  onError,
  onSuccess,
  onCountChange,
  popupActions,
}: DropTabProps) {
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
  const cacheGenRef = useRef(0);

  useEffect(() => {
    void loadDrops();

    const sk = storageKey("drops");
    function onStorageChanged(changes: Record<string, { newValue?: unknown }>) {
      const change = changes[sk];
      if (!change?.newValue) return;

      const entry = change.newValue as CacheEntry<Drop[]>;
      if (entry.generation <= cacheGenRef.current) return;

      cacheGenRef.current = entry.generation;
      setDrops(entry.data);
      setHasMore(entry.total > entry.data.length);
    }

    browser.storage.onChanged.addListener(onStorageChanged);
    return () => browser.storage.onChanged.removeListener(onStorageChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    onCountChange?.(drops.length);
  }, [drops.length, onCountChange]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [sortMode]);

  useEffect(() => {
    void refreshDropKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived from vault lock state only
  }, [vaultStatus]);

  const sorted = [...drops].sort((a, b) => {
    if (sortMode === "downloads") return b.downloadCount - a.downloadCount;
    const createdA = new Date(a.createdAt).getTime();
    const createdB = new Date(b.createdAt).getTime();
    return sortMode === "newest" ? createdB - createdA : createdA - createdB;
  });

  useEffect(() => {
    popupActions.current = {
      toggleCreate: () => setCreating((state) => !state),
      navigateList: (dir) => {
        setFocusedIndex((prev) => {
          if (sorted.length === 0) return -1;
          if (dir === "down") return Math.min(prev + 1, sorted.length - 1);
          return Math.max(prev - 1, 0);
        });
      },
      activateItem: () => {
        if (focusedIndex < 0 || focusedIndex >= sorted.length) return;

        const drop = sorted[focusedIndex]!;
        void getBaseUrl().then((baseUrl) => {
          const key = dropKeys[drop.id];
          const url = !drop.customKey && key ? `${baseUrl}/d/${drop.id}#${key}` : `${baseUrl}/d/${drop.id}`;
          void copyToClipboard(url).then(() =>
            onSuccess(drop.customKey ? "Password-protected URL copied" : key ? "URL with key copied" : "URL copied"),
          );
        });
      },
    };

    return () => {
      popupActions.current = {};
    };
  }, [dropKeys, focusedIndex, onSuccess, popupActions, sorted]);

  async function refreshDropKeys() {
    try {
      const localKeys = await getDropKeys();
      const nextKeys = vaultStatus === "unlocked"
        ? await syncVaultDropKeys(localKeys)
        : localKeys;
      setDropKeys(nextKeys);
    } catch {
      setDropKeys(await getDropKeys());
    }
  }

  async function fetchDrops(offset = 0) {
    return listDrops(PAGE_SIZE, offset);
  }

  async function loadDrops(reset = true) {
    if (reset) {
      const cached = await getCached<Drop[]>("drops");
      if (cached) {
        setDrops(cached.data);
        setHasMore(cached.total > cached.data.length);
        cacheGenRef.current = cached.generation;
        setLoading(false);
        void refreshDropKeys();
        if (!isFresh(cached)) {
          void revalidateDrops();
        }
        return;
      }

      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    const offset = reset ? 0 : drops.length;

    try {
      const result = await fetchDrops(offset);
      if (reset) {
        setDrops(result.data);
        setHasMore(result.total > result.data.length);
        await setCache("drops", result.data, result.total);
        const entry = await getCached<Drop[]>("drops");
        if (entry) cacheGenRef.current = entry.generation;
      } else {
        const nextDrops = [...drops, ...result.data];
        setDrops(nextDrops);
        setHasMore(result.total > nextDrops.length);
      }
      await refreshDropKeys();
    } catch (error) {
      const message = toUserMessage(error);
      onError(message.message, message.action);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function revalidateDrops() {
    setRefreshing(true);
    try {
      const result = await fetchDrops(0);
      setDrops(result.data);
      setHasMore(result.total > result.data.length);
      await setCache("drops", result.data, result.total);
      const entry = await getCached<Drop[]>("drops");
      if (entry) cacheGenRef.current = entry.generation;
      await refreshDropKeys();
    } catch {
      // Keep cached data visible.
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await fetchDrops(0);
      setDrops(result.data);
      setHasMore(result.total > result.data.length);
      await setCache("drops", result.data, result.total);
      const entry = await getCached<Drop[]>("drops");
      if (entry) cacheGenRef.current = entry.generation;
      await refreshDropKeys();
    } catch (error) {
      const message = toUserMessage(error);
      onError(message.message, message.action);
    } finally {
      setRefreshing(false);
    }
  }

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    void setUiState({ dropSort: mode });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">My Drops</span>
          <select
            value={sortMode}
            onChange={(event) => handleSortChange((event.target as HTMLSelectElement).value as SortMode)}
            className="text-xs text-muted-foreground bg-background border-none outline-none cursor-pointer hover:text-foreground"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="downloads">Downloads</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCreating((state) => !state)}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleRefresh()}
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

      {creating && (
        <div className="mb-3 p-3 border border-border/60 rounded-xl bg-card animate-slide-down">
          <DropCreate
            user={user}
            vaultStatus={vaultStatus}
            onRequireVault={onRequireVault}
            onCreated={() => {
              void handleRefresh();
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
            vaultStatus={vaultStatus}
            focusedIndex={focusedIndex}
            onUpdate={(updatedDrop) => {
              const nextDrops = drops.map((drop) => (drop.id === updatedDrop.id ? updatedDrop : drop));
              setDrops(nextDrops);
              void setCache("drops", nextDrops, nextDrops.length);
            }}
            onDelete={(id) => {
              const nextDrops = drops.filter((drop) => drop.id !== id);
              setDrops(nextDrops);
              void setCache("drops", nextDrops, nextDrops.length);
            }}
            onError={onError}
            onSuccess={onSuccess}
            onOpenQr={(drop, url) => setQrTarget({ drop, url })}
          />

          {hasMore && (
            <div className="flex justify-center pt-3 pb-1">
              <button
                type="button"
                onClick={() => void loadDrops(false)}
                disabled={loadingMore}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {qrTarget && (
        <QRModal url={qrTarget.url} onClose={() => setQrTarget(null)} />
      )}
    </div>
  );
}
