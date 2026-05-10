import { DEFAULT_BASE_URL } from "./constants";

function normalizeOriginPattern(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  return `${parsed.origin}/*`;
}

export async function hasBaseUrlPermission(baseUrl: string): Promise<boolean> {
  if (new URL(baseUrl).origin === new URL(DEFAULT_BASE_URL).origin) {
    return true;
  }

  return browser.permissions.contains({
    origins: [normalizeOriginPattern(baseUrl)],
  });
}

export async function ensureBaseUrlPermission(baseUrl: string, interactive = false): Promise<boolean> {
  if (new URL(baseUrl).origin === new URL(DEFAULT_BASE_URL).origin) {
    return true;
  }

  const originPattern = normalizeOriginPattern(baseUrl);
  const hasPermission = await browser.permissions.contains({ origins: [originPattern] });
  if (hasPermission) {
    return true;
  }

  if (!interactive) {
    return false;
  }

  return browser.permissions.request({ origins: [originPattern] });
}
