import { defineBackground } from "wxt/utils/define-background";
import { getApiKey } from "../lib/storage";
import { apiPost } from "../lib/api";
import type { Alias } from "../lib/types";

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

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
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
