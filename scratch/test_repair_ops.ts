import { prisma } from "../prisma.js";

async function testRepairOperations() {
    console.log("Testing Repair Operations & History connection to MySQL...");
    try {
        const firstAsset = await prisma.assets.findFirst();
        if (!firstAsset) {
            console.error("No asset found for test.");
            process.exit(1);
        }

        const firstUser = await prisma.users.findFirst();
        if (!firstUser) {
            console.error("No user found for test.");
            process.exit(1);
        }

        // 1. Create a repair ticket in asset_repairs table
        console.log(`Step 1: Creating repair ticket for asset ${firstAsset.asset_tag}...`);
        const newTicket = await prisma.asset_repairs.create({
            data: {
                asset_id: firstAsset.asset_id,
                reported_by_id: firstUser.user_id,
                issue_description: "[Automated Test] Hardware fan failure & thermal throttling",
                is_immediate: false,
                progress_status: "Pending TSG Review"
            }
        });
        console.log(`✅ Repair ticket #${newTicket.repair_id} created in MySQL!`);

        // 2. Fetch all repairs from asset_repairs
        const allRepairs = await prisma.asset_repairs.findMany({
            where: { asset_id: firstAsset.asset_id },
            orderBy: { created_at: "desc" }
        });
        console.log(`✅ Total repair records for asset ${firstAsset.asset_tag}: ${allRepairs.length}`);

        // 3. Update status to 'Inspection Phase'
        console.log(`Step 2: Updating ticket #${newTicket.repair_id} status to 'Inspection Phase'...`);
        const updatedTicket = await prisma.asset_repairs.update({
            where: { repair_id: newTicket.repair_id },
            data: { progress_status: "Inspection Phase" }
        });
        console.log(`✅ Ticket #${updatedTicket.repair_id} status updated to: '${updatedTicket.progress_status}'`);

        // 4. Mark ticket as 'Fixed & Completed' (moving to repair history)
        console.log(`Step 3: Completing ticket #${newTicket.repair_id} ('Fixed & Completed')...`);
        const completedTicket = await prisma.asset_repairs.update({
            where: { repair_id: newTicket.repair_id },
            data: { progress_status: "Fixed & Completed" }
        });
        console.log(`✅ Ticket #${completedTicket.repair_id} completed and logged in repair history!`);

        // 5. Clean up test ticket
        await prisma.asset_repairs.delete({
            where: { repair_id: newTicket.repair_id }
        });
        console.log("✅ Test repair ticket cleaned up.");
        console.log("🎉 All Repair operations & history log tests passed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Repair Operations Test Failed:", err);
        process.exit(1);
    }
}

testRepairOperations();
