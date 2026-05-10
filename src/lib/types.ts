export interface User {
  id: string;
  email: string;
  name?: string | null;
  tier: "free" | "plus" | "pro";
  product?: "bundle" | "alias" | "drop" | null;
  storage: {
    used: string;
    limit: string;
  };
  features: {
    customKey: boolean;
    downloadLimits: boolean;
    noBranding: boolean;
    downloadNotifications: boolean;
    filePreview?: boolean;
  };
  limits: {
    maxFileSize: number;
    maxExpiryDays: number;
    apiRequests: number;
  };
  aliases?: {
    random: { used: number; limit: number };
    custom: { used: number; limit: number };
  };
  domains?: { used: number; limit: number };
  recipients?: { used: number; limit: number };
  drops?: { count: number };
  vaultConfigured: boolean;
}

export interface AliasRecipient {
  id: string;
  email: string;
  isPrimary: boolean;
}

export interface Alias {
  id: string;
  email: string;
  active: boolean;
  label: string | null;
  note: string | null;
  encryptedLabel: string | null;
  encryptedNote: string | null;
  metadataLocked: boolean;
  recipients: AliasRecipient[];
  createdAt: string;
  updatedAt: string;
}

export interface DropFile {
  id: string;
  encryptedName: string;
  size: string;
  mimeType: string;
  iv: string;
}

export interface Drop {
  id: string;
  encryptedTitle: string | null;
  iv: string;
  fileCount: number;
  downloadCount: number;
  disabled: boolean;
  customKey: boolean;
  uploadComplete: boolean;
  totalSize: string;
  createdAt: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  files: DropFile[];
}

export interface Domain {
  id: string;
  domain: string;
  verified: boolean;
}

export interface Recipient {
  id: string;
  email: string;
  verified: boolean;
  isDefault: boolean;
}

export interface CreateDropResponse {
  dropId: string;
  expiresAt: string | null;
  ownerKeyStored: boolean;
}

export interface AddFileResponse {
  fileId: string;
  s3UploadId: string;
  uploadUrls: Record<number, string>;
}

export interface VaultUnlockMaterials {
  vaultId: string;
  vaultGeneration: number;
  vaultSalt: string;
  passwordWrappedVaultKey: string;
  kdfVersion: number;
}

export interface WrappedDropKeyRecord {
  dropId: string;
  wrappedKey: string;
  vaultGeneration: number;
}
