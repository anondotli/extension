export interface User {
  id: string;
  email: string;
  name?: string | null;
  tier: "free" | "plus" | "pro";
  product?: string | null;
  storage: {
    used: string;  // BigInt serialized as string
    limit: string;
  };
  features: {
    pgp: boolean;
    customDomains: boolean;
    noBranding: boolean;
    downloadNotifications: boolean;
    customKey: boolean;
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
}

export interface Alias {
  id: string;
  email: string;
  active: boolean;
  label?: string | null;
  description?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface Drop {
  id: string;
  fileCount: number;
  downloadCount: number;
  disabled: boolean;
  createdAt: string;
  expiresAt?: string | null;
  maxDownloads?: number | null;
}

export interface Domain {
  id: string;
  domain: string;
  verified: boolean;
}

export interface CreateDropResponse {
  drop_id: string;
  session_token?: string;
}

export interface AddFileResponse {
  fileId: string;
  uploadUrls: Record<string, string>;
}
