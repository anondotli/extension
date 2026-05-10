import { defineBackground } from "wxt/utils/define-background";
import { getApiKey, addIgnoredSite, getAliasSettings, setCachedUser } from "../lib/storage";
import { setCache, getCached } from "../lib/cache";
import { AuthError } from "../lib/errors";
import type { Alias } from "../lib/types";
import { getUserProfile, quickCreateAlias } from "../lib/service";

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
      if (typeof browser.action?.openPopup === "function") {
        browser.action.openPopup().catch(() => {});
      } else {
        browser.runtime.openOptionsPage();
      }
    }
  });

  // ── Badge update ─────────────────────────────────────────────────────
  // Only fetches /me — list caches are populated by the popup on demand.
  async function updateBadge() {
    const apiKey = await getApiKey();
    if (!apiKey) return;

    try {
      const user = await getUserProfile();
      await setCachedUser(user);

      const aliasRemaining = user.aliases
        ? user.aliases.random.limit - user.aliases.random.used
        : null;

      const storageUsed = Number(user.storage.used);
      const storageLimit = Number(user.storage.limit);
      const storagePct = storageLimit > 0 ? storageUsed / storageLimit : 0;

      if (aliasRemaining !== null && aliasRemaining <= 0) {
        browser.action.setBadgeText({ text: "0" });
        browser.action.setBadgeBackgroundColor({ color: "#dc2626" });
      } else if (storagePct >= 0.95) {
        browser.action.setBadgeText({ text: "!" });
        browser.action.setBadgeBackgroundColor({ color: "#dc2626" });
      } else if (aliasRemaining !== null && aliasRemaining <= 5) {
        browser.action.setBadgeText({ text: String(aliasRemaining) });
        browser.action.setBadgeBackgroundColor({ color: "#f59e0b" });
      } else if (storagePct >= 0.8) {
        browser.action.setBadgeText({ text: `${Math.round(storagePct * 100)}%` });
        browser.action.setBadgeBackgroundColor({ color: "#f59e0b" });
      } else {
        browser.action.setBadgeText({ text: "" });
      }
    } catch {
      // Non-critical
    }
  }

  // One initial poll so the badge is live after install/upgrade, then a slow alarm.
  updateBadge();
  browser.alarms.create("badge", { periodInMinutes: 30 });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "badge") updateBadge();
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
        const aliasSettings = await getAliasSettings();
        const alias = await quickCreateAlias({
          domain: aliasSettings.domain,
        });
        const email = alias.email;

        // Update cache so popup shows the new alias instantly
        pushAliasToCache(alias).catch(() => {});

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
            // Clipboard not available
          }
        }

      } catch (err) {
        if (err instanceof AuthError) {
          if (typeof browser.action?.openPopup === "function") {
            browser.action.openPopup().catch(() => {});
          } else {
            browser.runtime.openOptionsPage();
          }
        }
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
        void (msg as { hostname?: string }).hostname;
        (async () => {
          const key = await getApiKey();
          if (!key) return { error: "No API key configured" };
          try {
            const aliasSettings = await getAliasSettings();
            const alias = await quickCreateAlias({
              domain: aliasSettings.domain,
            });
            // Update cache so popup shows the new alias instantly
            await pushAliasToCache(alias).catch(() => {});
            return { data: alias };
          } catch (err) {
            return { error: err instanceof Error ? err.message : "Failed" };
          }
        })().then(sendResponse);
        return true; // keep channel open for async sendResponse
      }
    },
  );
});
