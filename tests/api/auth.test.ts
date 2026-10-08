/**
 * Auth API: login, the profile lookup, and the account update.
 * Covers POST /api/auth/login, GET /api/auth/me, PUT /api/auth/account. Workflow: sign-in and the account page.
 * Fixtures: every seeded account (USERS), the TEST lab (LAB). The account tests rename Custodian B, the Lab Head,
 * and the Director, so they run after the login and profile tests.
 */
import { describe, expect, it } from "vitest";
import { LAB, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db } = useApiHarness();

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
    "answers the $user.role account's profile with role $role inside user",
    async ({ user, role, staffUnit }) => {
      const res = await api.get(`/api/auth/me?email=${encodeURIComponent(user.email)}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, user: { ...profileOf(user), role, staffUnit } });
    },
  );

  it("answers any account's profile from the email alone, with no session (known defect C-06)", async () => {
    const res = await api.get(`/api/auth/me?email=${encodeURIComponent(USERS.director.email)}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("AdRICDirector");
  });

  it("answers 400 without an email", async () => {
    const res = await api.get("/api/auth/me");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("answers 404 for an unknown email", async () => {
    const res = await api.get("/api/auth/me?email=nobody%40example.test");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("PUT /api/auth/account", () => {
  const userRow = (userId: number) => db.users.findUniqueOrThrow({ where: { user_id: userId } });
  const labLinks = (userId: number) => db.user_centers.findMany({ where: { user_id: userId } });

  it("saves the new first and last name and answers the updated profile", async () => {
    const res = await api.put("/api/auth/account", {
      email: USERS.custodianB.email,
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

  it("finds the account by email in any letter case", async () => {
    const res = await api.put("/api/auth/account", {
      email: USERS.custodianB.email.toUpperCase(),
      firstName: "Test",
      lastName: "Custodian B",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe(USERS.custodianB.userId);
    expect((await userRow(USERS.custodianB.userId)).first_name).toBe("Test");
  });

  it("saves the picture when one is sent and keeps it when none is sent", async () => {
    const picture = "data:image/png;base64,iVBORw0KGgo=";
    const withPicture = await api.put("/api/auth/account", {
      email: USERS.custodianB.email,
      firstName: "Test",
      lastName: "Custodian B",
      avatarUrl: picture,
    });
    const withoutPicture = await api.put("/api/auth/account", { email: USERS.custodianB.email, firstName: "Test", lastName: "Custodian B" });

    expect(withPicture.body.user).toMatchObject({ userImg: picture, profilePicture: picture, avatarUrl: picture });
    expect(withoutPicture.body.user.userImg).toBe(picture);
    expect((await userRow(USERS.custodianB.userId)).user_img).toBe(picture);
  });

  it("links an account with no lab to a known lab code", async () => {
    const res = await api.put("/api/auth/account", {
      email: USERS.director.email,
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

    const res = await api.put("/api/auth/account", {
      email: USERS.labHead.email,
      firstName: USERS.labHead.firstName,
      lastName: USERS.labHead.lastName,
      labAffiliation: "TESTB",
    });

    expect(res.status).toBe(200);
    const links = await labLinks(USERS.labHead.userId);
    expect(links.map((l) => l.center_id)).toEqual([otherLab.center_id]);
  });

  it("answers an unknown lab code as saved, but creates no lab and keeps the old link (new finding: MANILA_CAMPUS is not a valid location)", async () => {
    const res = await api.put("/api/auth/account", {
      email: USERS.custodianA.email,
      firstName: USERS.custodianA.firstName,
      lastName: USERS.custodianA.lastName,
      labAffiliation: "NOLAB",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.labAffiliation).toBe("NOLAB");
    expect(await db.research_centers.count({ where: { short_code: "NOLAB" } })).toBe(0);
    const links = await labLinks(USERS.custodianA.userId);
    expect(links.map((l) => l.center_id)).toEqual([LAB.centerId]);
  });

  it("answers labAffiliation CITe4D when no lab is sent, whatever the account's lab is (new finding)", async () => {
    const res = await api.put("/api/auth/account", {
      email: USERS.custodianA.email,
      firstName: USERS.custodianA.firstName,
      lastName: USERS.custodianA.lastName,
    });

    expect(res.status).toBe(200);
    expect(res.body.user.labAffiliation).toBe("CITe4D");
    const links = await labLinks(USERS.custodianA.userId);
    expect(links.map((l) => l.center_id)).toEqual([LAB.centerId]);
  });

  it("renames whichever account the body names, with no session (known defect C-02)", async () => {
    const res = await api.put("/api/auth/account", { email: USERS.admin.email, firstName: "Changed", lastName: "By Anyone" });

    expect(res.status).toBe(200);
    const row = await userRow(USERS.admin.userId);
    expect(`${row.first_name} ${row.last_name}`).toBe("Changed By Anyone");
  });

  it("answers 400 when the email, first name, or last name is missing", async () => {
    const full = { email: USERS.custodianA.email, firstName: "Test", lastName: "Custodian A" };
    for (const missing of ["email", "firstName", "lastName"] as const) {
      const body: Record<string, string> = { ...full };
      delete body[missing];
      const res = await api.put("/api/auth/account", body);
      expect(res.status, missing).toBe(400);
    }
  });

  it("answers 404 for an unknown email", async () => {
    const res = await api.put("/api/auth/account", { email: "nobody@example.test", firstName: "No", lastName: "Body" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
