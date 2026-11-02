/**
 * The password upgrade script's safety check: which database URL (HASH_TARGET_URL) it accepts, before it connects.
 * The rule itself is the seed's, in seedTarget.ts. This file adds only the --allow-remote switch.
 * Layer: database tooling. Called by prisma/hashExistingPasswords.ts and tests/db/hashExistingPasswords.test.ts. Calls seedTarget.ts.
 * Used by: prisma/hashExistingPasswords.ts.
 */
import { parseSeedTarget, type SeedTarget } from "./seedTarget";

/** The one way past the local-host rule. Only for a planned upgrade of a deployed database, after a backup. */
export const ALLOW_REMOTE_FLAG = "--allow-remote";

/**
 * Checks HASH_TARGET_URL and accepts it for a MySQL database on this machine, or anywhere with the flag.
 *
 * @param url the value of HASH_TARGET_URL
 * @param args the command-line arguments
 * @returns the parsed connection details
 * @throws SeedRefused when the URL is missing, malformed, not MySQL, has no database, user, or password, or is not local without the flag
 */
export function parseHashTarget(url: string | undefined, args: string[]): SeedTarget {
  return parseSeedTarget(url, {
    variable: "HASH_TARGET_URL",
    tool: "Hash script",
    hostRefusal: `the host must be localhost or 127.0.0.1 unless ${ALLOW_REMOTE_FLAG} is given.`,
    allowRemote: args.includes(ALLOW_REMOTE_FLAG),
  });
}
