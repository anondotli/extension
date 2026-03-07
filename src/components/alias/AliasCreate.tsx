
import { useState, useEffect, useMemo } from "preact/hooks";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { apiPost } from "../../lib/api";
import { copyToClipboard } from "../../lib/utils";
import { getAliasSettings, setAliasSettings } from "../../lib/storage";
import type { Alias } from "../../lib/types";

interface AliasCreateProps {
  domains: string[];
  onCreated: (alias: Alias) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

interface AliasApiResponse {
  id: string;
  email: string;
  active: boolean;
  description: string | null;
  label: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function AliasCreate({ domains, onCreated, onCancel, onError, onSuccess }: AliasCreateProps) {
  const [mode, setMode] = useState<"random" | "custom">("random");
  const [localPart, setLocalPart] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState("anon.li");

  const availableDomains = useMemo(() => ["anon.li", ...domains], [domains]);

  useEffect(() => {
    getAliasSettings().then((s) => {
      setDomain(availableDomains.includes(s.domain) ? s.domain : "anon.li");
    });
  }, [availableDomains]);

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url?.startsWith('http')) {
        try {
          const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
          setLabel(hostname);
        } catch {}
      }
    });
  }, []);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setLoading(true);
    try {
      const body =
        mode === "random"
          ? { domain, format: "random_characters" as const, description: label || undefined, note: note || undefined }
          : { domain, format: "custom" as const, local_part: localPart, description: label || undefined, note: note || undefined };

      const result = await apiPost<AliasApiResponse>("/api/v1/alias", body);
      const data = result.data;
      const alias: Alias = {
        id: data.id,
        email: data.email,
        active: data.active,
        label: data.label ?? null,
        note: data.note ?? null,
        createdAt: data.created_at,
      };

      await setAliasSettings({ domain });
      await copyToClipboard(alias.email);
      onCreated(alias);
      onSuccess(`Created ${alias.email} — copied!`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create alias");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Mode toggle — underline style */}
      <div className="flex border-b border-border">
        {(["random", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            class={`flex-1 pb-2 text-xs font-medium transition-colors capitalize ${
              mode === m
                ? "text-foreground border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Custom local part input */}
      {mode === "custom" && (
        <div>
          <Input
            value={localPart}
            onInput={(e) => setLocalPart((e.target as HTMLInputElement).value)}
            placeholder="username"
            class="font-mono"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground mt-1">
            @{domain} will be appended
          </p>
        </div>
      )}

      {/* Domain selector */}
      <div className="relative">
        <select
          value={domain}
          onChange={(e) => setDomain((e.target as HTMLSelectElement).value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm shadow-sm text-foreground appearance-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {availableDomains.map((d) => (
            <option key={d} value={d}>@{d}</option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <Input
        value={label}
        onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
        placeholder="Label (optional)"
      />

      <textarea
        value={note}
        onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
        placeholder="Note (optional)"
        maxLength={500}
        rows={2}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
      />

      <div className="flex gap-2 items-center">
        <Button type="submit" loading={loading} class="flex-1">
          Create & Copy
        </Button>
        <button
          type="button"
          className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
          onClick={() => onCancel()}
          title="Cancel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </form>
  );
}
