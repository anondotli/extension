export interface VaultStorageSupport {
  cryptoSubtle: boolean;
  indexedDb: boolean;
  trustedBrowser: boolean;
  vault: boolean;
}

export function getVaultStorageSupport(): VaultStorageSupport {
  const cryptoSubtle = typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
  const indexedDb = typeof indexedDB !== "undefined";

  return {
    cryptoSubtle,
    indexedDb,
    trustedBrowser: cryptoSubtle && indexedDb,
    vault: cryptoSubtle,
  };
}
