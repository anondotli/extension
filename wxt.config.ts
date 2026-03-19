import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "anon.li",
    description: "Anonymous email aliases and encrypted file sharing",
    version: "1.1.0",
    homepage_url: "https://anon.li",
    permissions: [
      "storage",
      "contextMenus",
      "activeTab",
      "clipboardWrite",
      "notifications",
      "alarms",
    ],
    host_permissions: ["https://anon.li/*"],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    icons: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "96": "icons/icon-96.png",
      "128": "icons/icon-128.png",
    },
    browser_specific_settings: {
      gecko: {
        id: "extension@anon.li",
        data_collection_permissions: {
          required: ["none"],
        },
      } as Record<string, unknown>,
    },
  },
  vite: () => ({
    plugins: [preact(), tailwindcss()],
  }),
});