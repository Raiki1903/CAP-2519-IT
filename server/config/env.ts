import 'dotenv/config';

export const env = {
    port: Number(process.env.PORT) || 4000,
    mailgunApiKey: process.env.MAILGUN_API_KEY || '',
    mailgunDomain: process.env.MAILGUN_DOMAIN || '',
    mailgunFrom: process.env.MAILGUN_FROM || '',
    backupDir: process.env.BACKUP_DIR || '',
};
