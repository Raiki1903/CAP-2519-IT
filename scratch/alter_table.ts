import { prisma } from "../prisma.js";

async function alterTable() {
    try {
        console.log("Modifying assets.image_url column type in MySQL to LONGTEXT...");
        await prisma.$executeRawUnsafe("ALTER TABLE assets MODIFY image_url LONGTEXT NULL;");
        console.log("✅ Successfully altered assets.image_url to LONGTEXT!");
        process.exit(0);
    } catch (e) {
        console.error("❌ Failed to alter table:", e);
        process.exit(1);
    }
}

alterTable();
