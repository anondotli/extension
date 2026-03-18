# Privacy Policy — anon.li Browser Extension

**Last updated:** 2026-03-18

## Overview

The anon.li browser extension is designed with privacy as a core principle. We collect no analytics, telemetry, or tracking data of any kind.

## Data Stored Locally

The extension stores the following data in your browser's local storage (`browser.storage.local`). This data **never leaves your device** except as described below.

- **API key** — Your anon.li API key, used to authenticate requests.
- **Settings** — Your preferences: base URL, theme, sort/filter state, drop key sync toggle, and ignored sites list.
- **Cached data** — A local cache of your alias and drop lists to improve load times. This cache is refreshed periodically and on each popup open.
- **Drop encryption keys** — Decryption keys captured from `anon.li/d/*` URLs, stored locally so you can access your encrypted drops.

## Data Transmitted

The extension communicates **only** with the anon.li API (`https://anon.li` by default, or a self-hosted URL you configure). Requests are made over HTTPS and include:

- Your API key (in the `Authorization` header)
- A user-agent string identifying the extension and its version
- Standard API request payloads (alias creation parameters, etc.)

**No data is sent to any third party.** There are no analytics services, crash reporters, or ad networks.

## Permissions Explained

| Permission | Why it's needed |
|---|---|
| `storage` | Store your API key, settings, and cached data locally |
| `contextMenus` | Add "Generate anon.li alias" to the right-click menu |
| `activeTab` | Read the current page's URL for context menu alias generation |
| `clipboardWrite` | Copy generated aliases and drop URLs to your clipboard |
| `notifications` | Show notifications when aliases are created from the context menu |
| `alarms` | Schedule periodic background cache refresh (every 5 minutes) |
| `https://anon.li/*` | Communicate with the anon.li API and capture drop encryption keys |

## Content Scripts

The extension injects a small content script on web pages to:

1. Detect email input fields and show an "anon.li" button for quick alias generation.
2. Capture drop decryption keys from `anon.li/d/*` URLs (if key sync is enabled).

These scripts do not read, collect, or transmit any page content beyond what is described above.

## Your Control

- You can disable drop key sync in Settings.
- You can add sites to the ignore list to prevent the content script from running.
- Removing the extension deletes all locally stored data.
- You can clear your API key at any time to disconnect from the service.

## Contact

For questions about this privacy policy or the extension, visit [anon.li](https://anon.li) or open an issue on the [GitHub repository](https://github.com/anon-li/extension).
