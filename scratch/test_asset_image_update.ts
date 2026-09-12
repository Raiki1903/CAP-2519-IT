import { prisma } from "../prisma.js";

async function testAssetImageUpdate() {
    try {
        console.log("Testing asset image update with long base64 string...");
        const firstAsset = await prisma.assets.findFirst();
        if (!firstAsset) {
            console.error("No asset found in database.");
            process.exit(1);
        }

        // Generate a 10KB dummy base64 string to simulate uploaded image payload
        const dummyBase64 = "data:image/png;base64," + "A".repeat(10000);

        const updated = await prisma.assets.update({
            where: { asset_id: firstAsset.asset_id },
            data: { image_url: dummyBase64 },
        });

        console.log(`✅ Asset ${updated.asset_tag} image_url updated successfully! Length: ${updated.image_url?.length}`);

        // Restore original image_url
        await prisma.assets.update({
            where: { asset_id: firstAsset.asset_id },
            data: { image_url: firstAsset.image_url },
        });

        console.log("✅ Restored original image_url value.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Test asset image update failed:", e);
        process.exit(1);
    }
}

testAssetImageUpdate();
