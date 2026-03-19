import { defineContentScript } from "wxt/utils/define-content-script";
import { getApiKey, getIgnoredSites, isHostnameIgnored } from "../lib/storage";

export default defineContentScript({
  matches: ["<all_urls>"],
  excludeMatches: ["*://anon.li/*", "*://www.anon.li/*"],
  runAt: "document_idle",
  async main() {
    // Check if this site is on the ignore list
    const ignoredSites = await getIgnoredSites();
    const currentHost = location.hostname.replace(/^www\./, "");
    if (isHostnameIgnored(currentHost, ignoredSites)) return;

    const ATTR = "data-anonli-injected";

    function pickButtonColors(input: HTMLInputElement): { bg: string; fg: string } {
      // Walk up to find a meaningful background
      let el: HTMLElement | null = input.parentElement;
      while (el && el !== document.body) {
        const bg = getComputedStyle(el).backgroundColor;
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          // Skip fully transparent
          if (bg.includes("rgba") && bg.includes(", 0)")) {
            el = el.parentElement;
            continue;
          }
          // Calculate relative luminance
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          if (luminance < 0.5) {
            // Dark background → use light button
            return { bg: "rgba(255,255,255,0.15)", fg: "#ffffff" };
          } else {
            // Light background → use dark button
            return { bg: "rgba(0,0,0,0.08)", fg: "#0d0d0d" };
          }
        }
        el = el.parentElement;
      }
      // Fallback: check system color scheme
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark
        ? { bg: "rgba(255,255,255,0.15)", fg: "#ffffff" }
        : { bg: "rgba(0,0,0,0.08)", fg: "#0d0d0d" };
    }

    const SVG_NS = "http://www.w3.org/2000/svg";

    function createLogoSvg(): SVGSVGElement {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("width", "10");
      svg.setAttribute("height", "10");
      svg.setAttribute("viewBox", "0 0 74.4482 80.1979");
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", "M35.7493 80.0307c-11.8-4.1933-24.826-17.7872-30.599-31.9333-1.4649-3.5892-1.4868-3.8341-.2161-2.4151 1.491 1.6651 2.7252 2.7875 3.9088 3.5544.7994.518 1.3515 1.2376 2.2164 2.8886 5.089 9.7142 13.0484 17.6656 23.1522 23.1285 3.0907 1.6711 3.1433 1.6692 6.5703-.2365 10.2187-5.6827 18.0893-13.657 22.9154-23.2176.571-1.1312 1.1923-1.8855 2.1047-2.5552.712-.5227 2.1423-1.8427 3.1784-2.9334 3.8482-4.0513-2.0974 8.5941-7.2876 15.4995-7.4726 9.9421-21.5054 19.7973-25.9435 18.2201zm-20.4374-30.926C5.8412 46.5475.4083 36.3923.0452 20.5681-.2105 9.427.1017 9.1148 15.4513 5.1608a28388.79 28388.79 0 0 0 16.0671-4.1436c5.7483-1.4856 5.7483-1.4856 15.2135.9505 5.206 1.3399 12.2632 3.1506 15.683 4.024C73.8979 8.9238 74.4567 9.573 74.448 19.9694c-.0157 19.0525-7.6385 30.0487-20.4999 29.5722-16.6233-.6158-18.3918-24.4894-2.0617-27.8319 5.4395-1.1133 12.1037.5125 11.8897 2.9007-.7265 8.1069-9.4624 13.4982-17.4348 10.7598-4.7851-1.6437-1.5047 7.2862 3.5416 9.6408 10.7055 4.9953 19.8165-4.7554 21.02-22.4957.722-10.6436.9781-10.3791-13.6475-14.0872-5.5298-1.402-12.3-3.1316-15.045-3.8436-4.991-1.2947-4.991-1.2947-6.8792-.7722-1.0386.2873-7.3056 1.904-13.9268 3.5928-15.9272 4.0621-15.3558 3.884-16.4933 5.143-3.1219 3.4555-1.0734 19.9929 3.3182 26.7875 6.1488 9.5133 19.1903 8.8993 21.7753-1.0252.8928-3.4276.6746-3.7862-1.7872-2.9374-7.6683 2.6438-15.3542-1.748-17.2453-9.8544-.9618-4.1227 8.8938-5.7768 15.403-2.5851 15.559 7.6291 5.7964 30.7234-11.0633 26.1711z");
      svg.appendChild(path);
      return svg;
    }

    function createSpinnerSvg(): SVGSVGElement {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("width", "10");
      svg.setAttribute("height", "10");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2.5");
      svg.style.animation = "anonli-spin 0.6s linear infinite";
      const path1 = document.createElementNS(SVG_NS, "path");
      path1.setAttribute("d", "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8");
      const path2 = document.createElementNS(SVG_NS, "path");
      path2.setAttribute("d", "M21 3v5h-5");
      svg.appendChild(path1);
      svg.appendChild(path2);
      return svg;
    }

    // Inject spin keyframe once
    if (!document.getElementById("anonli-styles")) {
      const style = document.createElement("style");
      style.id = "anonli-styles";
      style.textContent = `@keyframes anonli-spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    function setBtnContent(btn: HTMLButtonElement, colors: { fg: string }) {
      btn.replaceChildren(createLogoSvg());
      const label = document.createElement("span");
      label.style.cssText = `color:${colors.fg};font-size:10px;font-family:system-ui,sans-serif;line-height:1`;
      label.textContent = "anon.li";
      btn.appendChild(label);
    }

    function findContainer(input: HTMLInputElement): HTMLElement {
      let el: HTMLElement | null = input.parentElement;
      while (el && el !== document.body) {
        const style = getComputedStyle(el);
        const overflow = style.overflow + style.overflowX + style.overflowY;
        if (/hidden|clip/.test(overflow)) {
          el = el.parentElement;
          continue;
        }
        return el;
      }
      // Fallback: use direct parent
      return input.parentElement || document.body;
    }

    function injectButton(input: HTMLInputElement) {
      if (input.getAttribute(ATTR)) return;
      input.setAttribute(ATTR, "true");

      const container = findContainer(input);
      const containerStyle = getComputedStyle(container);
      if (containerStyle.position === "static") {
        container.style.position = "relative";
      }

      const colors = pickButtonColors(input);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = "Generate anon.li alias";
      btn.setAttribute("aria-label", "Generate anon.li alias");
      btn.style.cssText = `
        position: absolute;
        background: ${colors.bg};
        border: none;
        border-radius: 4px;
        padding: 2px 5px;
        cursor: pointer;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: ${colors.fg};
        font-family: system-ui, sans-serif;
        line-height: 1;
        opacity: 0.85;
        transition: opacity 0.15s;
      `;
      setBtnContent(btn, colors);

      btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
      btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.85"; });

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const key = await getApiKey();
        if (!key) {
          browser.runtime.sendMessage({ type: "OPEN_POPUP" }).catch(() => {});
          return;
        }

        btn.replaceChildren(createSpinnerSvg());
        btn.style.opacity = "0.6";

        try {
          const response = await browser.runtime.sendMessage({ type: "GENERATE_ALIAS", hostname: location.hostname.replace(/^www\./, '') }) as
            | { data: { email: string } }
            | { error: string }
            | undefined;

          if (!response || typeof response !== "object") {
            showToast("Failed to generate alias", true);
            return;
          }

          if ("error" in response) {
            showToast(response.error, true);
            return;
          }

          const email = response.data.email;
          input.value = email;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));

          showToast("Alias filled!", false);
        } catch {
          showToast("Failed to generate alias", true);
        } finally {
          setBtnContent(btn, colors);
          btn.style.opacity = "0.85";
        }
      });

      container.appendChild(btn);

      // Position relative to input's bounding rect within the container
      function positionBtn() {
        const inputRect = input.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const topPx = inputRect.top - containerRect.top + container.scrollTop + inputRect.height / 2;
        const rightPx = containerRect.right - inputRect.right + 8;
        btn.style.top = `${topPx}px`;
        btn.style.right = `${rightPx}px`;
        btn.style.transform = "translateY(-50%)";
      }
      positionBtn();

      // Measure actual button width for input padding
      const btnWidth = btn.offsetWidth + 8;
      const currentPaddingRight = parseInt(getComputedStyle(input).paddingRight || "0", 10);
      input.style.paddingRight = `${Math.max(currentPaddingRight, btnWidth)}px`;
    }

    function showToast(message: string, isError: boolean) {
      const toast = document.createElement("div");
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${isError ? "#dc2626" : "#16a34a"};
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-family: system-ui, sans-serif;
        z-index: 2147483647;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      `;
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    function isEmailField(el: Element): el is HTMLInputElement {
      if (!(el instanceof HTMLInputElement)) return false;
      const type = el.type.toLowerCase();
      const name = (el.name || "").toLowerCase();
      const placeholder = (el.placeholder || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      return (
        type === "email" ||
        name.includes("email") ||
        placeholder.includes("email") ||
        id.includes("email")
      );
    }

    function scanAndInject() {
      document.querySelectorAll("input").forEach((input) => {
        if (isEmailField(input)) {
          injectButton(input);
        }
      });
    }

    // Initial scan
    scanAndInject();

    // Watch for new inputs (SPAs) — debounced to reduce overhead
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(scanAndInject, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Track the last right-clicked input for context menu alias generation.
    // Use capture phase so page handlers can't stopPropagation before us.
    // Also use elementsFromPoint to find inputs under overlay elements.
    let lastRightClickedInput: HTMLInputElement | HTMLTextAreaElement | null = null;

    function findInputAt(e: MouseEvent): HTMLInputElement | HTMLTextAreaElement | null {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return target;
      }
      // Check all elements at click position (handles overlay divs on top of inputs)
      for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          return el;
        }
      }
      return null;
    }

    document.addEventListener("contextmenu", (e) => {
      lastRightClickedInput = findInputAt(e);
    }, true);

    // Also track last focused input — backup for when contextmenu target detection fails
    let lastFocusedInput: HTMLInputElement | HTMLTextAreaElement | null = null;

    document.addEventListener("focusin", (e) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        lastFocusedInput = target;
      }
    }, true);

    async function copyText(text: string): Promise<boolean> {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback for when async clipboard API isn't available
        const el = document.createElement("textarea");
        el.value = text;
        el.style.cssText = "position:fixed;opacity:0;left:-9999px";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        el.remove();
        return ok;
      }
    }

    // Listen for messages from background script
    // NOTE: @wxt-dev/browser is NOT webextension-polyfill — it's a thin alias
    // for chrome.* on Chrome. We must use sendResponse + return true for async
    // responses, since Promise returns aren't reliably handled.
    browser.runtime.onMessage.addListener(
      (msg: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
        if (typeof msg !== "object" || msg === null) return;
        const type = (msg as { type?: string }).type;

        if (type === "ALIAS_GENERATED") {
          const email = (msg as { email?: string }).email;
          if (!email) {
            sendResponse({ filled: false, copied: false });
            return;
          }

          // Try: right-clicked input → focused input → active element
          const active = document.activeElement;
          let target: HTMLInputElement | HTMLTextAreaElement | null = null;
          if (lastRightClickedInput && document.contains(lastRightClickedInput)) {
            target = lastRightClickedInput;
          } else if (lastFocusedInput && document.contains(lastFocusedInput)) {
            target = lastFocusedInput;
          } else if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
            target = active;
          }

          lastRightClickedInput = null;

          if (target) {
            target.value = email;
            target.dispatchEvent(new Event("input", { bubbles: true }));
            target.dispatchEvent(new Event("change", { bubbles: true }));
            target.focus();
            showToast("Alias filled!", false);
            sendResponse({ filled: true, copied: false });
            return;
          }

          // No input to fill — copy to clipboard from content script (async)
          copyText(email).then((ok) => {
            if (ok) showToast("Alias copied to clipboard!", false);
            sendResponse({ filled: false, copied: ok });
          });
          return true; // keep message channel open for async sendResponse
        }

        if (type === "SITE_IGNORED") {
          // Remove all injected buttons and stop observing
          observer.disconnect();
          if (debounceTimer) clearTimeout(debounceTimer);
          document.querySelectorAll(`[${ATTR}]`).forEach((input) => {
            const container = findContainer(input as HTMLInputElement);
            container.querySelectorAll('button[title="Generate anon.li alias"]').forEach((btn) => btn.remove());
            input.removeAttribute(ATTR);
          });
        }
      },
    );

    // Live-update: if ignore list changes from Settings while page is open
    browser.storage.onChanged.addListener((changes) => {
      if (changes.ignoredSites) {
        const newList = (changes.ignoredSites.newValue as string[]) ?? [];
        if (isHostnameIgnored(currentHost, newList)) {
          observer.disconnect();
          if (debounceTimer) clearTimeout(debounceTimer);
          document.querySelectorAll(`[${ATTR}]`).forEach((input) => {
            const container = findContainer(input as HTMLInputElement);
            container.querySelectorAll('button[title="Generate anon.li alias"]').forEach((btn) => btn.remove());
            input.removeAttribute(ATTR);
          });
        }
      }
    });
  },
});
