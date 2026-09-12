import 'dotenv/config';
import { prisma } from '../prisma.js';

async function main() {
    console.log("🚀 Testing transaction insert...");
    const testTag = `TEST-${Date.now()}`;
    
    const result = await prisma.$transaction(async (tx) => {
        const asset = await tx.assets.create({
            data: {
                asset_tag: testTag,
                name: "Transaction Lock Test Asset",
                category: "DEV_KIT",
                manufacturer: "Test Vendor",
            }
        });

        await tx.asset_monetary.create({
            data: {
                asset_id: asset.asset_id,
                funding_source: "Test Grant",
                acquisition_value: 12345.67,
            }
        });

        await tx.asset_records.create({
            data: {
                asset_id: asset.asset_id,
                status: "ACTIVE",
                location: "Test Lab",
                current_custodian: 1,
            }
        });

        return asset;
    });

    console.log("✅ Transaction completed successfully! Created asset:", result.asset_id, result.asset_tag);

    // Clean up test data
    await prisma.$transaction(async (tx) => {
        await tx.asset_records.deleteMany({ where: { asset_id: result.asset_id } });
        await tx.asset_monetary.deleteMany({ where: { asset_id: result.asset_id } });
        await tx.assets.delete({ where: { asset_id: result.asset_id } });
    });
    console.log("✅ Cleanup completed cleanly!");
}

main()
    .catch((err) => {
        console.error("❌ Transaction failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
