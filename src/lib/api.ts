import { getApiKey, getBaseUrl } from "./storage";
import { ApiError, AuthError, RateLimitError, NetworkError } from "./errors";
import { MAX_RETRIES, RETRY_BASE_DELAY, EXTENSION_VERSION, REQUEST_TIMEOUT_MS } from "./constants";

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export interface ApiResult<T> {
  data: T;
  rateLimit?: RateLimitInfo;
}

export interface ApiListResult<T> {
  data: T[];
  total: number;
  rateLimit?: RateLimitInfo;
  meta?: Record<string, unknown>;
}

interface ApiSuccessResponse<T> {
  data: T;
}

interface ApiListResponse<T> {
  data: T[];
  meta: { total: number; [key: string]: unknown };
}

interface ApiErrorResponse {
  error: { message: string; code?: string } | string;
  meta?: { request_id?: string };
}

async function getHeaders(): Promise<Record<string, string>> {
  const apiKey = await getApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": `anonli-extension/${EXTENSION_VERSION}`,
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}

function extractRateLimit(res: Response): RateLimitInfo | undefined {
  const limit = res.headers.get("X-RateLimit-Limit");
  const remaining = res.headers.get("X-RateLimit-Remaining");
  const reset = res.headers.get("X-RateLimit-Reset");
  if (limit && remaining && reset) {
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
    };
  }
  return undefined;
}

async function handleError(res: Response): Promise<never> {
  let body: ApiErrorResponse | undefined;
  try {
    body = (await res.json()) as ApiErrorResponse;
  } catch {
    // no JSON body
  }

  if (res.status === 401) {
    const msg =
      body &&
      typeof body.error === "object" &&
      body.error !== null &&
      "message" in body.error
        ? body.error.message
        : typeof body?.error === "string"
          ? body.error
          : "Unauthorized";
    throw new AuthError(msg);
  }

  if (res.status === 429) {
    const resetHeader = res.headers.get("X-RateLimit-Reset");
    const resetDate = resetHeader
      ? new Date(parseInt(resetHeader, 10))
      : new Date(Date.now() + 60_000);
    const msg =
      body &&
      typeof body.error === "object" &&
      body.error !== null &&
      "message" in body.error
        ? body.error.message
        : "Rate limit exceeded";
    throw new RateLimitError(msg, resetDate);
  }

  const message =
    body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error
      ? body.error.message
      : typeof body?.error === "string"
        ? body.error
        : `Request failed with status ${res.status}`;

  const code =
    body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "code" in body.error
      ? body.error.code
      : undefined;

  throw new ApiError(message, res.status, code, body?.meta?.request_id);
}

function withTimeout(options: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): { options: RequestInit; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    options: { ...options, signal: controller.signal },
    cleanup: () => clearTimeout(timer),
  };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const { options: opts, cleanup } = withTimeout({ credentials: "omit", ...options });
    try {
      const res = await fetch(url, opts);
      cleanup();

      if (res.status >= 400 && res.status < 500) {
        return res;
      }

      if (res.status >= 500 && attempt < retries) {
        await delay(RETRY_BASE_DELAY * Math.pow(2, attempt));
        continue;
      }

      return res;
    } catch (err) {
      cleanup();
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") {
        if (!navigator.onLine) throw new NetworkError();
        throw lastError;
      }
      if (!navigator.onLine) throw new NetworkError();
      if (attempt < retries) {
        await delay(RETRY_BASE_DELAY * Math.pow(2, attempt));
        continue;
      }
    }
  }

  if (!navigator.onLine) throw new NetworkError();
  throw lastError || new Error("Request failed after retries");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiGet<T>(
  path: string,
  retry = true
): Promise<ApiResult<T>> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers = await getHeaders();
  const res = retry
    ? await fetchWithRetry(url, { method: "GET", headers })
    : await fetch(url, { method: "GET", headers });

  if (!res.ok) await handleError(res);

  const rateLimit = extractRateLimit(res);
  const json = (await res.json()) as ApiSuccessResponse<T>;
  return { data: json.data, rateLimit };
}

export async function apiGetList<T>(
  path: string
): Promise<ApiListResult<T>> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers = await getHeaders();
  const res = await fetchWithRetry(url, { method: "GET", headers });

  if (!res.ok) await handleError(res);

  const rateLimit = extractRateLimit(res);
  const json = (await res.json()) as ApiListResponse<T>;
  return {
    data: json.data,
    total: json.meta.total,
    rateLimit,
    meta: json.meta as Record<string, unknown>,
  };
}

export async function apiPost<T>(
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers = await getHeaders();
  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) await handleError(res);

  const rateLimit = extractRateLimit(res);
  const json = (await res.json()) as ApiSuccessResponse<T>;
  return { data: json.data, rateLimit };
}

export async function apiPatch<T>(
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers = await getHeaders();
  const res = await fetch(url, {
    method: "PATCH",
    credentials: "omit",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) await handleError(res);

  const rateLimit = extractRateLimit(res);
  const json = (await res.json()) as ApiSuccessResponse<T>;
  return { data: json.data, rateLimit };
}

export async function apiDelete(path: string): Promise<{ rateLimit?: RateLimitInfo }> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers = await getHeaders();
  const res = await fetch(url, { method: "DELETE", credentials: "omit", headers });

  if (!res.ok) await handleError(res);

  return { rateLimit: extractRateLimit(res) };
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers = await getHeaders();
  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });
}

export async function apiRawFetch(
  url: string,
  options: RequestInit
): Promise<Response> {
  return fetch(url, options);
}
