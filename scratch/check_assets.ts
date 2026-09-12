import { prisma } from '../prisma.js';

async function main() {
    console.log("Fetching all assets from the database...");
    const dbAssets = await prisma.assets.findMany({
        include: {
            asset_monetary: true
        }
    });

    console.log(`Total assets in DB: ${dbAssets.length}`);
    const withoutMonetary = dbAssets.filter(a => !a.asset_monetary);
    console.log(`Assets without monetary: ${withoutMonetary.length}`);
    withoutMonetary.forEach(a => {
        console.log(`Asset ID: ${a.asset_id}, Tag: ${a.asset_tag}, Name: ${a.name}`);
    });
}

main()
    .catch((error) => {
        console.error("❌ Error running script:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
