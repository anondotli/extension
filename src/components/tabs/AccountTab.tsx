
import { useState, useEffect } from "preact/hooks";
import { Badge } from "../ui/Badge";
import { formatBytes } from "../../lib/utils";
import { getBaseUrl } from "../../lib/storage";
import type { User } from "../../lib/types";

interface AccountPanelProps {
  user: User | null;
  onClose: () => void;
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="h-1 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const tierColor: Record<string, "default" | "secondary" | "outline"> = {
  free: "secondary",
  plus: "default",
  pro: "outline",
};

export function AccountPanel({ user, onClose }: AccountPanelProps) {
  const [baseUrl, setBaseUrlState] = useState("https://anon.li");

  useEffect(() => {
    getBaseUrl().then(setBaseUrlState);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
        <span className="text-sm font-medium text-foreground">Account</span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Close"
          aria-label="Close account panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Panel body */}
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
        {!user ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Not signed in</p>
          </div>
        ) : (
          <>
            {/* Profile */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.email}</p>
              </div>
              <Badge variant={tierColor[user.tier] ?? "secondary"}>{user.tier}</Badge>
            </div>

            {/* Aliases */}
            {user.aliases && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-foreground">Aliases</p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Random</span>
                    <span>{user.aliases.random.used} / {user.aliases.random.limit}</span>
                  </div>
                  <UsageBar used={user.aliases.random.used} limit={user.aliases.random.limit} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                    <span>Custom</span>
                    <span>{user.aliases.custom.used} / {user.aliases.custom.limit}</span>
                  </div>
                  <UsageBar used={user.aliases.custom.used} limit={user.aliases.custom.limit} />
                </div>
              </div>
            )}

            {/* Storage */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Storage</span>
                <span>{formatBytes(Number(user.storage.used))} / {formatBytes(Number(user.storage.limit))}</span>
              </div>
              <UsageBar used={Number(user.storage.used)} limit={Number(user.storage.limit)} />
            </div>

            {/* Drops */}
            {user.drops !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Drops</span>
                <span className="text-foreground">{user.drops.count}</span>
              </div>
            )}

            {/* Limits */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-foreground">Limits</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Max file size</span>
                <span className="text-right text-foreground">{formatBytes(user.limits.max_file_size)}</span>
                <span className="text-muted-foreground">Max expiry</span>
                <span className="text-right text-foreground">{user.limits.max_expiry_days}d</span>
                <span className="text-muted-foreground">API req / mo</span>
                <span className="text-right text-foreground">{user.limits.api_requests.toLocaleString()}</span>
              </div>
            </div>
            {/* Upgrade CTA for free tier */}
            {user.tier === "free" && (
              <a
                href={`${baseUrl}/dashboard/billing`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-border/60 bg-card hover:bg-accent/50 transition-colors group"
              >
                <div>
                  <p className="text-xs font-medium text-foreground">Upgrade to Plus</p>
                  <p className="text-xs text-muted-foreground mt-0.5">More storage, aliases &amp; features</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
