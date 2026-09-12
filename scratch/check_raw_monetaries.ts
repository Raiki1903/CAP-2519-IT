import { prisma } from '../prisma.js';

async function main() {
    console.log("Querying database tables raw...");
    const monetaries: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM asset_monetary`);
    console.log(`Total monetaries in DB: ${monetaries.length}`);
    console.log(JSON.stringify(monetaries, null, 2));
}

main()
    .catch((error) => {
        console.error("❌ Error running script:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
