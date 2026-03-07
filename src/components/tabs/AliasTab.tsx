
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { Input } from "../ui/Input";
import { Spinner } from "../ui/Spinner";
import { AliasCreate } from "../alias/AliasCreate";
import { AliasList } from "../alias/AliasList";
import { apiGetList, apiPost } from "../../lib/api";
import { copyToClipboard } from "../../lib/utils";
import { setUiState } from "../../lib/storage";
import type { Alias, User, Domain } from "../../lib/types";
import type { PopupActions } from "../App";

type FilterMode = "all" | "active" | "inactive";
type SortMode = "newest" | "oldest";

interface AliasTabProps {
  user: User | null;
  onRefreshUser: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  popupActions: { current: PopupActions };
}

export function AliasTab({ user, onRefreshUser, onError, onSuccess, popupActions }: AliasTabProps) {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    if (user?.features.customDomains) {
      apiGetList<Domain>("/api/v1/domain")
        .then((result) => {
          setDomains(result.data.filter((d) => d.verified).map((d) => d.domain));
        })
        .catch(() => {
          // Silently ignore domain fetch errors
        });
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
          a.label?.toLowerCase().includes(q)
      )
    : aliases;

  if (filterMode === "active") filtered = filtered.filter((a) => a.active);
  else if (filterMode === "inactive") filtered = filtered.filter((a) => !a.active);

  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return sortMode === "newest" ? db - da : da - db;
  });

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

  async function loadAliases() {
    setLoading(true);
    try {
      const result = await apiGetList<Alias>("/api/v1/alias?limit=50");
      setAliases(result.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load aliases");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickCreate() {
    setQuickCreating(true);
    try {
      const result = await apiPost<Alias>("/api/v1/alias?generate=true", {});
      const alias = result.data;
      setAliases((prev) => [alias, ...prev]);
      await copyToClipboard(alias.email);
      onSuccess(`Created & copied: ${alias.email}`);
      onRefreshUser();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create alias");
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
          {/* Sort + count */}
          <div className="flex items-center gap-1.5">
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
              setAliases((prev) => [alias, ...prev]);
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
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="overflow-y-auto overflow-x-hidden flex-1">
          <AliasList
            aliases={sorted}
            focusedIndex={focusedIndex}
            onUpdate={(updated) =>
              setAliases((prev) =>
                prev.map((a) => (a.id === updated.id ? updated : a))
              )
            }
            onDelete={(id) => {
              setAliases((prev) => prev.filter((a) => a.id !== id));
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
