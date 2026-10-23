/**
 * Auth API: login, the profile lookup, and the account update.
 * Covers POST /api/auth/login, GET /api/auth/me, PUT /api/auth/account. Workflow: sign-in and the account page.
 * Fixtures: every seeded account (USERS), the TEST lab (LAB). The account tests rename Custodian B, the Lab Head,
 * and the Director, so they run after the login and profile tests.
 */
import { describe, expect, it } from "vitest";
import { LAB, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, as } = useApiHarness();
const asCustodian = as(USERS.custodianA);

/** What login and /me answer for each seeded account today. */
const EXPECTED_ROLES: { user: TestUser; role: string; staffUnit: string | null }[] = [
  { user: USERS.admin, role: "Staff", staffUnit: "ITS" },
  { user: USERS.secretary, role: "Staff", staffUnit: "ITS" },
  { user: USERS.staffIts, role: "Staff", staffUnit: "ITS" },
  { user: USERS.staffTsg, role: "Staff", staffUnit: "TSG" },
  { user: USERS.director, role: "AdRICDirector", staffUnit: null },
  { user: USERS.labHead, role: "LabHead", staffUnit: null },
  { user: USERS.custodianA, role: "Custodian", staffUnit: null },
];

/** The lab the server reports: the account's lab code, or CITe4D for an account with no lab. */
const labOf = (user: TestUser) => (user.inLab ? LAB.shortCode : "CITe4D");

const profileOf = (user: TestUser) => ({
  userId: user.userId,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  idNumber: user.idNumber,
  userType: user.userType,
  labAffiliation: labOf(user),
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

  it("maps ITS_STAFF to Staff with unit ITS (M-11, the Phase 2 check the team asked for)", async () => {
    const res = await api.post("/api/auth/login", { email: USERS.staffIts.email, password: USERS.staffIts.password });

    expect(res.body.role).toBe("Staff");
    expect(res.body.user.staffUnit).toBe("ITS");
  });

  it("answers labAffiliation CITe4D for an account linked to no lab", async () => {
    const res = await api.post("/api/auth/login", { email: USERS.director.email, password: USERS.director.password });

    expect(res.body.user.labAffiliation).toBe("CITe4D");
  });

  it("answers 400 when the email or the password is missing", async () => {
    const noEmail = await api.post("/api/auth/login", { password: USERS.custodianA.password });
    const noPassword = await api.post("/api/auth/login", { email: USERS.custodianA.email });

    expect(noEmail.status).toBe(400);
    expect(noPassword.status).toBe(400);
    expect(noEmail.body.success).toBe(false);
  });

  it("answers 401 for a wrong password and for an unknown email", async () => {
    const wrongPassword = await api.post("/api/auth/login", { email: USERS.custodianA.email, password: "not-the-password" });
    const unknownEmail = await api.post("/api/auth/login", { email: "nobody@example.test", password: USERS.custodianA.password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.success).toBe(false);
  });

  it("logs in with the password in a different letter case (known defect C-03)", async () => {
    const res = await api.post("/api/auth/login", {
      email: USERS.custodianA.email,
      password: USERS.custodianA.password.toUpperCase(),
    });

    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe(USERS.custodianA.userId);
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
      expect(res.body).toMatchObject({ success: true, user: { ...profileOf(user), role, staffUnit } });
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
      labAffiliation: LAB.shortCode,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      user: { userId: USERS.custodianB.userId, firstName: "Renamed", lastName: "Custodian B", email: USERS.custodianB.email, labAffiliation: LAB.shortCode },
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

  it("links an account with no lab to a known lab code", async () => {
    const res = await as(USERS.director).put("/api/auth/account", {
      firstName: USERS.director.firstName,
      lastName: USERS.director.lastName,
      labAffiliation: LAB.shortCode,
    });

    expect(res.status).toBe(200);
    const links = await labLinks(USERS.director.userId);
    expect(links.map((l) => l.center_id)).toEqual([LAB.centerId]);
  });

  it("moves an account's existing lab link to another known lab code, without adding a second link", async () => {
    const otherLab = await db.research_centers.create({ data: { name: "Test Other Lab", short_code: "TESTB", location: "LAGUNA" } });

    const res = await as(USERS.labHead).put("/api/auth/account", {
      firstName: USERS.labHead.firstName,
      lastName: USERS.labHead.lastName,
      labAffiliation: "TESTB",
    });

    expect(res.status).toBe(200);
    const links = await labLinks(USERS.labHead.userId);
    expect(links.map((l) => l.center_id)).toEqual([otherLab.center_id]);
  });

  it("answers 400 for an unknown lab code and saves nothing, the name included, and creates no lab (issue #73)", async () => {
    const res = await asCustodian.put("/api/auth/account", {
      firstName: "Not Saved",
      lastName: USERS.custodianA.lastName,
      labAffiliation: "NOLAB",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Unknown lab: NOLAB.");
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
    expect(res.body.user.labAffiliation).toBe(LAB.shortCode);
    const links = await labLinks(USERS.custodianA.userId);
    expect(links.map((l) => l.center_id)).toEqual([LAB.centerId]);
  });

  it("answers the same lab as GET /api/auth/me, for an account with a lab and one without (issue #73)", async () => {
    for (const user of [USERS.custodianB, USERS.staffTsg]) {
      const res = await as(user).put("/api/auth/account", { firstName: user.firstName, lastName: user.lastName });
      const me = await as(user).get("/api/auth/me");

      expect(res.status).toBe(200);
      expect(res.body.user.labAffiliation, user.role).toBe(me.body.user.labAffiliation);
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
