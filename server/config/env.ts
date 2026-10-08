/**
 * Server configuration: loads .env and checks every variable the server reads, once, at startup.
 * Layer: config. Imported by main.ts, config/prisma.ts, shared/services/mailer.ts, and jobs/backup.ts. Calls dotenv.
 * Used by: the whole backend. Variable names and what each one is for: .env.example.
 */
import 'dotenv/config';

// No defaults for the database: a missing value used to fall back to the shared
// CCS Cloud database with credentials written in the code. (C-07)
const REQUIRED = [
    'DATABASE_HOST',
    'DATABASE_PORT',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
    'DATABASE_NAME',
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

/**
 * The server's settings, read once when this module loads.
 * Importing this module throws, and the server stops before listening, when a database
 * variable is missing or DATABASE_PORT is not a whole number.
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
    /** Backup folder. Optional: empty switches the backup off. Must be outside the repository. (C-01) */
    backupDir: process.env.BACKUP_DIR || '',
};
