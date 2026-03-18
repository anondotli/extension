export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class AuthError extends Error {
  constructor(message = "API key required. Open extension settings to configure.") {
    super(message);
    this.name = "AuthError";
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public resetAt: Date
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class NetworkError extends Error {
  constructor(message = "You're offline. Check your connection and try again.") {
    super(message);
    this.name = "NetworkError";
  }
}

export interface UserMessage {
  message: string;
  type: "error" | "info";
  action?: { label: string; onClick: () => void };
}

export function toUserMessage(err: unknown, opts?: { onOpenSettings?: () => void }): UserMessage {
  if (err instanceof NetworkError) {
    return { message: "You're offline", type: "info" };
  }
  if (err instanceof AuthError) {
    return {
      message: "API key invalid",
      type: "error",
      action: opts?.onOpenSettings
        ? { label: "Open settings", onClick: opts.onOpenSettings }
        : undefined,
    };
  }
  if (err instanceof RateLimitError) {
    const secs = Math.max(0, Math.ceil((err.resetAt.getTime() - Date.now()) / 1000));
    return { message: `Rate limited. Retry in ${secs}s`, type: "error" };
  }
  if (err instanceof ApiError) {
    return { message: err.message, type: "error" };
  }
  if (err instanceof Error) {
    return { message: err.message, type: "error" };
  }
  return { message: "Something went wrong", type: "error" };
}
