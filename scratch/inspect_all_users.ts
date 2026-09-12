import { prisma } from "../prisma";

async function main() {
  try {
    const allUsers: any[] = await prisma.users.findMany();
    console.log("ALL USERS IN DATABASE:");
    for (const u of allUsers) {
      console.log(`ID: ${u.user_id} | Email: ${u.email} | Name: ${u.first_name} ${u.last_name} | user_img: ${u.user_img}`);
    }
  } catch (e: any) {
    console.error("Inspect users error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
