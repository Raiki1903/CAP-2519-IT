/**
 * Tests readResult in web/api/client.ts: a failed registration or edit shows only the server's message, never the raw response.
 * Covers a JSON refusal, a JSON failure with no message, an HTML error page, a broken JSON body, a success, and that no web file
 * still builds the old "Server returned error" text. No server, no database.
 * Fixtures: none.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readResult } from "../../web/api/client";

const WEB = path.join(__dirname, "..", "..", "web");
const FALLBACK = "The asset could not be registered. Please try again.";

/** A Response with a JSON content type. */
function jsonResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

/** Every .ts and .tsx file under a folder. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("readResult", () => {
  it("keeps only the server's error text from a JSON refusal", async () => {
    const res = jsonResponse(403, JSON.stringify({ success: false, error: "Your role is not allowed to do this." }));

    const result = await readResult(res, FALLBACK);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Your role is not allowed to do this.");
  });

  it("uses the fallback when a JSON failure has no message", async () => {
    const result = await readResult(jsonResponse(500, JSON.stringify({ success: false })), FALLBACK);

    expect(result).toEqual({ success: false, error: FALLBACK });
  });

  it("uses the fallback for an HTML error page, without its text", async () => {
    const res = new Response("<html><body>Bad Gateway</body></html>", { status: 502, headers: { "Content-Type": "text/html" } });

    const result = await readResult(res, FALLBACK);

    expect(result).toEqual({ success: false, error: FALLBACK });
  });

  it("uses the fallback for a body labelled JSON that does not parse", async () => {
    const result = await readResult(jsonResponse(500, "{not json"), FALLBACK);

    expect(result).toEqual({ success: false, error: FALLBACK });
  });

  it("returns the body of a success as it is", async () => {
    const body = { success: true, asset: { asset_tag: "CAR-0001" } };

    const result = await readResult(jsonResponse(201, JSON.stringify(body)), FALLBACK);

    expect(result).toEqual(body);
  });

  it("is a failure when the status is not OK, even if the body says success", async () => {
    const result = await readResult(jsonResponse(403, JSON.stringify({ success: true })), FALLBACK);

    expect(result.success).toBe(false);
    expect(result.error).toBe(FALLBACK);
  });
});

describe("the web code", () => {
  it("never shows the raw \"Server returned error\" text", () => {
    const offenders = sourceFiles(WEB).filter((file) => fs.readFileSync(file, "utf-8").includes("Server returned error"));

    expect(offenders.map((f) => path.relative(WEB, f))).toEqual([]);
  });
});
