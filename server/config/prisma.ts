/**
 * The Prisma client: the one database connection pool for the whole backend.
 * Layer: config. Imported by remainingRoutes.ts, jobs/backup.ts, and test-user.ts; later by each feature's repository. Calls config/env.ts and the MariaDB adapter.
 * Used by: every workflow that reads or writes the database.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

const adapter = new PrismaMariaDb({
    host: env.database.host,
    port: env.database.port,
    user: env.database.user,
    password: env.database.password,
    database: env.database.name,
    connectionLimit: 20,
    connectTimeout: 10000,
    allowPublicKeyRetrieval: true,
    idleTimeout: 30,
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** The shared Prisma client. Only repository code should call it (01D section 4); until steps 11 and 12, remainingRoutes.ts calls it directly. */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Keeps one client per process outside production, so a module loaded twice does not open a second pool.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
