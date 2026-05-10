import { useState, useEffect, useMemo } from "preact/hooks";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { copyToClipboard } from "../../lib/utils";
import { getAliasSettings, setAliasSettings } from "../../lib/storage";
import { toUserMessage } from "../../lib/errors";
import { buildEncryptedAliasPatch, hydrateAliasMetadata } from "../../lib/alias-metadata";
import { createAlias, updateAlias } from "../../lib/service";
import type { Alias, Recipient } from "../../lib/types";
import type { ToastAction } from "../ui/Toast";

interface AliasCreateProps {
  domains: string[];
  recipients: Recipient[];
  vaultStatus: "locked" | "unlocking" | "unlocked";
  onRequireVault: (action?: () => Promise<void>) => void;
  onCreated: (alias: Alias) => void;
  onCancel: () => void;
  onError: (msg: string, action?: ToastAction) => void;
  onSuccess: (msg: string) => void;
}

export function AliasCreate({
  domains,
  recipients,
  vaultStatus,
  onRequireVault,
  onCreated,
  onCancel,
  onError,
  onSuccess,
}: AliasCreateProps) {
  const [mode, setMode] = useState<"random" | "custom">("random");
  const [localPart, setLocalPart] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState("anon.li");
  const [recipientId, setRecipientId] = useState<string>("");

  const availableDomains = useMemo(() => ["anon.li", ...domains], [domains]);
  const verifiedRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.verified),
    [recipients],
  );

  useEffect(() => {
    getAliasSettings().then((settings) => {
      setDomain(availableDomains.includes(settings.domain) ? settings.domain : "anon.li");
      if (settings.defaultFormat) setMode(settings.defaultFormat);
    });
  }, [availableDomains]);

  useEffect(() => {
    const defaultRecipient = verifiedRecipients.find((recipient) => recipient.isDefault) ?? verifiedRecipients[0];
    setRecipientId(defaultRecipient?.id ?? "");
  }, [verifiedRecipients]);

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url?.startsWith("http")) {
        try {
          const hostname = new URL(tab.url).hostname.replace(/^www\./, "");
          setLabel(hostname);
        } catch {
          // Ignore invalid URLs in the active tab.
        }
      }
    });
  }, []);

  async function saveEncryptedMetadata(alias: Alias, nextLabel: string, nextNote: string) {
    const encryptedPatch = await buildEncryptedAliasPatch(alias.id, {
      label: nextLabel.trim() || null,
      note: nextNote.trim() || null,
    });
    const updated = await updateAlias(alias.id, encryptedPatch);
    return hydrateAliasMetadata(updated);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setLoading(true);

    try {
      const alias = await createAlias({
        domain,
        format: mode === "random" ? "random_characters" : "custom",
        ...(mode === "custom" ? { local_part: localPart.trim() } : {}),
        ...(recipientId ? { recipient_ids: [recipientId] } : {}),
      });

      let hydratedAlias = alias;
      if ((label.trim() || note.trim()) && vaultStatus === "unlocked") {
        hydratedAlias = await saveEncryptedMetadata(alias, label, note);
      } else if (label.trim() || note.trim()) {
        onRequireVault(async () => {
          const updatedAlias = await saveEncryptedMetadata(alias, label, note);
          onCreated(updatedAlias);
          onSuccess(`Saved encrypted metadata for ${updatedAlias.email}`);
        });
      }

      await setAliasSettings({ domain, defaultFormat: mode });
      await copyToClipboard(hydratedAlias.email);
      onCreated(hydratedAlias);
      onSuccess(
        label.trim() || note.trim()
          ? `Created ${hydratedAlias.email} — copied!`
          : `Created ${hydratedAlias.email} — copied!`,
      );
    } catch (err) {
      const msg = toUserMessage(err);
      onError(msg.message, msg.action);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex border-b border-border">
        {(["random", "custom"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            class={`flex-1 pb-2 text-xs font-medium transition-colors capitalize ${
              mode === value
                ? "text-foreground border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {mode === "custom" && (
        <div>
          <Input
            value={localPart}
            onInput={(e) => setLocalPart((e.target as HTMLInputElement).value)}
            placeholder="username"
            class="font-mono"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground mt-1">@{domain} will be appended</p>
        </div>
      )}

      <div className="relative">
        <select
          value={domain}
          onChange={(e) => setDomain((e.target as HTMLSelectElement).value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm shadow-sm text-foreground appearance-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
        >
          {availableDomains.map((value) => (
            <option key={value} value={value}>@{value}</option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {verifiedRecipients.length > 1 && (
        <div className="relative">
          <select
            value={recipientId}
            onChange={(e) => setRecipientId((e.target as HTMLSelectElement).value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm shadow-sm text-foreground appearance-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {verifiedRecipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.email}{recipient.isDefault ? " (default)" : ""}
              </option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      )}

      <Input
        value={label}
        onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
        placeholder="Label (encrypted after unlock)"
      />

      <textarea
        value={note}
        onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
        placeholder="Note (encrypted after unlock)"
        maxLength={500}
        rows={2}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
      />

      {(label.trim() || note.trim()) && vaultStatus !== "unlocked" && (
        <p className="text-xs text-muted-foreground">
          The alias will be created now. The extension will ask you to unlock your vault before saving the encrypted label and note.
        </p>
      )}

      <div className="flex gap-2 items-center">
        <Button type="submit" loading={loading} class="flex-1">
          Create & Copy
        </Button>
        <button
          type="button"
          className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
          onClick={onCancel}
          title="Cancel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </form>
  );
}
