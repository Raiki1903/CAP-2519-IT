const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export interface ApiResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

async function sendJson(method: string, path: string, body: unknown): Promise<ApiResult> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiGet(path: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  return res.json();
}

export function apiPost(path: string, body: unknown): Promise<ApiResult> {
  return sendJson("POST", path, body);
}

export function apiPut(path: string, body: unknown): Promise<ApiResult> {
  return sendJson("PUT", path, body);
}
