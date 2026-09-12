import { prisma } from "../prisma";

async function main() {
  try {
    console.log("Altering user_img column in users table to LONGTEXT...");
    await prisma.$executeRawUnsafe(`ALTER TABLE users MODIFY user_img LONGTEXT NULL;`);
    console.log("✅ Successfully altered users.user_img column to LONGTEXT!");

    const raw: any = await prisma.$queryRaw`DESCRIBE users;`;
    console.log("Updated users table columns:", raw.filter((c: any) => c.Field === "user_img"));
  } catch (e: any) {
    console.error("Alter column error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
