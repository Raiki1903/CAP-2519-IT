const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Thrown when the seed must not run. The message never holds the URL, the user, or a password. */
export class SeedRefused extends Error {
  constructor(reason: string) {
    super(`Seed refused: ${reason} Nothing was written. See docs/guides/DATABASE-MIGRATIONS.md.`);
    this.name = "SeedRefused";
  }
}

/** Connection details for the database the seed fills, taken apart for the MariaDB adapter. */
export interface SeedTarget {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Checks SEED_DATABASE_URL and accepts it only for a MySQL database on this machine.
 * The seed takes its target from this one variable, never from .env, whose settings point at CCS Cloud,
 * so a forgotten setting stops here instead of reaching the shared database.
 *
 * @param url the value of SEED_DATABASE_URL, for example mysql://root:<password>@localhost:3306/AdRIC_DB_dev
 * @returns the parsed connection details
 * @throws SeedRefused when the URL is missing, malformed, not MySQL, not local, or has no database, user, or password
 */
export function parseSeedTarget(url: string | undefined): SeedTarget {
  if (!url) {
    throw new SeedRefused("SEED_DATABASE_URL is not set. Set it in the shell for this one command; the seed never reads .env.");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SeedRefused("SEED_DATABASE_URL is not a valid URL.");
  }
  if (parsed.protocol !== "mysql:") {
    throw new SeedRefused("SEED_DATABASE_URL must start with mysql://.");
  }
  if (!LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new SeedRefused("the host must be localhost or 127.0.0.1. The seed never runs against a shared database.");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  // The name is compared with what MySQL reports, so only plain characters are accepted.
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new SeedRefused("SEED_DATABASE_URL must name a database, using only letters, digits, and underscores.");
  }
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  if (!user || !password) {
    throw new SeedRefused("SEED_DATABASE_URL needs both a user name and a password.");
  }
  return { host: parsed.hostname, port: parsed.port ? Number(parsed.port) : 3306, user, password, database };
}

/** Shortest password the seed accepts for the demo accounts. */
export const MIN_SEED_PASSWORD_LENGTH = 8;

/**
 * Checks SEED_PASSWORD, the one password every demo account gets. It comes from the shell so that
 * no password is written in the repository; passwords are stored as plain text until issue #10 (C-03).
 *
 * @param value the value of SEED_PASSWORD
 * @returns the password, unchanged
 * @throws SeedRefused when it is missing or shorter than MIN_SEED_PASSWORD_LENGTH (the message never holds it)
 */
export function readSeedPassword(value: string | undefined): string {
  if (!value) {
    throw new SeedRefused("SEED_PASSWORD is not set. Set it in the shell for this one command: every demo account gets it.");
  }
  if (value.length < MIN_SEED_PASSWORD_LENGTH) {
    throw new SeedRefused(`SEED_PASSWORD must be at least ${MIN_SEED_PASSWORD_LENGTH} characters.`);
  }
  return value;
}

/** A printable name for the target, without the user or password. */
export function describeSeedTarget(target: SeedTarget): string {
  return `${target.host}:${target.port}/${target.database}`;
}
