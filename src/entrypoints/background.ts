import { defineBackground } from "wxt/utils/define-background";
import { getApiKey, addIgnoredSite } from "../lib/storage";
import { apiPost, apiGetList, apiGet } from "../lib/api";
import { setCache } from "../lib/cache";
import type { Alias, Drop, User } from "../lib/types";

export default defineBackground(() => {
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

  // Context menus
  browser.contextMenus.create({
    id: "generate-alias",
    title: "Generate anon.li alias",
    contexts: ["all"],
  });

  browser.contextMenus.create({
    id: "generate-alias-for-site",
    title: "Generate anon.li alias for this page",
    contexts: ["page"],
  });

  browser.contextMenus.create({
    id: "ignore-site",
    title: "Don't show anon.li on this site",
    contexts: ["all"],
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

        // Copy to clipboard via offscreen or notification
        // Notification always works from background
        browser.notifications.create({
          type: "basic",
          iconUrl: browser.runtime.getURL("/icons/icon-48.png"),
          title: "anon.li — Alias created",
          message: email,
        });

        // Send to active tab content script to fill in email field if focused
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          browser.tabs.sendMessage(tab.id, {
            type: "ALIAS_GENERATED",
            email,
          }).catch(() => {
            // Content script may not be loaded on this page — that's fine
          });
        }
      } catch (err) {
        browser.notifications.create({
          type: "basic",
          iconUrl: browser.runtime.getURL("/icons/icon-48.png"),
          title: "anon.li — Error",
          message: err instanceof Error ? err.message : "Failed to generate alias",
        });
      }
    }
  });

  // Message bus for content script / popup
  browser.runtime.onMessage.addListener(
    (msg: unknown, _sender, sendResponse) => {
      if (
        typeof msg === "object" &&
        msg !== null &&
        (msg as { type?: string }).type === "OPEN_POPUP"
      ) {
        if (typeof browser.action?.openPopup === "function") {
          browser.action.openPopup().catch(() => {});
        } else {
          browser.runtime.openOptionsPage();
        }
        return;
      }

      if (
        typeof msg === "object" &&
        msg !== null &&
        (msg as { type?: string }).type === "GENERATE_ALIAS"
      ) {
        const hostname = (msg as { hostname?: string }).hostname || "";
        getApiKey().then((key) => {
          if (!key) {
            sendResponse({ error: "No API key configured" });
            return;
          }
          apiPost<Alias>("/api/v1/alias?generate=true", hostname ? { description: hostname } : {})
            .then((result) => sendResponse({ data: result.data }))
            .catch((err) =>
              sendResponse({
                error: err instanceof Error ? err.message : "Failed",
              })
            );
        });
        return true; // async response
      }
    }
  );
});
