
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { Input } from "../ui/Input";
import { AliasCreate } from "../alias/AliasCreate";
import { AliasList } from "../alias/AliasList";
import { AliasListSkeleton } from "../alias/AliasListSkeleton";
import { apiGetList, apiPost } from "../../lib/api";
import { copyToClipboard } from "../../lib/utils";
import { setUiState } from "../../lib/storage";
import { getCached, setCache, isFresh, storageKey } from "../../lib/cache";
import type { CacheEntry } from "../../lib/cache";
import { toUserMessage } from "../../lib/errors";
import type { Alias, User, Domain } from "../../lib/types";
import type { PopupActions } from "../App";
import type { ToastAction } from "../ui/Toast";

type FilterMode = "all" | "active" | "inactive";
type SortMode = "newest" | "oldest";

interface AliasTabProps {
  user: User | null;
  onRefreshUser: () => void;
  onError: (msg: string, action?: ToastAction) => void;
  onSuccess: (msg: string) => void;
  onCountChange?: (count: number) => void;
  popupActions: { current: PopupActions };
}

export function AliasTab({ user, onRefreshUser, onError, onSuccess, onCountChange, popupActions }: AliasTabProps) {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAliases();

    // Listen for external cache updates (e.g. background creating an alias)
    const sk = storageKey("aliases");
    function onStorageChanged(changes: Record<string, { newValue?: unknown }>) {
      const change = changes[sk];
      if (!change?.newValue) return;
      const entry = change.newValue as CacheEntry<Alias[]>;
      // Only apply if this is a newer generation than what we already have
      if (entry.generation > cacheGenRef.current) {
        cacheGenRef.current = entry.generation;
        setAliases(entry.data);
      }
    }
    browser.storage.onChanged.addListener(onStorageChanged);
    return () => browser.storage.onChanged.removeListener(onStorageChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    if (user?.features.customDomains) {
      apiGetList<Domain>("/api/v1/domain")
        .then((result) => {
          setDomains(result.data.filter((d) => d.verified).map((d) => d.domain));
        })
        .catch(() => {});
    }
  }, [user]);

  // Escape key cancels creation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && creating) {
      setCreating(false);
    }
  }, [creating]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Compute sorted list (needed for actions)
  const q = search.toLowerCase();
  let filtered = q
    ? aliases.filter(
        (a) =>
          a.email?.toLowerCase().includes(q) ||
          a.label?.toLowerCase().includes(q) ||
          a.note?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q)
      )
    : aliases;

  if (filterMode === "active") filtered = filtered.filter((a) => a.active);
  else if (filterMode === "inactive") filtered = filtered.filter((a) => !a.active);

  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return sortMode === "newest" ? db - da : da - db;
  });

  // Report count changes
  useEffect(() => {
    onCountChange?.(aliases.length);
  }, [aliases.length, onCountChange]);

  // Register popupActions
  useEffect(() => {
    popupActions.current = {
      focusSearch: () => searchRef.current?.focus(),
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
          const alias = sorted[focusedIndex];
          copyToClipboard(alias.email).then(() => onSuccess("Copied!"));
        }
      },
    };
    return () => {
      popupActions.current = {};
    };
  }, [sorted, focusedIndex, onSuccess, popupActions]);

  // Reset focusedIndex when search/filter changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [search, filterMode, sortMode]);

  // Track cache generation so we can detect external updates
  const cacheGenRef = useRef(0);

  async function loadAliases() {
    // Try cache first for instant display
    const cached = await getCached<Alias[]>("aliases");
    if (cached) {
      setAliases(cached.data);
      cacheGenRef.current = cached.generation;
      setLoading(false);
      // Always revalidate in background to stay fresh
      revalidateAliases();
      return;
    }

    setLoading(true);
    try {
      const result = await apiGetList<Alias>("/api/v1/alias?limit=50");
      setAliases(result.data);
      await setCache("aliases", result.data, result.total);
      const entry = await getCached<Alias[]>("aliases");
      if (entry) cacheGenRef.current = entry.generation;
    } catch (err) {
      const msg = toUserMessage(err);
      onError(msg.message, msg.action);
    } finally {
      setLoading(false);
    }
  }

  async function revalidateAliases() {
    setRefreshing(true);
    try {
      const result = await apiGetList<Alias>("/api/v1/alias?limit=50");
      setAliases(result.data);
      await setCache("aliases", result.data, result.total);
    } catch {
      // Keep showing cached data on failure
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await apiGetList<Alias>("/api/v1/alias?limit=50");
      setAliases(result.data);
      await setCache("aliases", result.data, result.total);
    } catch (err) {
      const msg = toUserMessage(err);
      onError(msg.message, msg.action);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleQuickCreate() {
    setQuickCreating(true);
    try {
      const result = await apiPost<Alias>("/api/v1/alias?generate=true", {});
      const alias = result.data;
      const updated = [alias, ...aliases];
      setAliases(updated);
      await setCache("aliases", updated, updated.length);
      await copyToClipboard(alias.email);
      onSuccess(`Created & copied: ${alias.email}`);
      onRefreshUser();
    } catch (err) {
      const msg = toUserMessage(err);
      onError(msg.message, msg.action);
    } finally {
      setQuickCreating(false);
    }
  }

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    setUiState({ aliasSort: mode });
  }

  function handleFilterChange(mode: FilterMode) {
    setFilterMode(mode);
    setUiState({ aliasFilter: mode });
  }


  // Alias count stats
  const randomLimit = user?.aliases?.random.limit ?? null;
  const randomUsed = user?.aliases?.random.used ?? null;
  const randomRemaining = randomLimit !== null && randomUsed !== null ? randomLimit - randomUsed : null;
  const atLimit = randomRemaining !== null && randomRemaining <= 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search bar + buttons — always visible */}
      <div className="flex gap-2 mb-2">
        <Input
          ref={searchRef}
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          placeholder="Search aliases…"
          class="flex-1"
        />
        {/* Quick-create (lightning) */}
        <button
          type="button"
          onClick={handleQuickCreate}
          disabled={quickCreating || atLimit}
          title="Quick create random alias (copies to clipboard)"
          aria-label="Quick create random alias"
          className="h-9 w-9 flex items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all shrink-0 disabled:opacity-40"
        >
          {quickCreating ? (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          )}
        </button>
        {/* Toggle create form */}
        <button
          type="button"
          onClick={() => setCreating((s) => !s)}
          class={`h-9 w-9 flex items-center justify-center rounded-md border border-input transition-all shrink-0 ${
            creating
              ? "bg-primary text-primary-foreground border-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
          title={creating ? "Cancel" : "New alias"}
          aria-label={creating ? "Cancel create" : "New alias"}
        >
          {creating ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          )}
        </button>
      </div>

      {/* Alias count + limit warning */}
      {!loading && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Filter chips */}
            {(["all", "active", "inactive"] as FilterMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleFilterChange(mode)}
                class={`px-2 py-0.5 text-xs rounded-full border transition-colors capitalize ${
                  filterMode === mode
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          {/* Sort + refresh + export */}
          <div className="flex items-center gap-1.5">
<button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              title="Refresh"
              aria-label="Refresh aliases"
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
            <select
              value={sortMode}
              onChange={(e) => handleSortChange((e.target as HTMLSelectElement).value as SortMode)}
              className="text-xs text-muted-foreground bg-background border-none outline-none cursor-pointer hover:text-foreground"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      )}

      {/* Alias limit warning */}
      {atLimit && (
        <p className="text-xs text-destructive mb-2">Alias limit reached</p>
      )}
      {!atLimit && randomRemaining !== null && randomRemaining <= 3 && (
        <p className="text-xs text-muted-foreground mb-2">{randomRemaining} random alias{randomRemaining !== 1 ? "es" : ""} remaining</p>
      )}

      {/* Create form */}
      {creating && (
        <div className="mb-3 p-3 border border-border/60 rounded-xl bg-card animate-slide-down">
          <AliasCreate
            domains={domains}
            onCreated={(alias) => {
              const updated = [alias, ...aliases];
              setAliases(updated);
              setCache("aliases", updated, updated.length);
              setCreating(false);
              onRefreshUser();
            }}
            onCancel={() => setCreating(false)}
            onError={onError}
            onSuccess={onSuccess}
          />
        </div>
      )}

      {loading ? (
        <div className="py-4">
          <AliasListSkeleton />
        </div>
      ) : (
        <div className="overflow-y-auto overflow-x-hidden flex-1">
          <AliasList
            aliases={sorted}
            hasSearch={!!q}
            onClearSearch={() => setSearch("")}
            focusedIndex={focusedIndex}
            onUpdate={(updated) => {
              const newAliases = aliases.map((a) => (a.id === updated.id ? updated : a));
              setAliases(newAliases);
              setCache("aliases", newAliases, newAliases.length);
            }}
            onDelete={(id) => {
              const newAliases = aliases.filter((a) => a.id !== id);
              setAliases(newAliases);
              setCache("aliases", newAliases, newAliases.length);
              onRefreshUser();
            }}
            onError={onError}
            onSuccess={onSuccess}
          />
        </div>
      )}
    </div>
  );
}
