import { useMemo, useRef, useState } from "preact/hooks";
import { Button } from "../ui/Button";
import { copyToClipboard, formatBytes } from "../../lib/utils";
import { uploadDrop, type DropUploadProgress } from "../../lib/drop-upload";
import type { User } from "../../lib/types";

interface DropCreateProps {
  user: User | null;
  vaultStatus: "locked" | "unlocking" | "unlocked";
  onRequireVault: (action?: () => Promise<void>) => void;
  onCreated?: (dropId: string, shareUrl: string) => void;
  onCancel: () => void;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export function DropCreate({
  user,
  vaultStatus,
  onRequireVault,
  onCreated,
  onCancel,
  onError,
  onSuccess,
}: DropCreateProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiryDays, setExpiryDays] = useState("7");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [password, setPassword] = useState("");
  const [hideBranding, setHideBranding] = useState(false);
  const [notifyOnDownload, setNotifyOnDownload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<DropUploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const remainingStorage = useMemo(() => {
    if (!user) return 0;
    return Math.max(0, Number(user.storage.limit) - Number(user.storage.used));
  }, [user]);

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  const maxExpiryDays = user?.limits.maxExpiryDays ?? 30;
  const maxFileSize = user?.limits.maxFileSize ?? Number.MAX_SAFE_INTEGER;
  const customKeyAllowed = Boolean(user?.features.customKey);
  const downloadLimitsAllowed = Boolean(user?.features.downloadLimits);
  const noBrandingAllowed = Boolean(user?.features.noBranding);
  const notifyAllowed = Boolean(user?.features.downloadNotifications);

  function reset() {
    setFiles([]);
    setTitle("");
    setMessage("");
    setExpiryDays(String(Math.min(7, maxExpiryDays)));
    setMaxDownloads("");
    setPassword("");
    setHideBranding(false);
    setNotifyOnDownload(false);
    setProgress(null);
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function validate(): string | null {
    if (!user) return "Account details are still loading";
    if (files.length === 0) return "Select at least one file";
    if (files.some((file) => file.size > maxFileSize)) {
      return `Each file must be ${formatBytes(maxFileSize)} or smaller`;
    }
    if (totalBytes > remainingStorage) {
      return "This upload exceeds your remaining storage";
    }
    if (Number(expiryDays) < 1 || Number(expiryDays) > maxExpiryDays) {
      return `Expiry must be between 1 and ${maxExpiryDays} days`;
    }
    if (maxDownloads && (!downloadLimitsAllowed || Number(maxDownloads) < 1)) {
      return "Max downloads must be at least 1";
    }
    if (password && !customKeyAllowed) {
      return "Custom-key protection is not available on your plan";
    }
    if (password && password.length < 8) {
      return "Password protection requires at least 8 characters";
    }

    return null;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      onError?.(validationError);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await uploadDrop({
        files,
        title: title.trim() || undefined,
        message: message.trim() || undefined,
        expiryDays: Number(expiryDays),
        maxDownloads: maxDownloads ? Number(maxDownloads) : undefined,
        password: password || undefined,
        hideBranding: hideBranding && noBrandingAllowed,
        notifyOnDownload: notifyOnDownload && notifyAllowed,
        signal: controller.signal,
        onProgress: setProgress,
      });

      await copyToClipboard(result.shareUrl);
      onCreated?.(result.dropId, result.shareUrl);
      onSuccess?.(
        result.customKey
          ? "Drop created. Password-protected link copied."
          : "Drop created. Encrypted link copied.",
      );
      reset();
      onCancel();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      if (message === "Upload cancelled") {
        onSuccess?.("Upload cancelled");
      } else {
        onError?.(message);
        setProgress(null);
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  }

  function handleAbortOrClose() {
    if (loading) {
      abortControllerRef.current?.abort();
      setLoading(false);
      setProgress(null);
      return;
    }

    onCancel();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-foreground">Create encrypted drop</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Upload directly from the extension. Standard drops copy an encrypted link with the key fragment.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-border/70 p-3 bg-muted/20">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(event) => setFiles(Array.from((event.target as HTMLInputElement).files ?? []))}
          className="w-full text-xs text-foreground file:mr-3 file:h-8 file:border-0 file:rounded-md file:bg-primary file:px-3 file:text-xs file:font-medium file:text-primary-foreground"
        />
        {files.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {files.map((file) => (
              <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2">
                <span className="truncate">{file.name}</span>
                <span className="shrink-0">{formatBytes(file.size)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 pt-1 text-foreground">
              <span>{files.length} file{files.length === 1 ? "" : "s"}</span>
              <span>{formatBytes(totalBytes)}</span>
            </div>
          </div>
        )}
      </div>

      <input
        type="text"
        value={title}
        onInput={(event) => setTitle((event.target as HTMLInputElement).value)}
        placeholder="Title (optional)"
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
      />

      <textarea
        value={message}
        onInput={(event) => setMessage((event.target as HTMLTextAreaElement).value)}
        placeholder="Message (optional)"
        rows={2}
        maxLength={2000}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Expiry</span>
          <input
            type="number"
            min={1}
            max={maxExpiryDays}
            value={expiryDays}
            onInput={(event) => setExpiryDays((event.target as HTMLInputElement).value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Max downloads</span>
          <input
            type="number"
            min={1}
            value={maxDownloads}
            disabled={!downloadLimitsAllowed}
            onInput={(event) => setMaxDownloads((event.target as HTMLInputElement).value)}
            placeholder={downloadLimitsAllowed ? "Unlimited" : "Plan upgrade required"}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Password protection</span>
        <input
          type="password"
          value={password}
          disabled={!customKeyAllowed}
          onInput={(event) => setPassword((event.target as HTMLInputElement).value)}
          placeholder={customKeyAllowed ? "Optional custom key password" : "Plan upgrade required"}
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
        />
      </label>

      {(noBrandingAllowed || notifyAllowed) && (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 p-3 bg-muted/20">
          {noBrandingAllowed && (
            <label className="flex items-center justify-between gap-3 text-xs text-foreground">
              <span>Hide anon.li branding</span>
              <input
                type="checkbox"
                checked={hideBranding}
                onChange={() => setHideBranding((value) => !value)}
              />
            </label>
          )}
          {notifyAllowed && (
            <label className="flex items-center justify-between gap-3 text-xs text-foreground">
              <span>Notify on download</span>
              <input
                type="checkbox"
                checked={notifyOnDownload}
                onChange={() => setNotifyOnDownload((value) => !value)}
              />
            </label>
          )}
        </div>
      )}

      {user && (
        <div className="rounded-lg border border-border/60 p-3 bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2">
            <span>Remaining storage</span>
            <span>{formatBytes(remainingStorage)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span>Max file size</span>
            <span>{formatBytes(maxFileSize)}</span>
          </div>
        </div>
      )}

      {vaultStatus !== "unlocked" && (
        <div className="rounded-lg border border-border/60 p-3 bg-muted/20 text-xs text-muted-foreground">
          <p>
            Unlock your vault if you want the extension and website to sync this drop key automatically.
          </p>
          <button
            type="button"
            onClick={() => onRequireVault()}
            className="mt-2 text-primary hover:underline underline-offset-2"
          >
            Unlock vault
          </button>
        </div>
      )}

      {progress && (
        <div className="rounded-lg border border-border/60 p-3 bg-card text-xs">
          <div className="flex items-center justify-between gap-2 text-foreground">
            <span className="capitalize">{progress.phase}</span>
            <span>{progress.uploadedChunks} / {progress.totalChunks} chunks</span>
          </div>
          <p className="mt-1 text-muted-foreground truncate">
            File {progress.currentFileIndex} of {progress.totalFiles}: {progress.currentFileName}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${Math.min(100, (progress.bytesUploaded / Math.max(progress.totalBytes, 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Button type="submit" loading={loading} class="flex-1">
          {loading ? "Uploading…" : "Upload & Copy"}
        </Button>
        <button
          type="button"
          className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
          onClick={handleAbortOrClose}
          title={loading ? "Cancel upload" : "Cancel"}
          aria-label={loading ? "Cancel upload" : "Cancel"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </form>
  );
}
