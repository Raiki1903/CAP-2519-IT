import { prisma } from '../prisma.js';

async function main() {
    console.log("Fetching users from the database...");
    const users = await prisma.users.findMany({
        include: {
            user_roles: {
                include: {
                    roles: true
                }
            }
        }
    });

    console.log(`Total users: ${users.length}`);
    users.forEach((u) => {
        const roles = u.user_roles.map(ur => ur.roles.role_name).join(', ');
        console.log(`ID: ${u.user_id}, Name: ${u.first_name} ${u.last_name}, Email: ${u.email}, Password: ${u.password}, Roles: ${roles}`);
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
