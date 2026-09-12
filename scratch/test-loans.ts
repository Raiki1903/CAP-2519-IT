import 'dotenv/config';
import { prisma } from '../prisma.js';

async function main() {
    const loans = await prisma.asset_loans.findMany({
        include: {
            assets: true,
            users: true
        }
    });
    console.log("=== LOAN SUMMARY ===");
    loans.forEach(l => {
        console.log(`ID: ${l.loan_id} | Asset: ${l.assets?.name} (${l.assets?.asset_tag}) | Borrower: ${l.users?.first_name} ${l.users?.last_name} (ID ${l.borrower_id}) | Status: ${l.status} | Due: ${l.due_date}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
