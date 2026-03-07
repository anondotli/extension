import { useState, useEffect } from "preact/hooks";
import QRCode from "qrcode";

interface QRModalProps {
  url: string;
  onClose: () => void;
}

export function QRModal({ url, onClose }: QRModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((du) => setDataUrl(du))
      .catch(() => setError(true));
  }, [url]);

  // Close on Escape — handled by App.tsx global handler for panels,
  // but we need our own since this is an overlay inside a tab
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm animate-slide-up"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col items-center gap-4 p-6 rounded-2xl border border-border bg-card luxury-shadow-md max-w-[320px] w-full mx-4">
        <div className="flex items-center justify-between w-full">
          <span className="text-sm font-medium text-foreground">Share Drop</span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {error ? (
          <p className="text-sm text-destructive">Failed to generate QR code</p>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- extension context, not Next.js
          <img
            src={dataUrl}
            alt="QR code for drop URL"
            width={280}
            height={280}
            className="rounded-xl"
          />
        ) : (
          <div className="w-[280px] h-[280px] flex items-center justify-center bg-muted rounded-xl">
            <svg className="animate-spin text-muted-foreground" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </div>
        )}

        <p className="text-xs text-muted-foreground font-mono text-center break-all leading-relaxed max-h-[48px] overflow-hidden">
          {url.length > 60 ? url.slice(0, 57) + "…" : url}
        </p>
      </div>
    </div>
  );
}
