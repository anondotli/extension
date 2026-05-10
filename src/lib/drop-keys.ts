import { getDropKeys, setDropKey } from "./storage";
import { listWrappedDropKeys, storeWrappedDropKey } from "./service";
import { extractStoredKeyMaterial } from "./vault/crypto";
import { getVaultRuntime } from "./vault/runtime";
import { isVaultUnlocked, unwrapDropKey, wrapDropKey } from "./vault";

export async function syncVaultDropKeys(localKeys?: Record<string, string>): Promise<Record<string, string>> {
  if (!isVaultUnlocked()) {
    return localKeys ?? getDropKeys();
  }

  const runtime = getVaultRuntime();
  if (!runtime.vaultId || !runtime.vaultGeneration) {
    return localKeys ?? getDropKeys();
  }

  const existingKeys = localKeys ?? await getDropKeys();
  const nextKeys = { ...existingKeys };
  const remoteRecords = await listWrappedDropKeys();
  const remoteDropIds = new Set(remoteRecords.map((record) => record.dropId));

  for (const record of remoteRecords) {
    if (nextKeys[record.dropId]) continue;

    try {
      const rawKey = await unwrapDropKey(record.wrappedKey);
      nextKeys[record.dropId] = rawKey;
      await setDropKey(record.dropId, rawKey);
    } catch {
      // Ignore keys that cannot be unwrapped with the current vault state.
    }
  }

  await Promise.allSettled(
    Object.entries(existingKeys)
      .filter(([dropId]) => !remoteDropIds.has(dropId))
      .map(async ([dropId, rawKey]) => {
        const wrappedKey = await wrapDropKey(extractStoredKeyMaterial(rawKey));
        await storeWrappedDropKey({
          dropId,
          wrappedKey,
          vaultId: runtime.vaultId!,
          vaultGeneration: runtime.vaultGeneration!,
        });
      }),
  );

  return nextKeys;
}

export async function storeWrappedDropKeyForRawKey(dropId: string, rawKey: string): Promise<void> {
  if (!isVaultUnlocked()) {
    return;
  }

  const runtime = getVaultRuntime();
  if (!runtime.vaultId || !runtime.vaultGeneration) {
    throw new Error("Vault state is incomplete");
  }

  const wrappedKey = await wrapDropKey(extractStoredKeyMaterial(rawKey));
  await storeWrappedDropKey({
    dropId,
    wrappedKey,
    vaultId: runtime.vaultId,
    vaultGeneration: runtime.vaultGeneration,
  });
}
