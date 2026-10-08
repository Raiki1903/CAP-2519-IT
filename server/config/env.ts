import 'dotenv/config';

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

export const env = {
    port: Number(process.env.PORT) || 4000,
    database: {
        host: process.env.DATABASE_HOST!,
        port: databasePort,
        user: process.env.DATABASE_USER!,
        password: process.env.DATABASE_PASSWORD!,
        name: process.env.DATABASE_NAME!,
    },
    mailgunApiKey: process.env.MAILGUN_API_KEY || '',
    mailgunDomain: process.env.MAILGUN_DOMAIN || '',
    mailgunFrom: process.env.MAILGUN_FROM || '',
    backupDir: process.env.BACKUP_DIR || '',
};
