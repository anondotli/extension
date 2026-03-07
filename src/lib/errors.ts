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
