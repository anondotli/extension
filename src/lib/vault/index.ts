import { bootstrapVault, unlockVault } from "../service";
import { clearVaultRuntime, getVaultRuntime, setVaultRuntime } from "./runtime";
import {
  arrayBufferToBase64Url,
  base64UrlToArrayBuffer,
  decryptVaultText,
  deriveAuthSecret,
  derivePasswordKEK,
  encryptVaultText,
  exportKeyBase64Url,
  generateDeviceWrappingKey,
  unwrapVaultKey,
  unwrapVaultManagedKey,
  wrapVaultKey,
  wrapVaultManagedKey,
} from "./crypto";
import {
  clearTrustedBrowserState,
  getDeviceKey,
  readCapsule,
  storeCapsule,
  storeDeviceKey,
} from "./trusted-browser";
import { getVaultStorageSupport } from "./storage-support";

const TRUSTED_BROWSER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isVaultUnlocked(): boolean {
  return Boolean(getVaultRuntime().key);
}

export async function unlockExtensionVault(
  email: string,
  password: string,
  trustBrowser: boolean,
): Promise<{ vaultId: string; vaultGeneration: number }> {
  const bootstrap = await bootstrapVault(email);
  const authSecret = arrayBufferToBase64Url(await deriveAuthSecret(password, bootstrap.authSalt));
  const materials = await unlockVault(authSecret);
  const passwordKey = await derivePasswordKEK(password, materials.vaultSalt);
  const vaultKey = await unwrapVaultKey(
    base64UrlToArrayBuffer(materials.passwordWrappedVaultKey),
    passwordKey,
  );

  setVaultRuntime(vaultKey, materials.vaultGeneration, materials.vaultId);

  if (trustBrowser && getVaultStorageSupport().trustedBrowser) {
    const existingCapsule = await readCapsule();
    const deviceId = existingCapsule?.deviceId ?? crypto.randomUUID();
    let deviceKey = await getDeviceKey();

    if (!deviceKey) {
      deviceKey = await generateDeviceWrappingKey();
      await storeDeviceKey(deviceKey);
    }

    const wrappedVaultKey = arrayBufferToBase64Url(await wrapVaultKey(vaultKey, deviceKey));
    await storeCapsule({
      version: 1,
      deviceId,
      vaultId: materials.vaultId,
      vaultGeneration: materials.vaultGeneration,
      wrappedVaultKey,
      expiresAt: Date.now() + TRUSTED_BROWSER_TTL_MS,
    });
  }

  return {
    vaultId: materials.vaultId,
    vaultGeneration: materials.vaultGeneration,
  };
}

export async function restoreTrustedExtensionVault(): Promise<{ vaultId: string; vaultGeneration: number } | null> {
  const capsule = await readCapsule();
  if (!capsule) {
    return null;
  }

  const deviceKey = await getDeviceKey();
  if (!deviceKey) {
    await clearTrustedBrowserState();
    return null;
  }

  try {
    const vaultKey = await unwrapVaultKey(base64UrlToArrayBuffer(capsule.wrappedVaultKey), deviceKey);
    setVaultRuntime(vaultKey, capsule.vaultGeneration, capsule.vaultId);
    return {
      vaultId: capsule.vaultId,
      vaultGeneration: capsule.vaultGeneration,
    };
  } catch {
    await clearTrustedBrowserState();
    clearVaultRuntime();
    return null;
  }
}

export async function lockExtensionVault(clearTrustedState = false): Promise<void> {
  clearVaultRuntime();
  if (clearTrustedState) {
    await clearTrustedBrowserState();
  }
}

export async function encryptAliasMetadata(
  aliasId: string,
  field: "label" | "note",
  plaintext: string,
): Promise<string> {
  const vaultKey = getVaultRuntime().key;
  if (!vaultKey) {
    throw new Error("Vault is locked");
  }

  return encryptVaultText(plaintext, vaultKey, { aliasId, field });
}

export async function decryptAliasMetadata(
  aliasId: string,
  field: "label" | "note",
  encryptedValue: string,
): Promise<string> {
  const vaultKey = getVaultRuntime().key;
  if (!vaultKey) {
    throw new Error("Vault is locked");
  }

  return decryptVaultText(encryptedValue, vaultKey, { aliasId, field });
}

export async function wrapDropKey(rawKey: ArrayBuffer): Promise<string> {
  const vaultKey = getVaultRuntime().key;
  if (!vaultKey) {
    throw new Error("Vault is locked");
  }

  return wrapVaultManagedKey(rawKey, vaultKey);
}

export async function unwrapDropKey(wrappedKey: string): Promise<string> {
  const vaultKey = getVaultRuntime().key;
  if (!vaultKey) {
    throw new Error("Vault is locked");
  }

  const key = await unwrapVaultManagedKey(wrappedKey, vaultKey);
  return exportKeyBase64Url(key);
}
