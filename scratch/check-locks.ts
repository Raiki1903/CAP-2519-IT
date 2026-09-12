import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    allowPublicKeyRetrieval: true,
    connectTimeout: 10000,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Checking active MySQL processlist and transactions via Prisma...");
    const processes: any = await prisma.$queryRawUnsafe(`SHOW PROCESSLIST`);
    console.log("\n--- Active MySQL Processes ---");
    console.log(processes);

    const trx: any = await prisma.$queryRawUnsafe(`SELECT * FROM information_schema.innodb_trx`);
    console.log("\n--- Active InnoDB Transactions ---");
    console.log(trx);

    const locks: any = await prisma.$queryRawUnsafe(`SELECT * FROM performance_schema.metadata_locks WHERE OBJECT_SCHEMA = 'AdRIC_DB'`);
    console.log("\n--- Metadata Locks in AdRIC_DB ---");
    console.log(locks);
}

main()
    .catch((err) => console.error(err))
    .finally(() => prisma.$disconnect());
