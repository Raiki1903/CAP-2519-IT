import 'dotenv/config';
import { prisma } from '../prisma.js';

async function main() {
    const transfers = await prisma.asset_transfers.findMany();
    console.log("=== ASSET TRANSFERS ===");
    console.log(JSON.stringify(transfers, null, 2));

    const userCenters = await prisma.user_centers.findMany({
        include: { research_centers: true }
    });
    console.log("=== USER CENTERS ===");
    console.log(JSON.stringify(userCenters, null, 2));

    const users = await prisma.users.findMany();
    console.log("=== USERS ===");
    console.log(JSON.stringify(users.map(u => ({ id: u.user_id, name: `${u.first_name} ${u.last_name}` })), null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
