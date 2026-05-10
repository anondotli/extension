import { getVaultStorageSupport } from "./storage-support";

const DATABASE_NAME = "anon-extension-vault";
const STORE_NAME = "device-keys";
const DEVICE_KEY_ID = "current";
const VAULT_CAPSULE_STORAGE_KEY = "vaultCapsule";

interface VaultCapsule {
  version: 1;
  deviceId: string;
  vaultId: string;
  vaultGeneration: number;
  wrappedVaultKey: string;
  expiresAt: number;
}

function isVaultCapsule(value: unknown): value is VaultCapsule {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as VaultCapsule).version === 1 &&
    typeof (value as VaultCapsule).deviceId === "string" &&
    typeof (value as VaultCapsule).vaultId === "string" &&
    typeof (value as VaultCapsule).vaultGeneration === "number" &&
    typeof (value as VaultCapsule).wrappedVaultKey === "string" &&
    typeof (value as VaultCapsule).expiresAt === "number"
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    });
  } finally {
    database.close();
  }
}

export async function storeDeviceKey(key: CryptoKey): Promise<void> {
  if (!getVaultStorageSupport().indexedDb) return;
  await withStore("readwrite", (store) => store.put(key, DEVICE_KEY_ID));
}

export async function getDeviceKey(): Promise<CryptoKey | null> {
  if (!getVaultStorageSupport().indexedDb) return null;

  try {
    return await withStore("readonly", (store) => store.get(DEVICE_KEY_ID)) ?? null;
  } catch {
    return null;
  }
}

async function deleteDeviceKey(): Promise<void> {
  if (!getVaultStorageSupport().indexedDb) return;

  try {
    await withStore("readwrite", (store) => store.delete(DEVICE_KEY_ID));
  } catch {
    // Best-effort cleanup only.
  }
}

export async function storeCapsule(capsule: VaultCapsule): Promise<void> {
  await browser.storage.local.set({ [VAULT_CAPSULE_STORAGE_KEY]: capsule });
}

export async function readCapsule(): Promise<VaultCapsule | null> {
  const result = await browser.storage.local.get(VAULT_CAPSULE_STORAGE_KEY);
  const capsule = result[VAULT_CAPSULE_STORAGE_KEY];

  if (!isVaultCapsule(capsule)) {
    await deleteCapsule();
    return null;
  }

  if (capsule.expiresAt <= Date.now()) {
    await deleteCapsule();
    return null;
  }

  return capsule;
}

export async function deleteCapsule(): Promise<void> {
  await browser.storage.local.remove(VAULT_CAPSULE_STORAGE_KEY);
}

export async function clearTrustedBrowserState(): Promise<void> {
  await deleteCapsule();
  await deleteDeviceKey();
}
