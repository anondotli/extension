
import { useState, useRef, useEffect } from "preact/hooks";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import { apiPatch, apiDelete } from "../../lib/api";
import { copyToClipboard, formatExpiry, formatDate, truncate } from "../../lib/utils";
import { getBaseUrl, removeDropKey } from "../../lib/storage";
import type { Drop } from "../../lib/types";

interface DropListProps {
  drops: Drop[];
  dropKeys: Record<string, string>;
  focusedIndex?: number;
  onUpdate: (drop: Drop) => void;
  onDelete: (id: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onOpenQr?: (drop: Drop, url: string) => void;
}

export function DropList({ drops, dropKeys, focusedIndex = -1, onUpdate, onDelete, onError, onSuccess, onOpenQr }: DropListProps) {
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemElRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < drops.length) {
      itemElRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex, drops.length]);

  function startConfirmDelete(id: string) {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmDelete(id);
    confirmTimerRef.current = setTimeout(() => setConfirmDelete(null), 4000);
  }

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  async function handleToggle(drop: Drop) {
    setToggling(drop.id);
    try {
      const result = await apiPatch<{ disabled: boolean }>(`/api/v1/drop/${drop.id}?action=toggle`, {});
      onUpdate({ ...drop, disabled: result.data.disabled });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to toggle drop");
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(drop: Drop) {
    if (confirmDelete !== drop.id) {
      startConfirmDelete(drop.id);
      return;
    }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setDeleting(drop.id);
    setConfirmDelete(null);
    try {
      await apiDelete(`/api/v1/drop/${drop.id}`);
      onDelete(drop.id);
      removeDropKey(drop.id);
      onSuccess("Drop deleted");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete drop");
    } finally {
      setDeleting(null);
    }
  }

  async function handleCopy(drop: Drop) {
    const baseUrl = await getBaseUrl();
    const key = dropKeys[drop.id];
    const url = key ? `${baseUrl}/d/${drop.id}#${key}` : `${baseUrl}/d/${drop.id}`;
    await copyToClipboard(url);
    onSuccess(key ? "URL with key copied" : "URL copied (no key \u2014 visit the drop page to capture it)");
  }

  async function handleOpen(drop: Drop) {
    const baseUrl = await getBaseUrl();
    const key = dropKeys[drop.id];
    const url = key ? `${baseUrl}/d/${drop.id}#${key}` : `${baseUrl}/d/${drop.id}`;
    await browser.tabs.create({ url });
  }

  async function handleQr(drop: Drop) {
    const baseUrl = await getBaseUrl();
    const key = dropKeys[drop.id];
    const url = key ? `${baseUrl}/d/${drop.id}#${key}` : `${baseUrl}/d/${drop.id}`;
    if (onOpenQr) onOpenQr(drop, url);
  }

  if (drops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 border-2 border-dashed border-border/60 rounded-xl text-center px-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" className="text-muted-foreground/50">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">No drops yet</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
            Drops are end-to-end encrypted file shares. Create one at anon.li, then track it here.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const baseUrl = await getBaseUrl();
            await browser.tabs.create({ url: `${baseUrl}/drop` });
          }}
          className="text-xs font-medium text-primary hover:underline underline-offset-2 transition-colors"
        >
          Create a drop ↗
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {drops.map((drop, idx) => {
        const hasKey = !!dropKeys[drop.id];
        return (
          <div
            key={drop.id}
            ref={(el) => { itemElRefs.current[idx] = el; }}
            class={`py-2 flex flex-col gap-1.5 transition-opacity duration-200 ${drop.disabled ? "opacity-50" : ""} ${
              focusedIndex === idx ? "bg-accent/50 -mx-2 px-2 rounded-lg" : ""
            }`}
          >
            {/* Primary label: human-readable date */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-foreground">
                  {formatDate(drop.createdAt)}
                </span>
                <span className="ml-2 text-xs font-mono text-muted-foreground/60">
                  {truncate(drop.id, 10)}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* QR code button */}
                {onOpenQr && (
                  <Button variant="ghost" size="icon" title="QR code" onClick={() => handleQr(drop)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                  </Button>
                )}
                <Button variant="ghost" size="icon" title="Copy link" onClick={() => handleCopy(drop)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </Button>
                <Button variant="ghost" size="icon" title="Open in tab" onClick={() => handleOpen(drop)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </Button>
                <Toggle
                  checked={!drop.disabled}
                  onChange={() => handleToggle(drop)}
                  loading={toggling === drop.id}
                />
                {confirmDelete === drop.id ? (
                  <button
                    type="button"
                    className="shrink-0 p-1 rounded text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
                    disabled={deleting === drop.id}
                    onClick={() => handleDelete(drop)}
                    title="Confirm delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete"
                    loading={deleting === drop.id}
                    onClick={() => handleDelete(drop)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </Button>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>{drop.fileCount} file{drop.fileCount !== 1 ? "s" : ""}</span>
              <span>{drop.downloadCount} downloads</span>
              {drop.expiresAt && <span>{formatExpiry(drop.expiresAt)}</span>}
              {drop.disabled && <span className="text-destructive/70">Disabled</span>}
            </div>

            {/* Missing key banner */}
            {!hasKey && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="shrink-0"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                <span>No key stored</span>
                <button
                  type="button"
                  onClick={() => handleOpen(drop)}
                  className="ml-auto text-primary hover:underline underline-offset-2 font-medium"
                >
                  Open to capture ↗
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
