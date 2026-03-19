import { defineBackground } from "wxt/utils/define-background";
import { getApiKey, addIgnoredSite } from "../lib/storage";
import { apiPost, apiGetList, apiGet } from "../lib/api";
import { setCache, getCached } from "../lib/cache";
import { AuthError, RateLimitError, NetworkError } from "../lib/errors";
import type { Alias, Drop, User } from "../lib/types";

export default defineBackground(() => {
  /** Prepend a newly-created alias to the cache so the popup shows it instantly. */
  async function pushAliasToCache(alias: Alias) {
    const cached = await getCached<Alias[]>("aliases");
    const data = cached ? [alias, ...cached.data] : [alias];
    const total = cached ? cached.total + 1 : 1;
    await setCache("aliases", data, total);
  }

  // Onboarding flow
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("/icons/icon-48.png"),
        title: "Welcome to anon.li",
        message: "Please configure your API key to get started.",
      });
      if (typeof browser.action?.openPopup === "function") {
        browser.action.openPopup().catch(() => {});
      } else {
        browser.runtime.openOptionsPage();
      }
    }
  });

  // ── Prefetch & badge ────────────────────────────────────────────────
  async function prefetchAndBadge() {
    const apiKey = await getApiKey();
    if (!apiKey) return;

    try {
      const [aliasResult, dropResult] = await Promise.all([
        apiGetList<Alias>("/api/v1/alias?limit=50"),
        apiGetList<Drop>("/api/v1/drop?limit=25"),
      ]);

      await Promise.all([
        setCache("aliases", aliasResult.data, aliasResult.total),
        setCache("drops", dropResult.data, dropResult.total),
      ]);

      // Badge: warn when alias quota or storage is running low
      try {
        const userResult = await apiGet<User>("/api/v1/me");
        const user = userResult.data;

        const aliasRemaining = user.aliases
          ? user.aliases.random.limit - user.aliases.random.used
          : null;

        const storageUsed = Number(user.storage.used);
        const storageLimit = Number(user.storage.limit);
        const storagePct = storageLimit > 0 ? storageUsed / storageLimit : 0;

        if (aliasRemaining !== null && aliasRemaining <= 0) {
          // Alias limit hit — most urgent
          browser.action.setBadgeText({ text: "0" });
          browser.action.setBadgeBackgroundColor({ color: "#dc2626" });
        } else if (storagePct >= 0.95) {
          // Storage almost full — critical for drops
          browser.action.setBadgeText({ text: "!" });
          browser.action.setBadgeBackgroundColor({ color: "#dc2626" });
        } else if (aliasRemaining !== null && aliasRemaining <= 5) {
          // Alias quota running low
          browser.action.setBadgeText({ text: String(aliasRemaining) });
          browser.action.setBadgeBackgroundColor({ color: "#f59e0b" });
        } else if (storagePct >= 0.8) {
          // Storage getting full
          browser.action.setBadgeText({ text: `${Math.round(storagePct * 100)}%` });
          browser.action.setBadgeBackgroundColor({ color: "#f59e0b" });
        } else {
          browser.action.setBadgeText({ text: "" });
        }
      } catch {
        // Non-critical — skip badge update
      }
    } catch {
      // Silently fail
    }
  }

  // Prefetch on startup
  prefetchAndBadge();

  browser.alarms.create("prefetch", { periodInMinutes: 5 });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "prefetch") prefetchAndBadge();
  });

  // ── Clipboard helper (MV3 offscreen) ──────────────────────────────
  let creatingOffscreen: Promise<void> | null = null;

  async function ensureOffscreenDocument() {
    // @ts-expect-error -- offscreen API types may not be in all builds
    if (typeof chrome?.offscreen?.hasDocument === "function") {
      // @ts-expect-error
      const exists = await chrome.offscreen.hasDocument();
      if (exists) return;
    }
    if (creatingOffscreen) {
      await creatingOffscreen;
      return;
    }
    try {
      // @ts-expect-error
      creatingOffscreen = chrome.offscreen.createDocument({
        url: "offscreen.html",
        // @ts-expect-error
        reasons: [chrome.offscreen.Reason.CLIPBOARD],
        justification: "Copy generated alias to clipboard",
      });
      await creatingOffscreen;
    } finally {
      creatingOffscreen = null;
    }
  }

  async function copyToClipboard(text: string) {
    // Try offscreen API first (Chrome MV3)
    // @ts-expect-error
    if (typeof chrome?.offscreen?.createDocument === "function") {
      await ensureOffscreenDocument();
      // Send message to offscreen document to perform the copy
      await browser.runtime.sendMessage({ type: "OFFSCREEN_COPY", text });
      return;
    }
    // Firefox MV3 supports navigator.clipboard in background
    if (typeof navigator?.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return;
    }
    throw new Error("Clipboard API not available");
  }

  // Context menus
  browser.contextMenus.create({
    id: "generate-alias",
    title: "Generate anon.li alias",
    contexts: ["page", "editable"],
  });

  browser.contextMenus.create({
    id: "generate-alias-for-site",
    title: "Generate anon.li alias for this page",
    contexts: ["page"],
  });

  browser.contextMenus.create({
    id: "ignore-site",
    title: "Don't show anon.li on this site",
    contexts: ["page"],
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "ignore-site") {
      let hostname = "";
      try {
        const pageUrl = info.pageUrl || tab?.url;
        if (pageUrl) hostname = new URL(pageUrl).hostname.replace(/^www\./, "");
      } catch {}

      if (hostname) {
        await addIgnoredSite(hostname);
        browser.notifications.create({
          type: "basic",
          iconUrl: browser.runtime.getURL("/icons/icon-48.png"),
          title: "anon.li — Site ignored",
          message: `anon.li button will no longer appear on ${hostname}`,
        });

        // Tell content script to remove buttons immediately
        const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          browser.tabs.sendMessage(activeTab.id, { type: "SITE_IGNORED" }).catch(() => {});
        }
      }
      return;
    }

    if (
      info.menuItemId === "generate-alias" ||
      info.menuItemId === "generate-alias-for-site"
    ) {
      const key = await getApiKey();
      if (!key) {
        if (typeof browser.action?.openPopup === "function") {
          browser.action.openPopup().catch(() => {});
        } else {
          browser.runtime.openOptionsPage();
        }
        return;
      }

      let hostname = "";
      try {
        const pageUrl = info.pageUrl || tab?.url;
        if (pageUrl) hostname = new URL(pageUrl).hostname.replace(/^www\./, "");
      } catch {}

      try {
        const result = await apiPost<Alias>("/api/v1/alias?generate=true", hostname ? { description: hostname } : {});
        const email = result.data.email;

        // Update cache so popup shows the new alias instantly
        pushAliasToCache(result.data).catch(() => {});

        // Try to fill an active input via the content script first
        let filled = false;
        let copied = false;
        if (tab?.id) {
          try {
            const response = await browser.tabs.sendMessage(tab.id, {
              type: "ALIAS_GENERATED",
              email,
            }) as { filled?: boolean; copied?: boolean } | undefined;
            filled = !!response?.filled;
            copied = !!response?.copied;
          } catch {
            // Content script may not be loaded on this page — that's fine
          }
        }

        // Only use offscreen clipboard if content script couldn't handle it
        if (!filled && !copied) {
          try {
            await copyToClipboard(email);
            copied = true;
          } catch {
            // Clipboard not available — fall back to notification only
          }
        }

        const message = filled
          ? `${email} — filled in input`
          : copied
            ? `${email} — copied to clipboard`
            : email;

        browser.notifications.create({
          type: "basic",
          iconUrl: browser.runtime.getURL("/icons/icon-48.png"),
          title: "anon.li — Alias created",
          message,
        });
      } catch (err) {
        let message: string;
        if (err instanceof AuthError) {
          message = "API key invalid — open settings to fix";
          if (typeof browser.action?.openPopup === "function") {
            browser.action.openPopup().catch(() => {});
          } else {
            browser.runtime.openOptionsPage();
          }
        } else if (err instanceof RateLimitError) {
          const secs = Math.max(0, Math.ceil((err.resetAt.getTime() - Date.now()) / 1000));
          message = `Rate limited. Retry in ${secs}s`;
        } else if (err instanceof NetworkError) {
          message = "You're offline. Check your connection and try again.";
        } else {
          message = err instanceof Error ? err.message : "Failed to generate alias";
        }
        browser.notifications.create({
          type: "basic",
          iconUrl: browser.runtime.getURL("/icons/icon-48.png"),
          title: "anon.li — Error",
          message,
        });
      }
    }
  });

  // Message bus for content script / popup
  browser.runtime.onMessage.addListener(
    (msg: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
      if (typeof msg !== "object" || msg === null) return;
      const type = (msg as { type?: string }).type;

      if (type === "OPEN_POPUP") {
        if (typeof browser.action?.openPopup === "function") {
          browser.action.openPopup().catch(() => {});
        } else {
          browser.runtime.openOptionsPage();
        }
        return;
      }

      if (type === "GENERATE_ALIAS") {
        const hostname = (msg as { hostname?: string }).hostname || "";
        (async () => {
          const key = await getApiKey();
          if (!key) return { error: "No API key configured" };
          try {
            const result = await apiPost<Alias>("/api/v1/alias?generate=true", hostname ? { description: hostname } : {});
            // Update cache so popup shows the new alias instantly
            await pushAliasToCache(result.data).catch(() => {});
            return { data: result.data };
          } catch (err) {
            return { error: err instanceof Error ? err.message : "Failed" };
          }
        })().then(sendResponse);
        return true; // keep channel open for async sendResponse
      }
    },
  );
});
