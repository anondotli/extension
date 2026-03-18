/**
 * S3 chunk upload utility for the extension's drop upload feature.
 * Uploads an encrypted chunk to an S3 presigned URL and returns the ETag.
 */

export async function uploadChunk(presignedUrl: string, encryptedChunk: ArrayBuffer): Promise<string> {
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
  });

  if (!res.ok) {
    throw new Error(`S3 upload failed (${res.status}): chunk upload error`);
  }

  return res.headers.get("ETag") || "";
}
