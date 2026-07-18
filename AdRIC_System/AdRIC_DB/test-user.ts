import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/prisma/client';

// 1. Setup the driver adapter
const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST || 'localhost',
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || 'Barbatos@08',
    database: process.env.DATABASE_NAME || 'AdRIC_Database',
});

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🚀 Inserting new asset into the 'assets' table...");

    // 2. Insert data matching your exact SQL schema fields
    // Prisma pluralizes/capitalizes based on schema.prisma; usually it maps to 'users' or 'user'
    const newAsset = await prisma.assets.create({
        data: {
            asset_id: 22,
            qr_code_hash: "QRHASH@12375", // Must be exactly 'STUDENT' or 'FACULTY' to match your SQL ENUM
            asset_name: "ASUS TUF A16", // Must be exactly 'STUDENT' or 'FACULTY' to match your SQL ENUM
            asset_type: "DEV_KIT", // Must be exactly 'STUDENT' or 'FACULTY' to match your SQL ENUM
            center_id: 1 // Must be 
        },
    });

    console.log("✅ Success! Created user:", newAsset);
}

/*const newAsset = await prisma.research_centers.create({
    data: {
        center_id: 1,
        center_name: "CITe4D", // Must be exactly 'STUDENT' or 'FACULTY' to match your SQL ENUM
        campus_location: "MANILA_CAMPUS", // Must be exactly 'STUDENT' or 'FACULTY' to match your SQL ENUM
    },
});*/

main()
    .catch((error) => {
        console.error("❌ Error running script:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });