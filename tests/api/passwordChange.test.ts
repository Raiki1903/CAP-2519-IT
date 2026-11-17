/**
 * Password change and reset: the IT Admin resets a user's password, and a user changes their own password.
 * Covers PUT /api/users/:userId/password and PUT /api/auth/password.
 * Workflow: authentication and account administration (Issue #186).
 * Fixtures: the seeded accounts (USERS), reset/re-seeded per test file by useApiHarness.
 */
import { describe, expect, it } from "vitest";
import { LAB, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, as, db } = useApiHarness();

const asAdmin = as(USERS.admin);
const asCustodianA = as(USERS.custodianA);
const asStaffTsg = as(USERS.staffTsg);
const asSecretary = as(USERS.secretary);
const asDirector = as(USERS.director);
const asLabHead = as(USERS.labHead);

describe("PUT /api/users/:userId/password (IT Admin reset)", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await api.put(`/api/users/${USERS.custodianA.userId}/password`, {
      newPassword: "new-password-123",
    });
    expect(res.status).toBe(401);
  });

  it.each([
    ["Staff TSG", asStaffTsg],
    ["Secretary", asSecretary],
    ["Director", asDirector],
    ["Lab Head", asLabHead],
    ["Researcher", asCustodianA],
  ])("rejects %s with 403", async (_, client) => {
    const res = await client.put(`/api/users/${USERS.custodianB.userId}/password`, {
      newPassword: "new-password-123",
    });
    expect(res.status).toBe(403);
  });

  it("refuses the IT Admin's own account with 400", async () => {
    const res = await asAdmin.put(`/api/users/${USERS.admin.userId}/password`, {
      newPassword: "new-admin-password",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("You can't change your own account here.");
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await asAdmin.put("/api/users/999999/password", {
      newPassword: "new-password-123",
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("No account has this id.");
  });

  it("returns 400 when the password is shorter than 8 characters", async () => {
    const res = await asAdmin.put(`/api/users/${USERS.custodianA.userId}/password`, {
      newPassword: "short",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Password must be at least 8 characters long.");
  });

  it("returns 400 when the password is longer than 128 characters", async () => {
    const res = await asAdmin.put(`/api/users/${USERS.custodianA.userId}/password`, {
      newPassword: "a".repeat(129),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Password must be at most 128 characters long.");
  });

  it("returns 409 for a pending account", async () => {
    const applicant = {
      firstName: "Pending",
      lastName: "User",
      email: "pending.reset.check@dlsu.edu.ph",
      idNumber: 95000001,
      userType: "STUDENT",
      centerIds: [LAB.centerId],
      password: "initial-password-123",
    };
    const signUp = await api.post("/api/auth/register-request", applicant);
    expect(signUp.status).toBe(201);

    const pendingList = await asAdmin.get("/api/users?status=PENDING");
    const pendingUser = pendingList.body.users.find((u: { email: string }) => u.email === applicant.email);
    expect(pendingUser).toBeDefined();

    const res = await asAdmin.put(`/api/users/${pendingUser.userId}/password`, {
      newPassword: "new-pending-password",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Only an active or deactivated account can get a new password.");
  });

  it("returns 409 for a rejected account", async () => {
    const applicant = {
      firstName: "Rejected",
      lastName: "User",
      email: "rejected.reset.check@dlsu.edu.ph",
      idNumber: 95000002,
      userType: "STUDENT",
      centerIds: [LAB.centerId],
      password: "initial-password-123",
    };
    await api.post("/api/auth/register-request", applicant);

    const pendingList = await asAdmin.get("/api/users?status=PENDING");
    const pendingUser = pendingList.body.users.find((u: { email: string }) => u.email === applicant.email);

    const rejectRes = await asAdmin.put(`/api/users/${pendingUser.userId}/reject`, { remarks: "Not eligible" });
    expect(rejectRes.status).toBe(200);

    const res = await asAdmin.put(`/api/users/${pendingUser.userId}/password`, {
      newPassword: "new-rejected-password",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Only an active or deactivated account can get a new password.");
  });

  it("returns 409 for an anonymized account", async () => {
    const applicant = {
      firstName: "Anon",
      lastName: "Target",
      email: "anon.target.check@dlsu.edu.ph",
      idNumber: 95000003,
      userType: "STUDENT",
      centerIds: [LAB.centerId],
      password: "initial-password-123",
    };
    await api.post("/api/auth/register-request", applicant);

    const pendingList = await asAdmin.get("/api/users?status=PENDING");
    const pendingUser = pendingList.body.users.find((u: { email: string }) => u.email === applicant.email);

    await asAdmin.put(`/api/users/${pendingUser.userId}/reject`, { remarks: "Reject to anonymize" });
    const anonRes = await asAdmin.put(`/api/users/${pendingUser.userId}/anonymize`);
    expect(anonRes.status).toBe(200);

    const res = await asAdmin.put(`/api/users/${pendingUser.userId}/password`, {
      newPassword: "new-anon-password",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Only an active or deactivated account can get a new password.");
  });

  it("resets an active user's password: old password fails, new password succeeds, and logs PASSWORD_CHANGED", async () => {
    const target = USERS.custodianA;
    const newPassword = "new-custodian-password-456";

    const resetRes = await asAdmin.put(`/api/users/${target.userId}/password`, { newPassword });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);
    expect(resetRes.body.user).toMatchObject({
      userId: target.userId,
      email: target.email,
      accountStatus: "ACTIVE",
    });
    expect(resetRes.body.user.password).toBeUndefined();

    const oldLogin = await api.post("/api/auth/login", {
      email: target.email,
      password: target.password,
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api.post("/api/auth/login", {
      email: target.email,
      password: newPassword,
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.success).toBe(true);

    const logRow = await db.activity_log.findFirst({
      where: {
        event_type: "PASSWORD_CHANGED",
        target_user_id: target.userId,
      },
      orderBy: { log_id: "desc" },
    });
    expect(logRow).not.toBeNull();
    expect(logRow!.actor_id).toBe(USERS.admin.userId);
    expect(logRow!.target_user_id).toBe(target.userId);
    expect(logRow!.details).toBe("Reset by the IT Admin");
  });

  it("can reset a deactivated user's password (user still cannot log in until reactivated)", async () => {
    const target = USERS.staffIts;
    const deactRes = await asAdmin.put(`/api/users/${target.userId}/deactivate`);
    expect(deactRes.status).toBe(200);

    const newPassword = "deactivated-reset-pass-789";
    const resetRes = await asAdmin.put(`/api/users/${target.userId}/password`, { newPassword });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.user.accountStatus).toBe("INACTIVE");

    const loginRes = await api.post("/api/auth/login", {
      email: target.email,
      password: newPassword,
    });
    expect(loginRes.status).toBe(403);

    const reactRes = await asAdmin.put(`/api/users/${target.userId}/reactivate`);
    expect(reactRes.status).toBe(200);

    const activeLogin = await api.post("/api/auth/login", {
      email: target.email,
      password: newPassword,
    });
    expect(activeLogin.status).toBe(200);
  });
});

describe("PUT /api/auth/password (change own password)", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await api.put("/api/auth/password", {
      currentPassword: "any-password-123",
      newPassword: "new-password-123",
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when currentPassword is empty or missing", async () => {
    const res = await asCustodianA.put("/api/auth/password", {
      currentPassword: "",
      newPassword: "valid-new-password-123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Enter your current password.");
  });

  it("returns 400 when currentPassword is wrong and changes nothing", async () => {
    const res = await asStaffTsg.put("/api/auth/password", {
      currentPassword: "wrong-current-password",
      newPassword: "new-staff-password-123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Your current password is not right.");

    const loginWithOld = await api.post("/api/auth/login", {
      email: USERS.staffTsg.email,
      password: USERS.staffTsg.password,
    });
    expect(loginWithOld.status).toBe(200);
  });

  it("returns 400 when newPassword is identical to currentPassword", async () => {
    const res = await asStaffTsg.put("/api/auth/password", {
      currentPassword: USERS.staffTsg.password,
      newPassword: USERS.staffTsg.password,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Choose a new password that is different from the current one.");
  });

  it("returns 400 when newPassword is shorter than 8 characters", async () => {
    const res = await asStaffTsg.put("/api/auth/password", {
      currentPassword: USERS.staffTsg.password,
      newPassword: "short",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Password must be at least 8 characters long.");
  });

  it("returns 400 when newPassword is longer than 128 characters", async () => {
    const res = await asStaffTsg.put("/api/auth/password", {
      currentPassword: USERS.staffTsg.password,
      newPassword: "b".repeat(129),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Password must be at most 128 characters long.");
  });

  it("successfully changes own password, rejects old login, and logs PASSWORD_CHANGED", async () => {
    const user = USERS.director;
    const client = asDirector;
    const newPassword = "new-director-password-456";

    const changeRes = await client.put("/api/auth/password", {
      currentPassword: user.password,
      newPassword,
    });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body).toEqual({ success: true });

    const oldLogin = await api.post("/api/auth/login", {
      email: user.email,
      password: user.password,
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api.post("/api/auth/login", {
      email: user.email,
      password: newPassword,
    });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.success).toBe(true);

    const logRow = await db.activity_log.findFirst({
      where: {
        event_type: "PASSWORD_CHANGED",
        actor_id: user.userId,
      },
      orderBy: { log_id: "desc" },
    });
    expect(logRow).not.toBeNull();
    expect(logRow!.actor_id).toBe(user.userId);
    expect(logRow!.target_user_id).toBe(user.userId);
    expect(logRow!.details).toBe("Changed by the user");
  });
});
