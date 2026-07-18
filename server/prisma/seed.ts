// One-off local seed: creates the same named users the frontend's old localStorage
// mock used (see src/app/prismaClient.ts), so free-text-name lookups in server.ts
// (borrower/reporter/toCustodian) resolve to real users instead of falling back to
// DEFAULT_CUSTODIAN_ID. Insert order matters: user_id 1 must exist for that fallback.
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST || "localhost",
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "AdRIC_DB",
});
const prisma = new PrismaClient({ adapter });

const USERS: { first: string; last: string; email: string; password: string; idNumber: number; type: "STUDENT" | "FACULTY"; role: "ADMIN" | "TSG_STAFF" | "LAB_HEAD" | "CUSTODIAN" | "ADRIC_DIRECTOR" }[] = [
  { first: "ITS", last: "Admin", email: "its@dlsu.edu.ph", password: "its_password", idNumber: 11111111, type: "FACULTY", role: "ADMIN" },
  { first: "TSG", last: "Staff", email: "tsg@dlsu.edu.ph", password: "tsg_password", idNumber: 22222222, type: "FACULTY", role: "TSG_STAFF" },
  { first: "Dr. Juan", last: "Dela Cruz", email: "labhead@dlsu.edu.ph", password: "labhead_password", idNumber: 33333333, type: "FACULTY", role: "LAB_HEAD" },
  { first: "A.", last: "Dela Cruz", email: "custodian@dlsu.edu.ph", password: "custodian_password", idNumber: 44444444, type: "STUDENT", role: "CUSTODIAN" },
  { first: "Dr.", last: "Santos", email: "dr.santos@dlsu.edu.ph", password: "password123", idNumber: 55555555, type: "FACULTY", role: "CUSTODIAN" },
  { first: "A.", last: "Garcia", email: "a.garcia@dlsu.edu.ph", password: "password123", idNumber: 66666666, type: "FACULTY", role: "CUSTODIAN" },
  { first: "M.", last: "Tan", email: "m.tan@dlsu.edu.ph", password: "password123", idNumber: 77777777, type: "FACULTY", role: "CUSTODIAN" },
  { first: "J.", last: "Sy", email: "j.sy@dlsu.edu.ph", password: "password123", idNumber: 88888888, type: "FACULTY", role: "CUSTODIAN" },
  { first: "Felix", last: "Torres", email: "felix.torres@dlsu.edu.ph", password: "password123", idNumber: 99999999, type: "FACULTY", role: "CUSTODIAN" },
  { first: "T.", last: "Lim", email: "t.lim@dlsu.edu.ph", password: "password123", idNumber: 10101010, type: "FACULTY", role: "CUSTODIAN" },
  { first: "Dr. Elena", last: "Castro", email: "director@dlsu.edu.ph", password: "director_password", idNumber: 12121212, type: "FACULTY", role: "ADRIC_DIRECTOR" },
];

async function main() {
  for (const u of USERS) {
    const existing = await prisma.users.findUnique({ where: { email: u.email } });
    const user = existing ?? await prisma.users.create({
      data: {
        first_name: u.first,
        last_name: u.last,
        email: u.email,
        password: u.password,
        id_number: u.idNumber,
        user_type: u.type,
      },
    });

    const existingRole = await prisma.roles.findFirst({ where: { role_name: u.role } });
    const role = existingRole ?? await prisma.roles.create({ data: { role_name: u.role } });

    const existingUserRole = await prisma.user_roles.findFirst({ where: { user_id: user.user_id, role_id: role.role_id } });
    if (!existingUserRole) {
      await prisma.user_roles.create({ data: { user_id: user.user_id, role_id: role.role_id } });
    }

    console.log(`✅ ${u.email} -> user_id ${user.user_id}, role ${u.role}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
