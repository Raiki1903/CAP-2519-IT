import { prisma } from '../prisma.js';

async function main() {
    console.log("Fetching asset_monetary data with latest asset status...");
    const monetaries = await prisma.asset_monetary.findMany({
        select: {
            asset_id: true,
            funding_source: true,
            acquisition_value: true,
            assets: {
                select: {
                    name: true,
                    category: true,
                    asset_records: {
                        orderBy: { date_logged: 'desc' },
                        take: 1,
                        select: {
                            status: true
                        }
                    }
                }
            }
        }
    });

    console.log(`Total monetaries: ${monetaries.length}`);
    monetaries.forEach((m) => {
        const status = m.assets?.asset_records[0]?.status || "NO_RECORD";
        console.log(`ID: ${m.asset_id}, Funding: ${m.funding_source}, Value: ${m.acquisition_value}, Category: ${m.assets?.category}, Status: ${status}`);
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
