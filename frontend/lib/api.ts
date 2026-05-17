import { ApiEnvelope, ApiErrorEnvelope } from "../types/domain";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

// In-Memory Token Store (secure: never in sessionStorage or localStorage!)
let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let authStateListener: ((token: string | null) => void) | null = null;

export function setTokens(accessToken: string | null, refreshToken: string | null = null) {
  currentAccessToken = accessToken;
  if (refreshToken) currentRefreshToken = refreshToken;
  if (authStateListener) authStateListener(accessToken);
}

export function getAccessToken(): string | null {
  return currentAccessToken;
}

export function getRefreshToken(): string | null {
  return currentRefreshToken;
}

export function onAuthStateChange(listener: (token: string | null) => void) {
  authStateListener = listener;
}

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refreshToken: currentRefreshToken || undefined })
      });

      if (!res.ok) {
        setTokens(null, null);
        return null;
      }

      const json = await res.json();
      const newAccessToken = json.data?.accessToken;
      const newRefreshToken = json.data?.refreshToken;
      setTokens(newAccessToken, newRefreshToken);
      return newAccessToken;
    } catch {
      setTokens(null, null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  skipAuth?: boolean;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {})
  };

  if (!options.skipAuth && currentAccessToken) {
    headers["Authorization"] = `Bearer ${currentAccessToken}`;
  }

  if (options.idempotencyKey) {
    headers["X-Idempotency-Key"] = options.idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include"
    });
  } catch (netErr) {
    throw new ApiError("NETWORK_ERROR", "Unable to connect to StockPulse API server. Please check your network connection.", 0);
  }

  // Handle 401 Unauthorized with automatic silent token refresh and retry
  if (response.status === 401 && !options.skipAuth && currentRefreshToken) {
    const freshToken = await refreshAccessToken();
    if (freshToken) {
      headers["Authorization"] = `Bearer ${freshToken}`;
      response = await fetch(url, {
        ...options,
        headers,
        credentials: "include"
      });
    }
  }

  let payload: any;
  const text = await response.text();
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: { code: "INVALID_RESPONSE", message: "Server returned non-JSON response." } };
  }

  if (!response.ok) {
    const errData = payload.error || {};
    throw new ApiError(
      errData.code || "REQUEST_FAILED",
      errData.message || `Request failed with status ${response.status}`,
      response.status,
      errData.details
    );
  }

  return (payload as ApiEnvelope<T>).data;
}
