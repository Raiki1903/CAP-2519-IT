/**
 * Tests that no server log line holds an emoji: the server terminal shows plain lines only.
 * Covers every .ts file under server/. No server, no database: the files are read as text.
 * Fixtures: none.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SERVER = path.join(__dirname, "..", "..", "server");

/** Every .ts file under a folder. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("the server's log lines", () => {
  it("hold no emoji on any console. line", () => {
    const offenders = sourceFiles(SERVER).flatMap((file) =>
      fs.readFileSync(file, "utf-8").split(/\r?\n/)
        .map((line, i) => ({ line, at: `${path.relative(SERVER, file)}:${i + 1}` }))
        .filter(({ line }) => line.includes("console.") && /\p{Extended_Pictographic}/u.test(line))
        .map(({ at }) => at),
    );

    expect(offenders).toEqual([]);
  });
});
