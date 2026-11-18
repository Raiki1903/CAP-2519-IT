/**
 * The seed's safety checks, before it connects: which database URL (SEED_DATABASE_URL), which mode (SEED_MODE), and which
 * password (SEED_PASSWORD) and, in base mode, which email (SEED_ADMIN_EMAIL) it accepts.
 * The rule on the URL is shared with the password upgrade script, through hashTarget.ts.
 * Layer: database tooling. Called by prisma/seed.ts, prisma/hashTarget.ts, and tests/db/seedTarget.test.ts. Reads the
 * sign-up and password constants in shared/.
 * Used by: npm run seed and prisma/hashExistingPasswords.ts.
 */
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "../shared/constants/passwords";
import { SIGN_UP_EMAIL_DOMAIN } from "../shared/constants/signUp";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** Thrown when the seed or the upgrade script must not run. The message never holds the URL, the user, or a password. */
export class SeedRefused extends Error {
  constructor(reason: string, tool = "Seed") {
    super(`${tool} refused: ${reason} Nothing was written. See docs/guides/DATABASE-MIGRATIONS.md.`);
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

/** What differs between the tools that use parseSeedTarget. */
export interface TargetRules {
  /** The environment variable that holds the URL. */
  variable: string;
  /** The tool's name, at the start of its refusals. */
  tool: string;
  /** The reason given for a host that is not local. */
  hostRefusal: string;
  /** True only for the upgrade script's explicit --allow-remote. */
  allowRemote: boolean;
}

const SEED_RULES: TargetRules = {
  variable: "SEED_DATABASE_URL",
  tool: "Seed",
  hostRefusal: "the host must be localhost or 127.0.0.1. The seed never runs against a shared database.",
  allowRemote: false,
};

/**
 * Checks the target URL and accepts it only for a MySQL database on this machine.
 * The tool takes its target from this one variable, never from .env, whose settings point at CCS Cloud,
 * so a forgotten setting stops here instead of reaching the shared database.
 *
 * @param url the variable's value, for example mysql://root:<password>@localhost:3306/AdRIC_DB_dev
 * @param rules what differs per tool; the seed's when omitted
 * @returns the parsed connection details
 * @throws SeedRefused when the URL is missing, malformed, not MySQL, not local, or has no database, user, or password
 */
export function parseSeedTarget(url: string | undefined, rules: TargetRules = SEED_RULES): SeedTarget {
  const { variable, tool } = rules;
  const refuse = (reason: string) => new SeedRefused(reason, tool);
  if (!url) {
    throw refuse(`${variable} is not set. Set it in the shell for this one command; the ${tool.toLowerCase()} never reads .env.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw refuse(`${variable} is not a valid URL.`);
  }
  if (parsed.protocol !== "mysql:") {
    throw refuse(`${variable} must start with mysql://.`);
  }
  if (!rules.allowRemote && !LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw refuse(rules.hostRefusal);
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  // The name is compared with what MySQL reports, so only plain characters are accepted.
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw refuse(`${variable} must name a database, using only letters, digits, and underscores.`);
  }
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  if (!user || !password) {
    throw refuse(`${variable} needs both a user name and a password.`);
  }
  return { host: parsed.hostname, port: parsed.port ? Number(parsed.port) : 3306, user, password, database };
}

/** Shortest password the seed accepts for the demo accounts. */
export const MIN_SEED_PASSWORD_LENGTH = 8;

/**
 * Checks SEED_PASSWORD, the one password every demo account logs in with. It comes from the shell so that
 * no password is written in the repository; the database holds only its hash.
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

/** Which data the seed writes: the demo data, or the base setup for a clean start. */
export type SeedMode = "demo" | "base";

/**
 * Checks SEED_MODE. Unset means the demo seed, as before. Any other value but `demo` or `base`, an empty one
 * included, is refused, so a typo never falls back to the demo data.
 *
 * @param value the value of SEED_MODE
 * @returns the mode to run
 * @throws SeedRefused for any other value (the message does not repeat it)
 */
export function readSeedMode(value: string | undefined): SeedMode {
  if (value === undefined || value === "demo") return "demo";
  if (value === "base") return "base";
  throw new SeedRefused("SEED_MODE must be demo or base, or not set.");
}

/** Longest email users.email holds (VARCHAR(255)). */
const MAX_EMAIL_LENGTH = 255;

/**
 * Checks SEED_ADMIN_EMAIL, the base setup's one account. It is trimmed and put in lower case, as sign-up and login do,
 * and must end with the sign-up domain with something before it.
 *
 * @param value the value of SEED_ADMIN_EMAIL
 * @returns the email as it will be stored
 * @throws SeedRefused when it is missing, outside the domain, or too long (the message never holds it)
 */
export function readSeedAdminEmail(value: string | undefined): string {
  const email = value?.trim().toLowerCase();
  if (!email) {
    throw new SeedRefused("SEED_ADMIN_EMAIL is not set. Set it in the shell for this one command: it is the IT Admin's login.");
  }
  if (!email.endsWith(SIGN_UP_EMAIL_DOMAIN) || email.length === SIGN_UP_EMAIL_DOMAIN.length) {
    throw new SeedRefused(`SEED_ADMIN_EMAIL must be a ${SIGN_UP_EMAIL_DOMAIN} address.`);
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    throw new SeedRefused(`SEED_ADMIN_EMAIL must be at most ${MAX_EMAIL_LENGTH} characters.`);
  }
  return email;
}

/**
 * Checks SEED_PASSWORD for the base setup: the IT Admin's first password. It must pass the seed's own rule and the
 * app's new-password rule, so the IT Admin can change it later in Account Details, and login accepts it.
 *
 * @param value the value of SEED_PASSWORD
 * @returns the password, unchanged
 * @throws SeedRefused when it is missing, too short or too long (the message never holds it)
 */
export function readAdminPassword(value: string | undefined): string {
  if (!value) {
    throw new SeedRefused("SEED_PASSWORD is not set. Set it in the shell for this one command: it is the IT Admin's first password.");
  }
  const shortest = Math.max(MIN_SEED_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH);
  if (value.length < shortest) {
    throw new SeedRefused(`SEED_PASSWORD must be at least ${shortest} characters.`);
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new SeedRefused(`SEED_PASSWORD must be at most ${MAX_PASSWORD_LENGTH} characters, the longest the app accepts.`);
  }
  return value;
}

/** A printable name for the target, without the user or password. */
export function describeSeedTarget(target: SeedTarget): string {
  return `${target.host}:${target.port}/${target.database}`;
}
