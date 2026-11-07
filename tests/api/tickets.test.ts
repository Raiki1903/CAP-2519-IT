/**
 * System-support tickets (module 6): filing one, a person's own tickets, the IT Admin's list, and status changes.
 * Covers POST /api/tickets, GET /api/tickets/mine, GET /api/tickets, and PUT /api/tickets/:ticketId/status.
 * Workflow: help tickets to the IT Admin.
 * Fixtures: the seeded accounts. Each test files the tickets it reads through the API, or writes them straight into
 * the database when it needs a status no route has set yet.
 */
import { describe, expect, it } from "vitest";
import { USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, as } = useApiHarness();
const asItAdmin = as(USERS.admin);
const FORBIDDEN = "Your role is not allowed to do this.";

let ticketCount = 0;

/** Files a ticket as this person through the API, and answers it. */
async function fileTicket(user: TestUser, extra: Record<string, unknown> = {}) {
  ticketCount += 1;
  const res = await as(user).post("/api/tickets", { type: "QUESTION", title: `Test ticket ${ticketCount}`, description: "Test: how do I do this?", ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.ticket;
}

describe("POST /api/tickets", () => {
  it("files an Open ticket for the session's account, trimmed, with labels, and writes no log row", async () => {
    await as(USERS.custodianA).get("/api/tickets/mine");
    const logRowsBefore = await db.activity_log.count();

    const res = await as(USERS.custodianA).post("/api/tickets", {
      type: "ACCOUNT_ACCESS", title: "  Test: cannot see my lab  ", description: "  Test: the lab list is empty.  ", createdById: USERS.director.userId,
    });

    expect(res.status).toBe(201);
    expect(res.body.ticket).toEqual({
      ticketId: expect.any(Number),
      createdBy: { userId: USERS.custodianA.userId, name: USERS.custodianA.fullName },
      type: "ACCOUNT_ACCESS",
      typeLabel: "Account Access",
      title: "Test: cannot see my lab",
      description: "Test: the lab list is empty.",
      status: "OPEN",
      statusLabel: "Open",
      resolutionRemarks: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(await db.activity_log.count()).toBe(logRowsBefore);
  });

  it("takes a title of 150 characters and a description of 2000", async () => {
    const ticket = await fileTicket(USERS.custodianB, { title: "t".repeat(150), description: "d".repeat(2000) });

    expect(ticket.title).toHaveLength(150);
    expect(ticket.description).toHaveLength(2000);
  });

  it.each([
    ["an unknown type", { type: "HARDWARE" }, "Choose a ticket type: Bug, Account Access, Question, or Other."],
    ["no type", { type: undefined }, "Choose a ticket type: Bug, Account Access, Question, or Other."],
    ["no title", { title: undefined }, "Write a title of 1 to 150 characters."],
    ["a blank title", { title: "   " }, "Write a title of 1 to 150 characters."],
    ["a title of 151 characters", { title: "t".repeat(151) }, "Write a title of 1 to 150 characters."],
    ["a title that is not text", { title: 42 }, "Write a title of 1 to 150 characters."],
    ["no description", { description: undefined }, "Write a description of 1 to 2000 characters."],
    ["a blank description", { description: " \n " }, "Write a description of 1 to 2000 characters."],
    ["a description of 2001 characters", { description: "d".repeat(2001) }, "Write a description of 1 to 2000 characters."],
  ])("answers 400 for %s, and files nothing", async (_label, change, message) => {
    const before = await db.user_tickets.count();

    const res = await as(USERS.custodianA).post("/api/tickets", { type: "BUG", title: "Test title", description: "Test description", ...change });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
    expect(await db.user_tickets.count()).toBe(before);
  });
});

describe("GET /api/tickets/mine", () => {
  it("shows only the person's own tickets, newest first", async () => {
    const older = await fileTicket(USERS.staffIts);
    const newer = await fileTicket(USERS.staffIts, { type: "BUG" });
    const someoneElses = await fileTicket(USERS.secretary);

    const res = await as(USERS.staffIts).get("/api/tickets/mine");

    expect(res.status).toBe(200);
    const ids = res.body.tickets.map((t: { ticketId: number }) => t.ticketId);
    expect(ids).toEqual([newer.ticketId, older.ticketId]);
    expect(ids).not.toContain(someoneElses.ticketId);
    expect(JSON.stringify(res.body)).not.toContain("@");
  });

  it("shows the IT Admin's answer once a ticket is resolved", async () => {
    const ticket = await fileTicket(USERS.director);
    await db.user_tickets.update({
      where: { ticket_id: ticket.ticketId },
      data: { status: "RESOLVED", resolution_remarks: "Test: done.", resolved_by_id: USERS.admin.userId, resolved_at: new Date() },
    });

    const res = await as(USERS.director).get("/api/tickets/mine");

    expect(res.body.tickets.find((t: { ticketId: number }) => t.ticketId === ticket.ticketId)).toMatchObject({
      status: "RESOLVED", statusLabel: "Resolved", resolutionRemarks: "Test: done.", resolvedBy: { userId: USERS.admin.userId, name: USERS.admin.fullName }, resolvedAt: expect.any(String),
    });
  });
});

describe("GET /api/tickets", () => {
  it("lists every ticket for the IT Admin, newest first, filtered by status and type", async () => {
    const bug = await fileTicket(USERS.labHead, { type: "BUG" });
    const other = await fileTicket(USERS.custodianB, { type: "OTHER" });
    await db.user_tickets.update({ where: { ticket_id: other.ticketId }, data: { status: "IN_PROGRESS" } });

    const all = await asItAdmin.get("/api/tickets");
    const bugs = await asItAdmin.get("/api/tickets?type=BUG");
    const inProgress = await asItAdmin.get("/api/tickets?status=IN_PROGRESS");
    const openOther = await asItAdmin.get("/api/tickets?status=OPEN&type=OTHER");

    expect(all.status).toBe(200);
    const allIds = all.body.tickets.map((t: { ticketId: number }) => t.ticketId);
    expect(allIds.indexOf(other.ticketId)).toBeLessThan(allIds.indexOf(bug.ticketId));
    expect(allIds).toHaveLength(await db.user_tickets.count());
    expect(bugs.body.tickets.every((t: { type: string }) => t.type === "BUG")).toBe(true);
    expect(bugs.body.tickets.map((t: { ticketId: number }) => t.ticketId)).toContain(bug.ticketId);
    expect(inProgress.body.tickets.map((t: { ticketId: number }) => t.ticketId)).toEqual([other.ticketId]);
    expect(openOther.body.tickets).toEqual([]);
  });

  it.each([
    ["?status=CLOSED", "Choose a ticket status: OPEN, IN_PROGRESS, RESOLVED, or REJECTED."],
    ["?type=bug", "Choose a ticket type: Bug, Account Access, Question, or Other."],
    ["?status=OPEN&status=RESOLVED", 'Send the filter "status" once.'],
    ["?createdBy=6", 'Unknown filter "createdBy". Use status or type.'],
  ])("answers 400 for the query %j", async (query, message) => {
    const res = await asItAdmin.get(`/api/tickets${query}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
  });
});

describe("PUT /api/tickets/:ticketId/status", () => {
  const REMARKS = "Test: fixed in the settings.";
  const change = (ticketId: number, body: unknown) => asItAdmin.put(`/api/tickets/${ticketId}/status`, body);
  const bodyFor = (status: string) => (status === "RESOLVED" || status === "REJECTED" ? { status, resolutionRemarks: REMARKS } : { status });
  const logRowsFor = (ticketId: number) =>
    db.activity_log.findMany({ where: { event_type: "TICKET_STATUS_CHANGED", details: { startsWith: `#${ticketId} ` } }, orderBy: { log_id: "asc" } });

  /** A ticket by Custodian A, already in this status. */
  async function ticketIn(status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED") {
    const ticket = await fileTicket(USERS.custodianA);
    if (status !== "OPEN") await db.user_tickets.update({ where: { ticket_id: ticket.ticketId }, data: { status } });
    return ticket.ticketId as number;
  }

  it("moves an Open ticket to In Progress, with no resolver, and writes TICKET_STATUS_CHANGED to its creator", async () => {
    const ticketId = await ticketIn("OPEN");

    const res = await change(ticketId, { status: "IN_PROGRESS" });

    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ ticketId, status: "IN_PROGRESS", statusLabel: "In Progress", resolutionRemarks: null, resolvedBy: null, resolvedAt: null });
    expect(await logRowsFor(ticketId)).toMatchObject([
      { actor_id: USERS.admin.userId, target_user_id: USERS.custodianA.userId, details: `#${ticketId} OPEN to IN_PROGRESS` },
    ]);
  });

  it.each([
    ["OPEN", "RESOLVED"],
    ["OPEN", "REJECTED"],
    ["IN_PROGRESS", "RESOLVED"],
    ["IN_PROGRESS", "REJECTED"],
  ] as const)("moves a ticket from %s to %s, with the trimmed remarks, the IT Admin as resolver, and the time", async (from, to) => {
    const ticketId = await ticketIn(from);

    const res = await change(ticketId, { status: to, resolutionRemarks: `  ${REMARKS}  ` });

    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({ status: to, resolutionRemarks: REMARKS, resolvedBy: { userId: USERS.admin.userId, name: USERS.admin.fullName } });
    const row = await db.user_tickets.findUniqueOrThrow({ where: { ticket_id: ticketId } });
    expect(row).toMatchObject({ status: to, resolution_remarks: REMARKS, resolved_by_id: USERS.admin.userId });
    expect(row.resolved_at).toBeInstanceOf(Date);
    expect((await logRowsFor(ticketId)).map((r) => r.details)).toEqual([`#${ticketId} ${from} to ${to}`]);
  });

  it.each([
    ["OPEN", "OPEN"],
    ["IN_PROGRESS", "OPEN"],
    ["IN_PROGRESS", "IN_PROGRESS"],
    ["RESOLVED", "OPEN"],
    ["RESOLVED", "IN_PROGRESS"],
    ["RESOLVED", "RESOLVED"],
    ["RESOLVED", "REJECTED"],
    ["REJECTED", "OPEN"],
    ["REJECTED", "IN_PROGRESS"],
    ["REJECTED", "RESOLVED"],
    ["REJECTED", "REJECTED"],
  ] as const)("answers 409 for %s to %s, and changes nothing", async (from, to) => {
    const ticketId = await ticketIn(from);

    const res = await change(ticketId, bodyFor(to));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/^A ticket that is .+ can't be moved to .+\.$/);
    expect((await db.user_tickets.findUniqueOrThrow({ where: { ticket_id: ticketId } })).status).toBe(from);
    expect(await logRowsFor(ticketId)).toEqual([]);
  });

  it.each([
    ["no remarks for Resolved", { status: "RESOLVED" }, "Write resolution remarks of 1 to 1000 characters."],
    ["blank remarks for Rejected", { status: "REJECTED", resolutionRemarks: "   " }, "Write resolution remarks of 1 to 1000 characters."],
    ["remarks of 1001 characters", { status: "RESOLVED", resolutionRemarks: "r".repeat(1001) }, "Write resolution remarks of 1 to 1000 characters."],
    ["remarks that are not text", { status: "RESOLVED", resolutionRemarks: 42 }, "Resolution remarks must be text."],
    ["remarks for In Progress", { status: "IN_PROGRESS", resolutionRemarks: "Test: looking" }, "Resolution remarks are only for Resolved or Rejected."],
    ["an unknown status", { status: "CLOSED" }, "Choose a ticket status: OPEN, IN_PROGRESS, RESOLVED, or REJECTED."],
  ])("answers 400 for %s, and the ticket stays Open", async (_label, body, message) => {
    const ticketId = await ticketIn("OPEN");

    const res = await change(ticketId, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
    expect((await db.user_tickets.findUniqueOrThrow({ where: { ticket_id: ticketId } })).status).toBe("OPEN");
  });

  it("takes remarks of 1000 characters", async () => {
    const ticketId = await ticketIn("OPEN");

    expect((await change(ticketId, { status: "RESOLVED", resolutionRemarks: "r".repeat(1000) })).status).toBe(200);
  });

  it("answers 404 for no such ticket, and 400 for an id that is not a number", async () => {
    const missing = await change(999999, { status: "IN_PROGRESS" });
    const notANumber = await asItAdmin.put("/api/tickets/abc/status", { status: "IN_PROGRESS" });

    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: "No ticket has this id." });
    expect(notANumber.status).toBe(400);
  });

  it("changes once when two status changes are sent at once: one 200, one 409, one log row", async () => {
    const ticketId = await ticketIn("OPEN");

    const answers = await Promise.all([
      change(ticketId, { status: "RESOLVED", resolutionRemarks: REMARKS }),
      change(ticketId, { status: "REJECTED", resolutionRemarks: REMARKS }),
    ]);

    expect(answers.map((a) => a.status).sort()).toEqual([200, 409]);
    const winner = answers.find((a) => a.status === 200)!.body.ticket.status;
    expect((await db.user_tickets.findUniqueOrThrow({ where: { ticket_id: ticketId } })).status).toBe(winner);
    expect(await logRowsFor(ticketId)).toHaveLength(1);
  });

  it("shows the creator the IT Admin's answer in their own tickets", async () => {
    const ticketId = await ticketIn("OPEN");
    await change(ticketId, { status: "REJECTED", resolutionRemarks: "Test: this is an asset problem. Report it through Maintenance." });

    const mine = await as(USERS.custodianA).get("/api/tickets/mine");

    expect(mine.body.tickets.find((t: { ticketId: number }) => t.ticketId === ticketId)).toMatchObject({
      status: "REJECTED", resolutionRemarks: "Test: this is an asset problem. Report it through Maintenance.", resolvedBy: { userId: USERS.admin.userId },
    });
  });
});

describe("who may use the ticket endpoints", () => {
  it("answers 401 to every route with no session", async () => {
    expect((await api.post("/api/tickets", { type: "BUG", title: "Test", description: "Test" })).status).toBe(401);
    expect((await api.get("/api/tickets/mine")).status).toBe(401);
    expect((await api.get("/api/tickets")).status).toBe(401);
    expect((await api.put("/api/tickets/1/status", { status: "IN_PROGRESS" })).status).toBe(401);
  });

  it.each([USERS.admin, USERS.staffTsg, USERS.secretary, USERS.director, USERS.labHead, USERS.custodianA])(
    "lets $lastName file a ticket and read their own",
    async (user) => {
      await fileTicket(user);

      expect((await as(user).get("/api/tickets/mine")).status).toBe(200);
    },
  );

  it.each([USERS.staffTsg, USERS.secretary, USERS.director, USERS.labHead, USERS.custodianA])(
    "answers 403 to $lastName on the IT Admin's list and status change, and the ticket stays Open",
    async (user) => {
      const ticket = await fileTicket(user);

      for (const res of [await as(user).get("/api/tickets"), await as(user).put(`/api/tickets/${ticket.ticketId}/status`, { status: "IN_PROGRESS" })]) {
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ success: false, error: FORBIDDEN });
      }
      expect((await db.user_tickets.findUniqueOrThrow({ where: { ticket_id: ticket.ticketId } })).status).toBe("OPEN");
    },
  );
});
