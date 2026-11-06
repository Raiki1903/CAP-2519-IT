/**
 * System-support tickets (module 6): filing one, a person's own tickets, and the IT Admin's list.
 * Covers POST /api/tickets, GET /api/tickets/mine, and GET /api/tickets. Workflow: help tickets to the IT Admin.
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

describe("who may use the ticket endpoints", () => {
  it("answers 401 to every route with no session", async () => {
    expect((await api.post("/api/tickets", { type: "BUG", title: "Test", description: "Test" })).status).toBe(401);
    expect((await api.get("/api/tickets/mine")).status).toBe(401);
    expect((await api.get("/api/tickets")).status).toBe(401);
  });

  it.each([USERS.admin, USERS.staffTsg, USERS.secretary, USERS.director, USERS.labHead, USERS.custodianA])(
    "lets $lastName file a ticket and read their own",
    async (user) => {
      await fileTicket(user);

      expect((await as(user).get("/api/tickets/mine")).status).toBe(200);
    },
  );

  it.each([USERS.staffTsg, USERS.secretary, USERS.director, USERS.labHead, USERS.custodianA])("answers 403 to $lastName on the IT Admin's list", async (user) => {
    const res = await as(user).get("/api/tickets");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: FORBIDDEN });
  });
});
