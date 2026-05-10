import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { Input } from "../ui/Input";
import { AliasCreate } from "../alias/AliasCreate";
import { AliasList } from "../alias/AliasList";
import { AliasListSkeleton } from "../alias/AliasListSkeleton";
import { copyToClipboard } from "../../lib/utils";
import { getAliasSettings, setUiState } from "../../lib/storage";
import { getCached, isFresh, setCache, storageKey } from "../../lib/cache";
import type { CacheEntry } from "../../lib/cache";
import type { Domain } from "../../lib/types";
import { toUserMessage } from "../../lib/errors";
import { hydrateAliasesMetadata, sanitizeAliasesForStorage } from "../../lib/alias-metadata";
import { listAliases, listDomains, listRecipients, quickCreateAlias } from "../../lib/service";
import type { Alias, Recipient, User } from "../../lib/types";
import type { PopupActions } from "../App";
import type { ToastAction } from "../ui/Toast";

type FilterMode = "all" | "active" | "inactive";
type SortMode = "newest" | "oldest";

interface AliasTabProps {
  user: User | null;
  vaultStatus: "locked" | "unlocking" | "unlocked";
  onRequireVault: (action?: () => Promise<void>) => void;
  onRefreshUser: () => void;
  onError: (msg: string, action?: ToastAction) => void;
  onSuccess: (msg: string) => void;
  onCountChange?: (count: number) => void;
  popupActions: { current: PopupActions };
}

export function AliasTab({
  user,
  vaultStatus,
  onRequireVault,
  onRefreshUser,
  onError,
  onSuccess,
  onCountChange,
  popupActions,
}: AliasTabProps) {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const cacheGenRef = useRef(0);
  const aliasesRef = useRef<Alias[]>([]);

  useEffect(() => {
    void loadSupportData();
    void loadAliases();

    const sk = storageKey("aliases");
    function onStorageChanged(changes: Record<string, { newValue?: unknown }>) {
      const change = changes[sk];
      if (!change?.newValue) return;

      const entry = change.newValue as CacheEntry<Alias[]>;
      if (entry.generation <= cacheGenRef.current) return;

      cacheGenRef.current = entry.generation;
      void hydrateAliasesMetadata(entry.data).then((hydrated) => {
        setAliases(hydrated);
      });
    }

    browser.storage.onChanged.addListener(onStorageChanged);
    return () => browser.storage.onChanged.removeListener(onStorageChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    aliasesRef.current = aliases;
  }, [aliases]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && creating) {
        setCreating(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [creating]);

  useEffect(() => {
    let cancelled = false;

    void hydrateAliasesMetadata(sanitizeAliasesForStorage(aliasesRef.current)).then((hydrated) => {
      if (!cancelled) {
        setAliases(hydrated);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [vaultStatus]);

  useEffect(() => {
    onCountChange?.(aliases.length);
  }, [aliases.length, onCountChange]);

  const q = search.toLowerCase();
  let filtered = q
    ? aliases.filter(
        (alias) =>
          alias.email.toLowerCase().includes(q) ||
          alias.label?.toLowerCase().includes(q) ||
          alias.note?.toLowerCase().includes(q),
      )
    : aliases;

  if (filterMode === "active") filtered = filtered.filter((alias) => alias.active);
  if (filterMode === "inactive") filtered = filtered.filter((alias) => !alias.active);

  const sorted = [...filtered].sort((a, b) => {
    const createdA = new Date(a.createdAt).getTime();
    const createdB = new Date(b.createdAt).getTime();
    return sortMode === "newest" ? createdB - createdA : createdA - createdB;
  });

  useEffect(() => {
    popupActions.current = {
      focusSearch: () => searchRef.current?.focus(),
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
        void copyToClipboard(sorted[focusedIndex]!.email).then(() => onSuccess("Copied!"));
      },
    };

    return () => {
      popupActions.current = {};
    };
  }, [focusedIndex, onSuccess, popupActions, sorted]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [search, filterMode, sortMode]);

  async function loadSupportData() {
    const [cachedDomains, cachedRecipients] = await Promise.all([
      getCached<Domain[]>("domains"),
      getCached<Recipient[]>("recipients"),
    ]);

    if (cachedDomains && isFresh(cachedDomains)) {
      setDomains(
        cachedDomains.data
          .filter((record) => record.verified && record.domain !== "anon.li")
          .map((record) => record.domain),
      );
    }
    if (cachedRecipients && isFresh(cachedRecipients)) {
      setRecipients(cachedRecipients.data);
    }

    if (cachedDomains && isFresh(cachedDomains) && cachedRecipients && isFresh(cachedRecipients)) {
      return;
    }

    try {
      const [domainRecords, recipientRecords] = await Promise.all([
        listDomains(),
        listRecipients(),
      ]);
      setDomains(
        domainRecords
          .filter((record) => record.verified && record.domain !== "anon.li")
          .map((record) => record.domain),
      );
      setRecipients(recipientRecords);
      await Promise.all([
        setCache("domains", domainRecords, domainRecords.length),
        setCache("recipients", recipientRecords, recipientRecords.length),
      ]);
    } catch {
      if (!cachedDomains) setDomains([]);
      if (!cachedRecipients) setRecipients([]);
    }
  }

  async function writeAliases(nextAliases: Alias[], total = nextAliases.length) {
    setAliases(nextAliases);
    await setCache("aliases", sanitizeAliasesForStorage(nextAliases), total);
  }

  async function fetchAliases() {
    const result = await listAliases(50);
    const hydrated = await hydrateAliasesMetadata(result.data);
    await setCache("aliases", sanitizeAliasesForStorage(result.data), result.total);
    return { aliases: hydrated, total: result.total };
  }

  async function loadAliases() {
    const cached = await getCached<Alias[]>("aliases");
    if (cached) {
      const hydrated = await hydrateAliasesMetadata(cached.data);
      setAliases(hydrated);
      cacheGenRef.current = cached.generation;
      setLoading(false);
      if (!isFresh(cached)) {
        void revalidateAliases();
      }
      return;
    }

    setLoading(true);
    try {
      const result = await fetchAliases();
      setAliases(result.aliases);
      const entry = await getCached<Alias[]>("aliases");
      if (entry) cacheGenRef.current = entry.generation;
    } catch (error) {
      const message = toUserMessage(error);
      onError(message.message, message.action);
    } finally {
      setLoading(false);
    }
  }

  async function revalidateAliases() {
    setRefreshing(true);
    try {
      const result = await fetchAliases();
      setAliases(result.aliases);
      const entry = await getCached<Alias[]>("aliases");
      if (entry) cacheGenRef.current = entry.generation;
    } catch {
      // Keep cached data on screen.
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await fetchAliases();
      setAliases(result.aliases);
      const entry = await getCached<Alias[]>("aliases");
      if (entry) cacheGenRef.current = entry.generation;
    } catch (error) {
      const message = toUserMessage(error);
      onError(message.message, message.action);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleQuickCreate() {
    setQuickCreating(true);
    try {
      const settings = await getAliasSettings();
      const defaultRecipient = recipients.find((recipient) => recipient.isDefault && recipient.verified)
        ?? recipients.find((recipient) => recipient.verified);

      const alias = await quickCreateAlias({
        domain: settings.domain,
        ...(defaultRecipient ? { recipient_ids: [defaultRecipient.id] } : {}),
      });

      const hydratedAlias = (await hydrateAliasesMetadata([alias]))[0] ?? alias;
      const updatedAliases = [hydratedAlias, ...aliases];
      await writeAliases(updatedAliases);
      await copyToClipboard(hydratedAlias.email);
      onSuccess(`Created & copied: ${hydratedAlias.email}`);
      onRefreshUser();
    } catch (error) {
      const message = toUserMessage(error);
      onError(message.message, message.action);
    } finally {
      setQuickCreating(false);
    }
  }

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    void setUiState({ aliasSort: mode });
  }

  function handleFilterChange(mode: FilterMode) {
    setFilterMode(mode);
    void setUiState({ aliasFilter: mode });
  }

  const randomLimit = user?.aliases?.random.limit ?? null;
  const randomUsed = user?.aliases?.random.used ?? null;
  const randomRemaining = randomLimit !== null && randomUsed !== null ? randomLimit - randomUsed : null;
  const atLimit = randomRemaining !== null && randomRemaining <= 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 mb-2">
        <Input
          ref={searchRef}
          value={search}
          onInput={(event) => setSearch((event.target as HTMLInputElement).value)}
          placeholder="Search aliases…"
          class="flex-1"
        />
        <button
          type="button"
          onClick={() => void handleQuickCreate()}
          disabled={quickCreating || atLimit}
          title="Quick create random alias (copies to clipboard)"
          aria-label="Quick create random alias"
          className="h-9 w-9 flex items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all shrink-0 disabled:opacity-40"
        >
          {quickCreating ? (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCreating((state) => !state)}
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      </div>

      {!loading && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleRefresh()}
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
              onChange={(event) => handleSortChange((event.target as HTMLSelectElement).value as SortMode)}
              className="text-xs text-muted-foreground bg-background border-none outline-none cursor-pointer hover:text-foreground"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      )}

      {atLimit && (
        <p className="text-xs text-destructive mb-2">Alias limit reached</p>
      )}
      {!atLimit && randomRemaining !== null && randomRemaining <= 3 && (
        <p className="text-xs text-muted-foreground mb-2">
          {randomRemaining} random alias{randomRemaining !== 1 ? "es" : ""} remaining
        </p>
      )}

      {creating && (
        <div className="mb-3 p-3 border border-border/60 rounded-xl bg-card animate-slide-down">
          <AliasCreate
            domains={domains}
            recipients={recipients}
            vaultStatus={vaultStatus}
            onRequireVault={onRequireVault}
            onCreated={(alias) => {
              const updatedAliases = aliases.some((existingAlias) => existingAlias.id === alias.id)
                ? aliases.map((existingAlias) => (existingAlias.id === alias.id ? alias : existingAlias))
                : [alias, ...aliases];
              void writeAliases(updatedAliases);
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
            hasSearch={Boolean(q)}
            onClearSearch={() => setSearch("")}
            focusedIndex={focusedIndex}
            vaultStatus={vaultStatus}
            onRequireVault={onRequireVault}
            onUpdate={(updatedAlias) => {
              const nextAliases = aliases.map((alias) => (alias.id === updatedAlias.id ? updatedAlias : alias));
              void writeAliases(nextAliases);
            }}
            onDelete={(id) => {
              const nextAliases = aliases.filter((alias) => alias.id !== id);
              void writeAliases(nextAliases);
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
