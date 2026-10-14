/**
 * Error handler: what the server answers when a request fails before or outside a feature's own checks.
 * Covers server/shared/middleware/errorHandler.ts through POST /api/auth/login, POST /api/assets, and unknown paths.
 * Workflow: none in particular (every request goes through it).
 * Fixtures: none; nothing is written.
 */
import { describe, expect, it } from "vitest";
import { useApiHarness } from "../setup/harness";

const { server } = useApiHarness();

/** Sends a body exactly as given, which the JSON helper of the harness cannot do. */
async function sendRaw(method: string, path: string, body: string, contentType = "application/json") {
  const response = await fetch(`${server().baseUrl}${path}`, { method, headers: { "Content-Type": contentType }, body });
  return { status: response.status, contentType: response.headers.get("content-type") ?? "", text: await response.text() };
}

const BAD_REQUEST = { success: false, error: "The request body could not be read.", code: "BAD_REQUEST" };

describe("errorHandler", () => {
  it("answers 400 JSON for a body that is not valid JSON, not Express's HTML page with its stack", async () => {
    const res = await sendRaw("POST", "/api/auth/login", '{"email": "a@example.test", "password": ');

    expect(res.status).toBe(400);
    expect(res.contentType).toMatch(/application\/json/);
    expect(JSON.parse(res.text)).toEqual(BAD_REQUEST);
  });

  it("answers 413 JSON for a body over the 50 MB limit", async () => {
    const res = await sendRaw("POST", "/api/assets", JSON.stringify({ name: "x".repeat(51 * 1024 * 1024) }));

    expect(res.status).toBe(413);
    expect(JSON.parse(res.text)).toEqual(BAD_REQUEST);
  });

  it("keeps Express's own 404 for an unknown path", async () => {
    const res = await fetch(`${server().baseUrl}/api/no-such-path`);

    expect(res.status).toBe(404);
    expect(await res.text()).toContain("Cannot GET /api/no-such-path");
  });

  it("keeps Express's own 400 for a path parameter that cannot be decoded", async () => {
    const res = await fetch(`${server().baseUrl}/api/assets/%E0%A4%A/custodian-history`);

    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
  });
});
