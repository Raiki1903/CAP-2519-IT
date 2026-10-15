/**
 * Server configuration: loads .env and checks every variable the server reads, once, at startup.
 * Layer: config. Imported by main.ts, config/prisma.ts, and shared/services/mailer.ts. Calls dotenv.
 * Used by: the whole backend. Variable names and what each one is for: .env.example.
 */
import 'dotenv/config';

// No defaults for the database: a missing value used to fall back to the shared
// CCS Cloud database with credentials written in the code. (C-07)
// No default for SESSION_SECRET either: one shared default would let anyone who reads the code sign a session.
const REQUIRED = [
    'DATABASE_HOST',
    'DATABASE_PORT',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
    'DATABASE_NAME',
    'SESSION_SECRET',
] as const;

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
    throw new Error(
        `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Copy .env.example to .env and fill them in.`
    );
}

const databasePort = Number(process.env.DATABASE_PORT);
if (!Number.isInteger(databasePort) || databasePort <= 0) {
    throw new Error('DATABASE_PORT must be a whole number, for example 3306.');
}

// Anyone who knows or guesses the secret can sign a session for any account, so a short one is refused.
const MIN_SESSION_SECRET_LENGTH = 32;
if (process.env.SESSION_SECRET!.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
        `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters. ` +
        `Make one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
}

/**
 * The server's settings, read once when this module loads.
 * Importing this module throws, and the server stops before listening, when a database
 * variable or SESSION_SECRET is missing, DATABASE_PORT is not a whole number, or SESSION_SECRET is too short.
 * An empty string counts as not set for every variable.
 */
export const env = {
    /** HTTP port. Optional, 4000 when unset. */
    port: Number(process.env.PORT) || 4000,
    /** Connection details for Prisma. All five are required. */
    database: {
        host: process.env.DATABASE_HOST!,
        port: databasePort,
        user: process.env.DATABASE_USER!,
        password: process.env.DATABASE_PASSWORD!,
        name: process.env.DATABASE_NAME!,
    },
    /** Mailgun settings. Optional: without a key and a domain the server sends no mail. */
    mailgunApiKey: process.env.MAILGUN_API_KEY || '',
    mailgunDomain: process.env.MAILGUN_DOMAIN || '',
    mailgunFrom: process.env.MAILGUN_FROM || '',
    /** Signs the session cookie. Required, at least 32 characters. */
    sessionSecret: process.env.SESSION_SECRET!,
    /** The web app's address, the only origin CORS answers. Optional, http://localhost:5173 when unset. */
    webOrigin: (process.env.WEB_ORIGIN || 'http://localhost:5173').replace(/\/+$/, ''),
};
