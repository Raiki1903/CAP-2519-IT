/**
 * API client: the one place that knows the backend address and how requests are sent.
 * Layer: api. Called by the web/api/*.api.ts files only. Calls the browser's fetch.
 * Used by: every workflow that talks to the server.
 */

// Falls back to the local server's address (server.ts listens on port 4000),
// so the app runs with no VITE_API_URL set.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * The body every endpoint answers with: `success`, an `error` message when it
 * failed, and endpoint-specific fields (for example `loans`).
 */
// TODO(H-13): the extra fields are untyped. Real response shapes go in shared/types/ as each backend feature is extracted (steps 11 and 12).
export interface ApiResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Sends a request with a JSON body and returns the untouched Response.
 *
 * @param method HTTP method, for example "POST"
 * @param path path starting with "/api/"
 * @param body value sent as JSON
 * @returns the raw Response, not yet parsed
 * @throws if the server cannot be reached
 */
function sendRaw(method: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Sends a request with a JSON body and returns the parsed JSON answer.
 *
 * @param method HTTP method, for example "POST"
 * @param path path starting with "/api/"
 * @param body value sent as JSON
 * @returns the parsed response body
 * @throws if the server cannot be reached or the answer is not JSON
 */
async function sendJson(method: string, path: string, body: unknown): Promise<ApiResult> {
  const res = await sendRaw(method, path, body);
  // The HTTP status is not checked on purpose: callers read `success` from the
  // body, and a 400 or 404 from this server still carries a JSON `error` to show.
  // TODO(H-16): throw typed errors here once the server has its errorHandler. Step 13.
  return res.json();
}

/**
 * Reads from an endpoint.
 *
 * @param path path starting with "/api/", including any query string
 * @returns the parsed response body; check `success` before using it
 * @throws if the server cannot be reached or the answer is not JSON
 */
export async function apiGet(path: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  return res.json();
}

/**
 * Sends a POST with a JSON body. Used to create something.
 *
 * @param path path starting with "/api/"
 * @param body value sent as JSON
 * @returns the parsed response body; check `success` before using it
 * @throws if the server cannot be reached or the answer is not JSON
 */
export function apiPost(path: string, body: unknown): Promise<ApiResult> {
  return sendJson("POST", path, body);
}

/**
 * Sends a PUT with a JSON body. Used to change something that exists.
 *
 * @param path path starting with "/api/"
 * @param body value sent as JSON
 * @returns the parsed response body; check `success` before using it
 * @throws if the server cannot be reached or the answer is not JSON
 */
export function apiPut(path: string, body: unknown): Promise<ApiResult> {
  return sendJson("PUT", path, body);
}

/**
 * Sends a DELETE with no body.
 *
 * @param path path starting with "/api/"
 * @returns the parsed response body; check `success` before using it
 * @throws if the server cannot be reached or the answer is not JSON
 */
export async function apiDelete(path: string): Promise<ApiResult> {
  const res = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
  return res.json();
}

// The three "Raw" calls below return the Response without parsing it. They
// exist for call sites that check the HTTP status or content type themselves,
// or that send a request and never read the answer. Parsing for them here
// would change what those screens do when the server answers with an error.
// TODO(H-16): remove the Raw calls once apiGet, apiPost, and apiPut throw typed errors. Step 13.

/**
 * Like `apiGet`, but returns the untouched Response.
 *
 * @param path path starting with "/api/", including any query string
 * @returns the raw Response; the caller checks `ok` and parses it
 * @throws if the server cannot be reached
 */
export function apiGetRaw(path: string): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`);
}

/**
 * Like `apiPost`, but returns the untouched Response.
 *
 * @param path path starting with "/api/"
 * @param body value sent as JSON
 * @returns the raw Response
 * @throws if the server cannot be reached
 */
export function apiPostRaw(path: string, body: unknown): Promise<Response> {
  return sendRaw("POST", path, body);
}

/**
 * Like `apiPut`, but returns the untouched Response.
 *
 * @param path path starting with "/api/"
 * @param body value sent as JSON
 * @returns the raw Response
 * @throws if the server cannot be reached
 */
export function apiPutRaw(path: string, body: unknown): Promise<Response> {
  return sendRaw("PUT", path, body);
}
