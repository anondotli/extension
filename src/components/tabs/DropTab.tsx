
import { useState, useEffect } from "preact/hooks";
import { Spinner } from "../ui/Spinner";
import { DropList } from "../drop/DropList";
import { DropCreate } from "../drop/DropCreate";
import { QRModal } from "../ui/QRModal";
import { apiGetList } from "../../lib/api";
import { getDropKeys, getBaseUrl, setUiState } from "../../lib/storage";
import { copyToClipboard } from "../../lib/utils";
import type { Drop } from "../../lib/types";
import type { PopupActions } from "../App";

type SortMode = "newest" | "oldest" | "downloads";

const PAGE_SIZE = 25;

interface DropTabProps {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  popupActions: { current: PopupActions };
}

export function DropTab({ onError, onSuccess, popupActions }: DropTabProps) {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [dropKeys, setDropKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [qrTarget, setQrTarget] = useState<{ drop: Drop; url: string } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  async function loadDrops(reset = true) {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const offset = reset ? 0 : drops.length;

    try {
      const [result, keys] = await Promise.all([
        apiGetList<Drop>(`/api/v1/drop?limit=${PAGE_SIZE}&offset=${offset}`),
        reset ? getDropKeys() : Promise.resolve(dropKeys),
      ]);

      if (reset) {
        setDrops(result.data);
        setDropKeys(keys);
      } else {
        setDrops((prev) => [...prev, ...result.data]);
      }
      setHasMore(result.total > (reset ? result.data.length : drops.length + result.data.length));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load drops");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    loadDrops();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

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
            onClick={() => loadDrops(true)}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class={loading ? "animate-spin" : ""}
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
              setDrops((prev) => [drop, ...prev]);
              setDropKeys((prev) => ({ ...prev })); // trigger re-read from storage
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
            onError={onError}
            onSuccess={onSuccess}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <DropList
            drops={sorted}
            dropKeys={dropKeys}
            focusedIndex={focusedIndex}
            onUpdate={(updated) =>
              setDrops((prev) =>
                prev.map((d) => (d.id === updated.id ? updated : d))
              )
            }
            onDelete={(id) => setDrops((prev) => prev.filter((d) => d.id !== id))}
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
