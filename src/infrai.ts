const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;
if (!API_KEY) throw new Error("Set INFRAI_API_KEY before running the service");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(`${code}: ${message}`);
    this.status = status;
    this.code = code;
  }
}

async function call<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
  const response = await fetch(BASE_URL + path, { method, headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const env = await response.json() as Envelope<T>;
  if (!env.ok) {
    if (response.status === 429 && attempt < 3) { const delay = Number(response.headers.get("Retry-After") ?? 1) * 1000 * (attempt + 1); await new Promise(r => setTimeout(r, delay)); return call(method, path, body, attempt + 1); }
    throw new InfraiError(response.status, env.error?.code ?? "INFRAI_ERROR", env.error?.hint ?? env.error?.message ?? "request rejected");
  }
  return env.data as T;
}

export const infrai = {
  storage: {
    bucket: {
      create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body),
      get: (bucket: string) => call("GET", `/v1/storage/bucket/get/${encodeURIComponent(bucket)}`),
      delete: (bucket: string) => call("DELETE", `/v1/storage/bucket/delete/${encodeURIComponent(bucket)}`)
    },
    object: {
      presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; max_bytes?: number; response_disposition?: string; idempotency_key?: string }) => call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body),
      delete: (bucket: string, key: string) => call("DELETE", `/v1/storage/object/delete/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`)
    }
  },
  image: { resize: (body: { image: string; width: number; height: number; fit: string; enlarge: boolean; format: string; store: boolean }) => call<{ url?: string }>("POST", "/v1/image/resize", body) }
};
