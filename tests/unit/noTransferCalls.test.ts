/**
 * Tests that no web code still calls the transfer endpoints, removed in Batch 1 with the transfers feature.
 * Covers every .ts and .tsx file under web/. No server, no database: the files are read as text.
 * Fixtures: none.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB = path.join(__dirname, "..", "..", "web");

/** Every .ts and .tsx file under a folder. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("the web code after transfers were removed", () => {
  it("calls no transfer endpoint and imports no transfer client", () => {
    const offenders = sourceFiles(WEB).filter((file) => /asset_transfers|\/transfer[`'"]|transfers\.api|TransferForm/.test(fs.readFileSync(file, "utf-8")));

    expect(offenders.map((f) => path.relative(WEB, f))).toEqual([]);
  });
});
