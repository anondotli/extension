import { Button } from "../ui/Button";
import { getBaseUrl } from "../../lib/storage";

interface DropCreateProps {
  onCreated?: (drop: unknown) => void;
  onCancel: () => void;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

export function DropCreate({ onCancel }: DropCreateProps) {
  async function openWebsite() {
    const baseUrl = await getBaseUrl();
    await browser.tabs.create({ url: `${baseUrl}/drop` });
    onCancel();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-foreground">Create a drop on anon.li</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          File uploads require the full website for end-to-end encryption. Your drops will appear here automatically.
        </p>
      </div>
      <div className="flex gap-2 items-center">
        <Button onClick={openWebsite} className="flex-1">
          Open anon.li ↗
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
    </div>
  );
}
