import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma.js';

export async function performDatabaseBackup() {
    try {
        // Disabled unless BACKUP_DIR is set, and the path must be outside the repository.
        // Writing backups into scratch/backups/ is how 113 files of personal data got
        // committed, so there is deliberately no default. (C-01, M-19)
        const backupDir = process.env.BACKUP_DIR;
        if (!backupDir) {
            console.warn("⚠️  Backup skipped: BACKUP_DIR is not set. See .env.example.");
            return;
        }
        const resolvedBackupDir = path.resolve(backupDir);
        const repoRoot = path.resolve(process.cwd());
        if (resolvedBackupDir === repoRoot || resolvedBackupDir.startsWith(repoRoot + path.sep)) {
            console.warn("⚠️  Backup skipped: BACKUP_DIR must be outside the repository. (C-01)");
            return;
        }
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // The users table is never backed up: every row holds a plaintext password
        // and an ID number, and these files are not access controlled. (C-01, C-03)
        const [assetsData, transfersData, repairsData, loansData] = await Promise.all([
            prisma.assets.findMany(),
            prisma.asset_transfers.findMany(),
            prisma.asset_repairs.findMany(),
            prisma.asset_loans.findMany()
        ]);

        const backupData = {
            timestamp: new Date().toISOString(),
            assets: assetsData,
            transfers: transfersData,
            repairs: repairsData,
            loans: loansData
        };

        const filename = `backup-${Date.now()}.json`;
        fs.writeFileSync(path.join(backupDir, filename), JSON.stringify(backupData, null, 2));
        console.log(`💾 Automated DB Backup completed: ${filename}`);
    } catch (e) {
        console.error("❌ DB Backup failed:", e);
    }
}
