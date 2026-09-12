import { prisma } from "../prisma";

async function main() {
  try {
    const testImgUrl = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150";

    console.log("1. Executing Prisma update on user_id 14...");
    const updated = await prisma.users.update({
      where: { user_id: 14 },
      data: { user_img: testImgUrl }
    });
    console.log("Updated user from Prisma return:", updated);

    console.log("2. Fetching user 14 back from database...");
    const fetched: any = await prisma.users.findUnique({ where: { user_id: 14 } });
    console.log("Fetched user_img value:", fetched?.user_img);
  } catch (e: any) {
    console.error("Test error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
