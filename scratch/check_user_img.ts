import { prisma } from "../prisma";

async function main() {
  try {
    const user: any = await prisma.users.findUnique({ where: { user_id: 14 } });
    console.log("Database user_id 14 user_img field value:", user?.user_img);
  } catch (e: any) {
    console.error("Fetch user error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
