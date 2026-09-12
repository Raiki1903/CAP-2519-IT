import { prisma } from "../prisma.js";

async function main() {
    console.log("Testing Prisma connection to remote MySQL...");
    try {
        const assetsCount = await prisma.assets.count();
        console.log(`✅ assets table count: ${assetsCount}`);

        const dbMonetaries = await prisma.asset_monetary.findMany({ take: 5 });
        console.log(`✅ asset_monetary sample count: ${dbMonetaries.length}`);

        const dbProjects = await prisma.projects.findMany({ take: 5 });
        console.log(`✅ projects sample count: ${dbProjects.length}`);

        const dbUsers = await prisma.users.findMany({ take: 5 });
        console.log(`✅ users sample count: ${dbUsers.length}`);

        const dbRecords = await prisma.asset_records.findMany({ take: 5 });
        console.log(`✅ asset_records sample count: ${dbRecords.length}`);

        console.log("🎉 All queries executed cleanly without schema errors!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Test failed:", err);
        process.exit(1);
    }
}

main();
