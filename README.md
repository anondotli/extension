# anon.li Extension

The official browser extension for [anon.li](https://anon.li) — Anonymous email aliases and encrypted file sharing.

<p align="center">
  <img src="public/icons/icon-128.png" alt="anon.li logo" width="128">
</p>

## Features

### Anonymous Email Aliases
- **Generate on the Fly:** Quickly create a random anonymous email alias directly from the extension UI.
- **Smart Form Fill:** Automatically injects a subtle "anon.li" button inside email input fields on websites. Generate and auto-fill an alias with a single click.
- **Context Menu Integration:** Right-click anywhere on a webpage to generate an alias specifically for that site.
- **Manage Aliases:** View, copy, and manage your recently created aliases without leaving the current tab.

### Encrypted File Drops
- **Create Secure Drops:** Quickly upload and share End-to-End Encrypted files directly from your browser.
- **Auto-Capture Keys:** Never lose access to your shared drops. The extension automatically detects and saves drop decryption keys when visiting `anon.li/d/*` URLs.
- **Manage Drops:** Keep track of your drop download counts and sharing links.

### Power User Friendly
- Built-in Vim-like keyboard shortcuts for blazing fast navigation:
  - `j` / `k` — Navigate lists
  - `/` — Focus search
  - `n` — Create new alias/drop
  - `1` / `2` — Switch tabs
  - `?` — Show shortcuts help
- Clean, minimal UI with seamless Light and Dark mode support based on your system preference.

## Installation

**Chrome / Brave / Edge:**
Install from the [Chrome Web Store](https://chromewebstore.google.com/) (link coming soon), or load manually:
1. Download the latest `.zip` from the **[Releases](../../releases)** page.
2. Navigate to `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox:**
Install from [Firefox Add-ons](https://addons.mozilla.org/) (link coming soon), or load temporarily:
1. Download the Firefox `.zip` from the **[Releases](../../releases)** page.
2. Navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...** and select `manifest.json` from the unzipped folder.

## Setup

1. Sign up or log in to your account at [anon.li](https://anon.li).
2. Navigate to your **Settings** and generate a new **API Key**.
3. Open the anon.li extension in your browser toolbar, paste your API key, and hit Connect!

## Development

This extension is built using the [WXT Framework](https://wxt.dev/) for a seamless cross-browser (MV2 & MV3) development experience. The user interface is crafted with [Preact](https://preactjs.com/) and [Tailwind CSS v4](https://tailwindcss.com/).

### Prerequisites
- [Bun](https://bun.sh/) (`>= 1.0.0`)

### Getting Started

```bash
# Clone the repository and install dependencies
bun install

# Start the development server with Hot Module Replacement (Chrome)
bun run dev

# Start the development server (Firefox)
bun run dev:firefox
```

### Build & Package

```bash
# Build for production
bun run build          # Chrome (MV3)
bun run build:firefox  # Firefox (MV2)

# Pack extension into a .zip file for publishing
bun run zip
bun run zip:firefox
```

## Privacy

See [PRIVACY.md](PRIVACY.md). The extension collects no analytics or telemetry. All data is stored locally in your browser.

## License

This code is released under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
