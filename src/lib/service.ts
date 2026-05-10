import { apiDelete, apiGet, apiGetList, apiPatch, apiPost } from "./api";
import type {
  AddFileResponse,
  Alias,
  AliasRecipient,
  CreateDropResponse,
  Domain,
  Drop,
  DropFile,
  Recipient,
  User,
  VaultUnlockMaterials,
  WrappedDropKeyRecord,
} from "./types";

interface UserApiResponse {
  id: string;
  email: string;
  name?: string | null;
  tier: "free" | "plus" | "pro";
  product?: "bundle" | "alias" | "drop" | null;
  storage: { used: string; limit: string };
  features: {
    customKey: boolean;
    downloadLimits: boolean;
    noBranding: boolean;
    downloadNotifications: boolean;
    filePreview?: boolean;
  };
  limits: {
    max_file_size: number;
    max_expiry_days: number;
    api_requests: number;
  };
  aliases?: {
    random: { used: number; limit: number };
    custom: { used: number; limit: number };
  };
  domains?: { used: number; limit: number };
  recipients?: { used: number; limit: number };
  drops?: { count: number };
  vault_configured?: boolean;
}

interface AliasApiResponse {
  id: string;
  email: string;
  active: boolean;
  label?: string | null;
  note?: string | null;
  encrypted_label?: string | null;
  encrypted_note?: string | null;
  recipients?: Array<{
    id: string;
    email: string;
    is_primary: boolean;
  }>;
  created_at?: string;
  updated_at?: string;
}

interface DropFileApiResponse {
  id: string;
  encryptedName: string;
  size: string;
  mimeType: string;
  iv: string;
}

interface DropApiResponse {
  id: string;
  encryptedTitle?: string | null;
  iv?: string;
  downloads?: number;
  fileCount?: number;
  totalSize?: string;
  disabled?: boolean;
  customKey?: boolean;
  uploadComplete?: boolean;
  maxDownloads?: number | null;
  expires_at?: string | null;
  created_at?: string;
  files?: DropFileApiResponse[];
}

interface DomainApiResponse {
  id: string;
  domain: string;
  verified: boolean;
}

interface RecipientApiResponse {
  id: string;
  email: string;
  verified: boolean;
  is_default: boolean;
}

interface CreateDropApiResponse {
  drop_id: string;
  expires_at: string | null;
  owner_key_stored?: boolean;
}

interface AddFileApiResponse {
  fileId: string;
  s3UploadId: string;
  uploadUrls: Record<string, string>;
}

interface VaultUnlockApiResponse {
  vault_id: string;
  vault_generation: number;
  vault_salt: string;
  password_wrapped_vault_key: string;
  kdf_version: number;
}

interface WrappedDropKeyApiResponse {
  drop_id: string;
  wrapped_key: string;
  vault_generation: number;
}

function normalizeAliasRecipients(recipients: AliasApiResponse["recipients"]): AliasRecipient[] {
  return (recipients ?? []).map((recipient) => ({
    id: recipient.id,
    email: recipient.email,
    isPrimary: recipient.is_primary,
  }));
}

export function normalizeUser(raw: UserApiResponse): User {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name ?? null,
    tier: raw.tier,
    product: raw.product ?? null,
    storage: raw.storage,
    features: {
      customKey: raw.features.customKey,
      downloadLimits: raw.features.downloadLimits,
      noBranding: raw.features.noBranding,
      downloadNotifications: raw.features.downloadNotifications,
      filePreview: raw.features.filePreview,
    },
    limits: {
      maxFileSize: raw.limits.max_file_size,
      maxExpiryDays: raw.limits.max_expiry_days,
      apiRequests: raw.limits.api_requests,
    },
    aliases: raw.aliases,
    domains: raw.domains,
    recipients: raw.recipients,
    drops: raw.drops,
    vaultConfigured: Boolean(raw.vault_configured),
  };
}

export function normalizeAlias(raw: AliasApiResponse): Alias {
  return {
    id: raw.id,
    email: raw.email,
    active: raw.active,
    label: raw.label ?? null,
    note: raw.note ?? null,
    encryptedLabel: raw.encrypted_label ?? null,
    encryptedNote: raw.encrypted_note ?? null,
    metadataLocked: Boolean(raw.encrypted_label || raw.encrypted_note),
    recipients: normalizeAliasRecipients(raw.recipients),
    createdAt: raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? raw.created_at ?? new Date().toISOString(),
  };
}

function normalizeDropFile(raw: DropFileApiResponse): DropFile {
  return {
    id: raw.id,
    encryptedName: raw.encryptedName,
    size: raw.size,
    mimeType: raw.mimeType,
    iv: raw.iv,
  };
}

export function normalizeDrop(raw: DropApiResponse): Drop {
  const files = (raw.files ?? []).map(normalizeDropFile);
  return {
    id: raw.id,
    encryptedTitle: raw.encryptedTitle ?? null,
    iv: raw.iv ?? "",
    fileCount: raw.fileCount ?? files.length,
    downloadCount: raw.downloads ?? 0,
    disabled: Boolean(raw.disabled),
    customKey: Boolean(raw.customKey),
    uploadComplete: raw.uploadComplete !== false,
    totalSize: raw.totalSize ?? "0",
    createdAt: raw.created_at ?? new Date().toISOString(),
    expiresAt: raw.expires_at ?? null,
    maxDownloads: raw.maxDownloads ?? null,
    files,
  };
}

export function normalizeDomain(raw: DomainApiResponse): Domain {
  return {
    id: raw.id,
    domain: raw.domain,
    verified: raw.verified,
  };
}

export function normalizeRecipient(raw: RecipientApiResponse): Recipient {
  return {
    id: raw.id,
    email: raw.email,
    verified: raw.verified,
    isDefault: raw.is_default,
  };
}

function normalizeWrappedDropKey(raw: WrappedDropKeyApiResponse): WrappedDropKeyRecord {
  return {
    dropId: raw.drop_id,
    wrappedKey: raw.wrapped_key,
    vaultGeneration: raw.vault_generation,
  };
}

export async function getUserProfile(): Promise<User> {
  const result = await apiGet<UserApiResponse>("/api/v1/me");
  return normalizeUser(result.data);
}

export async function listAliases(limit = 50): Promise<{ data: Alias[]; total: number }> {
  const result = await apiGetList<AliasApiResponse>(`/api/v1/alias?limit=${limit}`);
  return {
    data: result.data.map(normalizeAlias),
    total: result.total,
  };
}

export async function createAlias(body: Record<string, unknown>): Promise<Alias> {
  const result = await apiPost<AliasApiResponse>("/api/v1/alias", body);
  return normalizeAlias(result.data);
}

export async function quickCreateAlias(body: Record<string, unknown> = {}): Promise<Alias> {
  const result = await apiPost<AliasApiResponse>("/api/v1/alias?generate=true", body);
  return normalizeAlias(result.data);
}

export async function updateAlias(id: string, body: Record<string, unknown>): Promise<Alias> {
  const result = await apiPatch<AliasApiResponse>(`/api/v1/alias/${id}`, body);
  return normalizeAlias(result.data);
}

export async function deleteAlias(id: string): Promise<void> {
  await apiDelete(`/api/v1/alias/${id}`);
}

export async function listDomains(): Promise<Domain[]> {
  const result = await apiGetList<DomainApiResponse>("/api/v1/domain");
  return result.data.map(normalizeDomain);
}

export async function listRecipients(): Promise<Recipient[]> {
  const result = await apiGetList<RecipientApiResponse>("/api/v1/recipient");
  return result.data.map(normalizeRecipient);
}

export async function listDrops(limit = 25, offset = 0): Promise<{ data: Drop[]; total: number }> {
  const result = await apiGetList<DropApiResponse>(`/api/v1/drop?limit=${limit}&offset=${offset}`);
  return {
    data: result.data.map(normalizeDrop),
    total: result.total,
  };
}

export async function toggleDrop(id: string): Promise<{ disabled: boolean }> {
  const result = await apiPatch<{ disabled: boolean }>(`/api/v1/drop/${id}?action=toggle`, {});
  return result.data;
}

export async function deleteDrop(id: string): Promise<void> {
  await apiDelete(`/api/v1/drop/${id}`);
}

export async function createDrop(body: Record<string, unknown>): Promise<CreateDropResponse> {
  const result = await apiPost<CreateDropApiResponse>("/api/v1/drop", body);
  return {
    dropId: result.data.drop_id,
    expiresAt: result.data.expires_at,
    ownerKeyStored: Boolean(result.data.owner_key_stored),
  };
}

export async function addDropFile(dropId: string, body: Record<string, unknown>): Promise<AddFileResponse> {
  const result = await apiPost<AddFileApiResponse>(`/api/v1/drop/${dropId}/file`, body);
  return {
    fileId: result.data.fileId,
    s3UploadId: result.data.s3UploadId,
    uploadUrls: Object.fromEntries(
      Object.entries(result.data.uploadUrls).map(([partNumber, uploadUrl]) => [Number(partNumber), uploadUrl]),
    ),
  };
}

export async function finishDropUpload(
  dropId: string,
  files: { fileId: string; chunks: { chunkIndex: number; etag: string }[] }[],
): Promise<void> {
  await apiPatch(`/api/v1/drop/${dropId}?action=finish`, { files });
}

export async function abortDropFile(dropId: string, fileId: string, s3UploadId: string): Promise<void> {
  await apiDelete(`/api/v1/drop/${dropId}/file/${fileId}`, { s3UploadId });
}

export async function bootstrapVault(email: string): Promise<{ authSalt: string; kdfVersion: number }> {
  const result = await apiPost<{ authSalt: string; kdfVersion: number }>("/api/vault/bootstrap", { email });
  return result.data;
}

export async function unlockVault(authSecret: string): Promise<VaultUnlockMaterials> {
  const result = await apiPost<VaultUnlockApiResponse>("/api/v1/vault/unlock", {
    auth_secret: authSecret,
  });
  return {
    vaultId: result.data.vault_id,
    vaultGeneration: result.data.vault_generation,
    vaultSalt: result.data.vault_salt,
    passwordWrappedVaultKey: result.data.password_wrapped_vault_key,
    kdfVersion: result.data.kdf_version,
  };
}

export async function listWrappedDropKeys(dropId?: string): Promise<WrappedDropKeyRecord[]> {
  const path = dropId
    ? `/api/v1/vault/drop-keys?drop_id=${encodeURIComponent(dropId)}`
    : "/api/v1/vault/drop-keys";
  const result = await apiGet<WrappedDropKeyApiResponse[] | WrappedDropKeyApiResponse>(path);
  const records = Array.isArray(result.data) ? result.data : [result.data];
  return records.map(normalizeWrappedDropKey);
}

export async function storeWrappedDropKey(body: {
  dropId: string;
  wrappedKey: string;
  vaultId: string;
  vaultGeneration: number;
}): Promise<void> {
  await apiPost("/api/v1/vault/drop-keys", {
    drop_id: body.dropId,
    wrapped_key: body.wrappedKey,
    vault_id: body.vaultId,
    vault_generation: body.vaultGeneration,
  });
}
