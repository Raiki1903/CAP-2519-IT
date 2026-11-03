/**
 * Auth API: login, the profile lookup, and the account update.
 * Covers POST /api/auth/login, GET /api/auth/me, PUT /api/auth/account. Workflow: sign-in and the account page.
 * Fixtures: every seeded account (USERS), the TEST lab (LAB). The account tests rename Custodian B, the Lab Head,
 * and the Director, so they run after the login and profile tests.
 */
import { describe, expect, it } from "vitest";
import { MAX_PASSWORD_LENGTH } from "../../shared/constants/passwords";
import { LAB, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, as } = useApiHarness();
const asCustodian = as(USERS.custodianA);

/** What login and /me answer for each seeded account today. */
const EXPECTED_ROLES: { user: TestUser; role: string; staffUnit: string | null }[] = [
  { user: USERS.admin, role: "ITAdmin", staffUnit: null },
  { user: USERS.secretary, role: "Staff", staffUnit: "ITS" },
  { user: USERS.staffIts, role: "Staff", staffUnit: "TSG" },
  { user: USERS.staffTsg, role: "Staff", staffUnit: "TSG" },
  { user: USERS.director, role: "AdRICDirector", staffUnit: null },
  { user: USERS.labHead, role: "LabHead", staffUnit: null },
  { user: USERS.custodianA, role: "Custodian", staffUnit: null },
];

/** The labs the server reports: every lab the account is linked to, and none ([]) for an account with no lab. */
const labsOf = (user: TestUser) => (user.inLab ? [{ centerId: LAB.centerId, code: LAB.shortCode, name: LAB.name, campus: LAB.location }] : []);

const profileOf = (user: TestUser) => ({
  userId: user.userId,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  idNumber: user.idNumber,
  userType: user.userType,
  labs: labsOf(user),
  headOf: user === USERS.labHead ? { centerId: LAB.centerId, code: LAB.shortCode } : null,
  accountStatus: "ACTIVE",
});

describe("POST /api/auth/login", () => {
  it.each(EXPECTED_ROLES)(
    "logs in the $user.role account with role $role, staff unit $staffUnit, and its profile",
    async ({ user, role, staffUnit }) => {
      const res = await api.post("/api/auth/login", { email: user.email, password: user.password });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, role, user: { ...profileOf(user), staffUnit } });
    },
  );

  it("maps a former ITS_STAFF account, moved to TSG_STAFF by the rename migration, to Staff with unit TSG", async () => {
    const res = await api.post("/api/auth/login", { email: USERS.staffIts.email, password: USERS.staffIts.password });

    expect(res.body.role).toBe("Staff");
    expect(res.body.user.staffUnit).toBe("TSG");
  });

  it("answers no lab, and no CITe4D default, for an account linked to no lab", async () => {
    const res = await api.post("/api/auth/login", { email: USERS.director.email, password: USERS.director.password });

    expect(res.body.user.labs).toEqual([]);
    expect(res.body.user).not.toHaveProperty("labAffiliation");
  });

  it("lists every lab of an account in two labs, and the lab it heads", async () => {
    const second = await db.research_centers.create({ data: { name: "Test Second Lab", short_code: "TESTB2", location: "LAGUNA" } });
    await db.user_centers.create({ data: { user_id: USERS.labHead.userId, center_id: second.center_id } });
    try {
      const res = await api.post("/api/auth/login", { email: USERS.labHead.email, password: USERS.labHead.password });

      expect(res.body.user.labs.map((l: { code: string }) => l.code)).toEqual([LAB.shortCode, "TESTB2"]);
      expect(res.body.user.headOf).toEqual({ centerId: LAB.centerId, code: LAB.shortCode });
    } finally {
      await db.user_centers.deleteMany({ where: { center_id: second.center_id } });
      await db.research_centers.delete({ where: { center_id: second.center_id } });
    }
  });

  it.each(["PENDING", "INACTIVE", "REJECTED"] as const)("answers 403 for a %s account with the right password, and sets no cookie", async (status) => {
    await db.users.update({ where: { user_id: USERS.custodianB.userId }, data: { account_status: status } });
    try {
      const res = await api.post("/api/auth/login", { email: USERS.custodianB.email, password: USERS.custodianB.password });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ success: false, error: "This account is not active. Contact the IT Admin." });
    } finally {
      await db.users.update({ where: { user_id: USERS.custodianB.userId }, data: { account_status: "ACTIVE" } });
    }
  });

  it("answers 400 when the email or the password is missing", async () => {
    const noEmail = await api.post("/api/auth/login", { password: USERS.custodianA.password });
    const noPassword = await api.post("/api/auth/login", { email: USERS.custodianA.email });

    expect(noEmail.status).toBe(400);
    expect(noPassword.status).toBe(400);
    expect(noEmail.body.success).toBe(false);
  });

  describe("wrong credentials", () => {
    const LOGIN_REFUSED = { success: false, error: "Invalid institutional email address or password." };

    it("answers the same 401 body for a wrong password and for an unknown email", async () => {
      const wrongPassword = await api.post("/api/auth/login", { email: USERS.custodianA.email, password: "not-the-password" });
      const unknownEmail = await api.post("/api/auth/login", { email: "nobody@example.test", password: USERS.custodianA.password });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(LOGIN_REFUSED);
      expect(unknownEmail.body).toEqual(LOGIN_REFUSED);
    });

    it("refuses the right password in a different letter case (C-03 fixed)", async () => {
      const res = await api.post("/api/auth/login", {
        email: USERS.custodianA.email,
        password: USERS.custodianA.password.toUpperCase(),
      });

      expect(res.status).toBe(401);
      expect(res.body).toEqual(LOGIN_REFUSED);
    });

    it("answers the same 401 body for a password over the longest allowed, with a known or an unknown email", async () => {
      const tooLong = "x".repeat(MAX_PASSWORD_LENGTH + 1);

      for (const email of [USERS.custodianA.email, "nobody@example.test"]) {
        const res = await api.post("/api/auth/login", { email, password: tooLong });

        expect(res.status, email).toBe(401);
        expect(res.body, email).toEqual(LOGIN_REFUSED);
      }
    });

    it("answers the same 401 body for a password that is not a string", async () => {
      for (const password of [12345678, { contains: "a" }, [USERS.custodianA.password], true]) {
        const res = await api.post("/api/auth/login", { email: USERS.custodianA.email, password });

        expect(res.status, JSON.stringify(password)).toBe(401);
        expect(res.body, JSON.stringify(password)).toEqual(LOGIN_REFUSED);
      }
    });

    it("refuses an account whose password is still plain text: there is no fallback", async () => {
      const plain = "test-password-still-plain";
      const row = await db.users.create({
        data: { first_name: "Test", last_name: "Plain Row", email: "plain.row@example.test", password: plain, id_number: 90009998, user_type: "STUDENT" },
      });
      try {
        const res = await api.post("/api/auth/login", { email: row.email, password: plain });

        expect(res.status).toBe(401);
        expect(res.body).toEqual(LOGIN_REFUSED);
      } finally {
        await db.users.delete({ where: { user_id: row.user_id } });
      }
    });

    it("refuses the stored hash typed as the password", async () => {
      const { password: storedHash } = await db.users.findUniqueOrThrow({ where: { user_id: USERS.custodianA.userId } });

      const res = await api.post("/api/auth/login", { email: USERS.custodianA.email, password: storedHash });

      expect(res.status).toBe(401);
    });
  });

  it("trims spaces around the email", async () => {
    const res = await api.post("/api/auth/login", { email: `  ${USERS.custodianA.email}  `, password: USERS.custodianA.password });

    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  it.each(EXPECTED_ROLES)(
    "answers the $user.role account's own profile with role $role inside user",
    async ({ user, role, staffUnit }) => {
      const res = await as(user).get("/api/auth/me");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, user: { ...profileOf(user), role, staffUnit, roleLabel: role === "Custodian" ? "Researcher" : expect.any(String) } });
    },
  );

  it("ignores ?email= and answers the caller's own profile (C-06 fixed)", async () => {
    for (const email of [USERS.director.email, "nobody@example.test"]) {
      const res = await asCustodian.get(`/api/auth/me?email=${encodeURIComponent(email)}`);

      expect(res.status, email).toBe(200);
      expect(res.body.user, email).toMatchObject({ userId: USERS.custodianA.userId, email: USERS.custodianA.email, role: "Custodian" });
    }
  });

  it("needs no email", async () => {
    const res = await asCustodian.get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe(USERS.custodianA.userId);
  });
});

describe("PUT /api/auth/account", () => {
  const userRow = (userId: number) => db.users.findUniqueOrThrow({ where: { user_id: userId } });
  const labLinks = (userId: number) => db.user_centers.findMany({ where: { user_id: userId } });

  it("saves the new first and last name of the caller's own account and answers the updated profile", async () => {
    const res = await as(USERS.custodianB).put("/api/auth/account", {
      firstName: "  Renamed  ",
      lastName: "Custodian B",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      user: { userId: USERS.custodianB.userId, firstName: "Renamed", lastName: "Custodian B", email: USERS.custodianB.email, labs: labsOf(USERS.custodianB) },
    });
    const row = await userRow(USERS.custodianB.userId);
    expect(row.first_name).toBe("Renamed");
    expect(row.last_name).toBe("Custodian B");
  });

  it("saves the picture when one is sent and keeps it when none is sent", async () => {
    const picture = "data:image/png;base64,iVBORw0KGgo=";
    const asCustodianB = as(USERS.custodianB);
    const withPicture = await asCustodianB.put("/api/auth/account", {
      firstName: "Test",
      lastName: "Custodian B",
      avatarUrl: picture,
    });
    const withoutPicture = await asCustodianB.put("/api/auth/account", { firstName: "Test", lastName: "Custodian B" });

    expect(withPicture.body.user).toMatchObject({ userImg: picture, profilePicture: picture, avatarUrl: picture });
    expect(withoutPicture.body.user.userImg).toBe(picture);
    expect((await userRow(USERS.custodianB.userId)).user_img).toBe(picture);
  });

  it("refuses a lab for an account with no lab, and links none (issue #73)", async () => {
    const res = await as(USERS.director).put("/api/auth/account", {
      firstName: USERS.director.firstName,
      lastName: USERS.director.lastName,
      labAffiliation: LAB.shortCode,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Your lab can't be changed here.");
    expect(await labLinks(USERS.director.userId)).toEqual([]);
  });

  it("refuses a Lab Head moving to another known lab: 400, the lab and the name kept (issue #73)", async () => {
    const otherLab = await db.research_centers.create({ data: { name: "Test Other Lab", short_code: "TESTB", location: "LAGUNA" } });
    try {
      const res = await as(USERS.labHead).put("/api/auth/account", {
        firstName: "Moved",
        lastName: USERS.labHead.lastName,
        labAffiliation: "TESTB",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Your lab can't be changed here.");
      const links = await labLinks(USERS.labHead.userId);
      expect(links.map((l) => l.center_id)).toEqual([LAB.centerId]);
      expect((await userRow(USERS.labHead.userId)).first_name).toBe(USERS.labHead.firstName);
    } finally {
      await db.research_centers.delete({ where: { center_id: otherLab.center_id } });
    }
  });

  it("answers 400 for an unknown lab code too and saves nothing, the name included, and creates no lab (issue #73)", async () => {
    const res = await asCustodian.put("/api/auth/account", {
      firstName: "Not Saved",
      lastName: USERS.custodianA.lastName,
      labAffiliation: "NOLAB",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Your lab can't be changed here.");
    expect(await db.research_centers.count({ where: { short_code: "NOLAB" } })).toBe(0);
    const links = await labLinks(USERS.custodianA.userId);
    expect(links.map((l) => l.center_id)).toEqual([LAB.centerId]);
    expect((await userRow(USERS.custodianA.userId)).first_name).toBe(USERS.custodianA.firstName);
  });

  it("answers the account's own lab when no lab is sent, and keeps it (issue #73)", async () => {
    const res = await asCustodian.put("/api/auth/account", {
      firstName: USERS.custodianA.firstName,
      lastName: USERS.custodianA.lastName,
    });

    expect(res.status).toBe(200);
    expect(res.body.user.labs).toEqual(labsOf(USERS.custodianA));
    const links = await labLinks(USERS.custodianA.userId);
    expect(links.map((l) => l.center_id)).toEqual([LAB.centerId]);
  });

  it("answers the same lab as GET /api/auth/me, for an account with a lab and one without (issue #73)", async () => {
    for (const user of [USERS.custodianB, USERS.staffTsg]) {
      const res = await as(user).put("/api/auth/account", { firstName: user.firstName, lastName: user.lastName });
      const me = await as(user).get("/api/auth/me");

      expect(res.status).toBe(200);
      expect(res.body.user.labs, user.role).toEqual(me.body.user.labs);
    }
    expect(await labLinks(USERS.staffTsg.userId)).toEqual([]);
  });

  it("changes only the caller's account, whatever email the body names (C-02 and C-06 fixed)", async () => {
    const adminBefore = await userRow(USERS.admin.userId);

    const res = await asCustodian.put("/api/auth/account", { email: USERS.admin.email, firstName: "Changed", lastName: "By Body Email" });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ userId: USERS.custodianA.userId, email: USERS.custodianA.email });
    const admin = await userRow(USERS.admin.userId);
    expect(`${admin.first_name} ${admin.last_name}`).toBe(`${adminBefore.first_name} ${adminBefore.last_name}`);
    const own = await userRow(USERS.custodianA.userId);
    expect(`${own.first_name} ${own.last_name}`).toBe("Changed By Body Email");

    await asCustodian.put("/api/auth/account", { firstName: USERS.custodianA.firstName, lastName: USERS.custodianA.lastName });
  });

  it("answers 400 when the first name or last name is missing", async () => {
    const full = { firstName: "Test", lastName: "Custodian A" };
    for (const missing of ["firstName", "lastName"] as const) {
      const body: Record<string, string> = { ...full };
      delete body[missing];
      const res = await asCustodian.put("/api/auth/account", body);
      expect(res.status, missing).toBe(400);
    }
  });
});
