import { prisma } from '../prisma.js';

async function main() {
    console.log("Altering table asset_monetary to add is_documented column...");
    await prisma.$executeRawUnsafe(`
        ALTER TABLE asset_monetary 
        ADD COLUMN is_documented TINYINT(1) NOT NULL DEFAULT 1
    `);
    console.log("✅ Successfully added is_documented column!");
}

main()
    .catch((error) => {
        console.error("❌ Error altering table:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
