import type { Alias } from "./types";
import { decryptAliasMetadata, encryptAliasMetadata, isVaultUnlocked } from "./vault";

export function sanitizeAliasForStorage(alias: Alias): Alias {
  return {
    ...alias,
    label: null,
    note: null,
    metadataLocked: Boolean(alias.encryptedLabel || alias.encryptedNote),
  };
}

export function sanitizeAliasesForStorage(aliases: Alias[]): Alias[] {
  return aliases.map((alias) => sanitizeAliasForStorage(alias));
}

export async function hydrateAliasMetadata(alias: Alias): Promise<Alias> {
  if (!isVaultUnlocked()) {
    return sanitizeAliasForStorage(alias);
  }

  const nextAlias: Alias = {
    ...alias,
    label: null,
    note: null,
    metadataLocked: false,
  };

  if (alias.encryptedLabel) {
    try {
      nextAlias.label = await decryptAliasMetadata(alias.id, "label", alias.encryptedLabel);
    } catch {
      nextAlias.metadataLocked = true;
    }
  }

  if (alias.encryptedNote) {
    try {
      nextAlias.note = await decryptAliasMetadata(alias.id, "note", alias.encryptedNote);
    } catch {
      nextAlias.metadataLocked = true;
    }
  }

  return nextAlias;
}

export async function hydrateAliasesMetadata(aliases: Alias[]): Promise<Alias[]> {
  return Promise.all(aliases.map((alias) => hydrateAliasMetadata(alias)));
}

export async function buildEncryptedAliasPatch(
  aliasId: string,
  metadata: { label?: string | null; note?: string | null },
): Promise<Record<string, string | null>> {
  const payload: Record<string, string | null> = {};

  if (metadata.label !== undefined) {
    payload.encrypted_label = metadata.label
      ? await encryptAliasMetadata(aliasId, "label", metadata.label)
      : null;
  }

  if (metadata.note !== undefined) {
    payload.encrypted_note = metadata.note
      ? await encryptAliasMetadata(aliasId, "note", metadata.note)
      : null;
  }

  return payload;
}
