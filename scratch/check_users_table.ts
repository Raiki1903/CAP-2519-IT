import { prisma } from "../prisma";

async function main() {
  try {
    const raw: any = await prisma.$queryRaw`DESCRIBE users;`;
    console.log("Users table columns:", raw);
  } catch (e: any) {
    console.error("Describe users error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
