const MAX_UPLOAD_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadChunkOnce(
  presignedUrl: string,
  encryptedChunk: ArrayBuffer,
  signal?: AbortSignal,
): Promise<string> {
  // Relay optimization: if the URL contains a relay path with query params,
  // move query to X-Relay-Query header (matches CLI behavior)
  let url = presignedUrl;
  const headers: Record<string, string> = {};

  if (url.includes("/relay/") && url.includes("?")) {
    const splitIndex = url.indexOf("?");
    const baseUrl = url.slice(0, splitIndex);
    const query = url.slice(splitIndex + 1);
    url = baseUrl;
    headers["X-Relay-Query"] = query;
  }

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: new Uint8Array(encryptedChunk),
    signal,
  });

  if (!res.ok) {
    throw new Error(`S3 upload failed (${res.status}): chunk upload error`);
  }

  return res.headers.get("ETag") || "";
}

/**
 * Uploads an encrypted chunk to a presigned URL and returns the ETag.
 * Retries on transient failures to avoid restarting the full drop upload.
 */
export async function uploadChunk(
  presignedUrl: string,
  encryptedChunk: ArrayBuffer,
  signal?: AbortSignal,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    try {
      return await uploadChunkOnce(presignedUrl, encryptedChunk, signal);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (signal?.aborted) {
        throw new Error("Upload cancelled");
      }
      if (attempt < MAX_UPLOAD_RETRIES) {
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new Error("Chunk upload failed");
}
