import {
  base64UrlToArrayBuffer,
  calculateEncryptedSize,
  createEncryptionContext,
  encryptChunk,
  encryptFilename,
  encryptKeyWithPassword,
  generateIvString,
  getChunkParams,
  getConcurrency,
} from "./crypto";
import { getBaseUrl, setDropKey } from "./storage";
import { addDropFile, abortDropFile, createDrop, finishDropUpload } from "./service";
import { uploadChunk } from "./upload";
import { extractStoredKeyMaterial } from "./vault/crypto";
import { getVaultRuntime } from "./vault/runtime";
import { isVaultUnlocked, wrapDropKey } from "./vault";

export type DropUploadPhase = "encrypting" | "uploading" | "finalizing";

export interface DropUploadProgress {
  phase: DropUploadPhase;
  currentFileIndex: number;
  totalFiles: number;
  currentFileName: string;
  uploadedChunks: number;
  totalChunks: number;
  bytesUploaded: number;
  totalBytes: number;
}

export interface DropUploadOptions {
  files: File[];
  title?: string;
  message?: string;
  expiryDays?: number;
  maxDownloads?: number;
  password?: string;
  hideBranding?: boolean;
  notifyOnDownload?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: DropUploadProgress) => void;
}

interface ActiveUpload {
  dropId: string;
  fileId: string;
  s3UploadId: string;
}

function updateProgress(
  callback: DropUploadOptions["onProgress"],
  progress: DropUploadProgress,
): void {
  callback?.(progress);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

export async function uploadDrop({
  files,
  title,
  message,
  expiryDays,
  maxDownloads,
  password,
  hideBranding,
  notifyOnDownload,
  signal,
  onProgress,
}: DropUploadOptions): Promise<{ dropId: string; shareUrl: string; customKey: boolean }> {
  if (files.length === 0) {
    throw new Error("Select at least one file");
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const totalChunks = files.reduce((sum, file) => sum + getChunkParams(file.size).chunkCount, 0);
  let uploadedChunks = 0;
  const activeUploads: ActiveUpload[] = [];
  let dropId = "";

  updateProgress(onProgress, {
    phase: "encrypting",
    currentFileIndex: 1,
    totalFiles: files.length,
    currentFileName: files[0]?.name ?? "",
    uploadedChunks: 0,
    totalChunks,
    bytesUploaded: 0,
    totalBytes,
  });

  try {
    const encryption = await createEncryptionContext();
    const ownerKey = await (async () => {
      if (!isVaultUnlocked()) {
        return undefined;
      }

      const runtime = getVaultRuntime();
      if (!runtime.vaultId || !runtime.vaultGeneration) {
        return undefined;
      }

      return {
        wrappedKey: await wrapDropKey(extractStoredKeyMaterial(encryption.keyString)),
        vaultId: runtime.vaultId,
        vaultGeneration: runtime.vaultGeneration,
      };
    })();

    const customKey = Boolean(password && password.length >= 8);
    let customKeyPayload:
      | { salt: string; customKeyData: string; customKeyIv: string }
      | undefined;

    if (customKey) {
      const protection = await encryptKeyWithPassword(encryption.keyString, password!);
      customKeyPayload = {
        salt: protection.salt,
        customKeyData: protection.encryptedKey,
        customKeyIv: protection.iv,
      };
    }

    const encryptedTitle = title
      ? await encryptFilename(title, encryption.key, encryption.baseIv)
      : undefined;
    const encryptedMessage = message
      ? await encryptFilename(message, encryption.key, encryption.baseIv)
      : undefined;

    const createdDrop = await createDrop({
      iv: encryption.ivString,
      ...(encryptedTitle ? { encryptedTitle } : {}),
      ...(encryptedMessage ? { encryptedMessage } : {}),
      ...(expiryDays ? { expiry: expiryDays } : {}),
      ...(maxDownloads ? { maxDownloads } : {}),
      ...(customKey ? { customKey: true, ...customKeyPayload } : {}),
      ...(hideBranding ? { hideBranding: true } : {}),
      ...(notifyOnDownload ? { notifyOnDownload: true } : {}),
      fileCount: files.length,
      ...(ownerKey ? { ownerKey } : {}),
    });

    dropId = createdDrop.dropId;

    const finalizedFiles: { fileId: string; chunks: { chunkIndex: number; etag: string }[] }[] = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex]!;
      const { chunkSize, chunkCount } = getChunkParams(file.size);
      const encryptedSize = calculateEncryptedSize(file.size, chunkSize);
      const fileIvString = generateIvString();
      const fileIv = new Uint8Array(base64UrlToArrayBuffer(fileIvString));

      updateProgress(onProgress, {
        phase: "encrypting",
        currentFileIndex: fileIndex + 1,
        totalFiles: files.length,
        currentFileName: file.name,
        uploadedChunks,
        totalChunks,
        bytesUploaded: Math.round((uploadedChunks / Math.max(totalChunks, 1)) * totalBytes),
        totalBytes,
      });

      const encryptedName = await encryptFilename(file.name, encryption.key, fileIv);
      const uploadPlan = await addDropFile(dropId, {
        size: encryptedSize,
        encryptedName,
        iv: fileIvString,
        mimeType: file.type || "application/octet-stream",
        chunkCount,
        chunkSize,
      });

      activeUploads.push({
        dropId,
        fileId: uploadPlan.fileId,
        s3UploadId: uploadPlan.s3UploadId,
      });

      updateProgress(onProgress, {
        phase: "uploading",
        currentFileIndex: fileIndex + 1,
        totalFiles: files.length,
        currentFileName: file.name,
        uploadedChunks,
        totalChunks,
        bytesUploaded: Math.round((uploadedChunks / Math.max(totalChunks, 1)) * totalBytes),
        totalBytes,
      });

      const chunkIndexes = Array.from({ length: chunkCount }, (_, index) => index);
      const chunks = await mapWithConcurrency(chunkIndexes, getConcurrency(file.size), async (chunkIndex) => {
        if (signal?.aborted) {
          throw new Error("Upload cancelled");
        }

        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const plaintext = await file.slice(start, end).arrayBuffer();
        const ciphertext = await encryptChunk(plaintext, encryption.key, fileIv, chunkIndex);
        const presignedUrl = uploadPlan.uploadUrls[chunkIndex + 1];

        if (!presignedUrl) {
          throw new Error(`Missing upload URL for chunk ${chunkIndex + 1}`);
        }

        const etag = await uploadChunk(presignedUrl, ciphertext, signal);
        uploadedChunks += 1;
        updateProgress(onProgress, {
          phase: "uploading",
          currentFileIndex: fileIndex + 1,
          totalFiles: files.length,
          currentFileName: file.name,
          uploadedChunks,
          totalChunks,
          bytesUploaded: Math.round((uploadedChunks / Math.max(totalChunks, 1)) * totalBytes),
          totalBytes,
        });

        return { chunkIndex, etag };
      });

      finalizedFiles.push({
        fileId: uploadPlan.fileId,
        chunks,
      });
    }

    updateProgress(onProgress, {
      phase: "finalizing",
      currentFileIndex: files.length,
      totalFiles: files.length,
      currentFileName: files[files.length - 1]?.name ?? "",
      uploadedChunks,
      totalChunks,
      bytesUploaded: totalBytes,
      totalBytes,
    });

    await finishDropUpload(dropId, finalizedFiles);
    activeUploads.length = 0;

    if (!customKey) {
      await setDropKey(dropId, encryption.keyString);
    }

    const baseUrl = await getBaseUrl();
    const shareUrl = customKey
      ? `${baseUrl}/d/${dropId}`
      : `${baseUrl}/d/${dropId}#${encryption.keyString}`;

    return { dropId, shareUrl, customKey };
  } catch (error) {
    await Promise.allSettled(
      activeUploads.map((upload) => abortDropFile(upload.dropId, upload.fileId, upload.s3UploadId)),
    );

    if (signal?.aborted) {
      throw new Error("Upload cancelled");
    }

    throw error instanceof Error ? error : new Error("Upload failed");
  }
}
