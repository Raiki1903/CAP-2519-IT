import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST || "ccscloud.dlsu.edu.ph",
    port: Number(process.env.DATABASE_PORT) || 11572,
    user: process.env.DATABASE_USER || "cap-2519-it",
    password: process.env.DATABASE_PASSWORD || "admin",
    database: process.env.DATABASE_NAME || "AdRIC_DB",
    connectionLimit: 20,
    connectTimeout: 10000,
    allowPublicKeyRetrieval: true,
    idleTimeout: 30,
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;