/**
 * The IT Admin's read of the activity log (module 6): filters, days, paging, and the entry shape.
 * Covers GET /api/activity-log. Workflow: the activity log.
 * Fixtures: the seeded accounts and assets. Each test writes the log rows it reads straight into the database, with
 * an event type and actor no other test here uses, so logins made by the tests do not change what it counts.
 */
import type { activity_log_event_type } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { ASSETS, USERS } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";

const { api, db, as } = useApiHarness();
const asItAdmin = as(USERS.admin);
const FORBIDDEN = "Your role is not allowed to do this.";

/** A log row as a test writes it. */
interface Row {
  eventType: activity_log_event_type;
  actorId?: number | null;
  targetUserId?: number | null;
  assetId?: number | null;
  details?: string | null;
  createdAt: Date;
}

const writeRows = (rows: Row[]) =>
  db.activity_log.createMany({
    data: rows.map((r) => ({
      event_type: r.eventType,
      actor_id: r.actorId ?? null,
      target_user_id: r.targetUserId ?? null,
      asset_id: r.assetId ?? null,
      details: r.details ?? null,
      created_at: r.createdAt,
    })),
  });

/** A time in the server's local time zone (the tests and the server run on the same machine). */
const local = (year: number, month: number, day: number, hour = 12, minute = 0, second = 0) => new Date(year, month - 1, day, hour, minute, second);

describe("GET /api/activity-log", () => {
  it("answers entries newest first, with labels, people by name, the asset by tag, and no email anywhere", async () => {
    await writeRows([
      { eventType: "ASSET_EDITED", actorId: USERS.staffTsg.userId, assetId: ASSETS.available.assetId, details: "Test: name, room", createdAt: local(2026, 2, 1) },
      { eventType: "ASSET_EDITED", actorId: USERS.staffTsg.userId, targetUserId: USERS.custodianA.userId, details: "Test: newer", createdAt: local(2026, 2, 2) },
    ]);

    const res = await asItAdmin.get("/api/activity-log?eventType=ASSET_EDITED");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, page: 1, pageCount: 1 });
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries[0]).toEqual({
      logId: expect.any(Number),
      eventType: "ASSET_EDITED",
      eventLabel: "Asset edited",
      actor: { userId: USERS.staffTsg.userId, name: USERS.staffTsg.fullName },
      targetUser: { userId: USERS.custodianA.userId, name: USERS.custodianA.fullName },
      asset: null,
      details: "Test: newer",
      createdAt: local(2026, 2, 2).toISOString(),
    });
    expect(res.body.entries[1]).toMatchObject({ actor: { userId: USERS.staffTsg.userId }, targetUser: null, asset: { assetId: ASSETS.available.assetId, tag: ASSETS.available.tag } });
  });

  it("never sends an email, even for login rows, in any entry", async () => {
    await writeRows([
      { eventType: "LOGIN_FAILURE", targetUserId: USERS.custodianB.userId, details: "Wrong password", createdAt: local(2026, 2, 3) },
      { eventType: "LOGIN_SUCCESS", actorId: USERS.custodianB.userId, createdAt: local(2026, 2, 3, 13) },
    ]);

    const res = await asItAdmin.get("/api/activity-log");

    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain("@");
    expect(res.body.entries.find((e: { eventType: string }) => e.eventType === "LOGIN_FAILURE")).toMatchObject({ eventLabel: "Login failed", actor: null });
  });

  it("filters by actor, target account, and asset tag; an unknown tag gives no rows, not 404", async () => {
    await writeRows([
      { eventType: "ASSET_MARKED_MISSING", actorId: USERS.staffIts.userId, assetId: ASSETS.inspected.assetId, createdAt: local(2026, 2, 4) },
      { eventType: "ASSET_MARKED_MISSING", actorId: USERS.staffIts.userId, targetUserId: USERS.director.userId, createdAt: local(2026, 2, 5) },
      { eventType: "ASSET_MARKED_MISSING", actorId: USERS.secretary.userId, assetId: ASSETS.inspected.assetId, createdAt: local(2026, 2, 6) },
    ]);
    const get = (query: string) => asItAdmin.get(`/api/activity-log?eventType=ASSET_MARKED_MISSING&${query}`);

    const byActor = await get(`actorId=${USERS.staffIts.userId}`);
    const byTarget = await get(`targetUserId=${USERS.director.userId}`);
    const byTag = await get(`assetTag=${ASSETS.inspected.tag}`);
    const unknownTag = await get("assetTag=NOPE-9999");

    expect(byActor.body.entries).toHaveLength(2);
    expect(byTarget.body.entries.map((e: { targetUser: { userId: number } }) => e.targetUser.userId)).toEqual([USERS.director.userId]);
    expect(byTag.body.entries.map((e: { actor: { userId: number } }) => e.actor.userId)).toEqual([USERS.secretary.userId, USERS.staffIts.userId]);
    expect(unknownTag.status).toBe(200);
    expect(unknownTag.body).toMatchObject({ entries: [], page: 1, pageCount: 1 });
  });

  it("takes from and to as whole days in the server's local time, both included", async () => {
    await writeRows([
      { eventType: "CLEARANCE_RECORD_PRINTED", details: "before", createdAt: local(2026, 1, 9, 23, 59, 59) },
      { eventType: "CLEARANCE_RECORD_PRINTED", details: "first second", createdAt: local(2026, 1, 10, 0, 0, 0) },
      { eventType: "CLEARANCE_RECORD_PRINTED", details: "last second", createdAt: local(2026, 1, 11, 23, 59, 59) },
      { eventType: "CLEARANCE_RECORD_PRINTED", details: "after", createdAt: local(2026, 1, 12, 0, 0, 0) },
    ]);
    const details = (res: { body: any }) => res.body.entries.map((e: { details: string }) => e.details);

    const both = await asItAdmin.get("/api/activity-log?eventType=CLEARANCE_RECORD_PRINTED&from=2026-01-10&to=2026-01-11");
    const oneDay = await asItAdmin.get("/api/activity-log?eventType=CLEARANCE_RECORD_PRINTED&from=2026-01-10&to=2026-01-10");
    const fromOnly = await asItAdmin.get("/api/activity-log?eventType=CLEARANCE_RECORD_PRINTED&from=2026-01-12");
    const toOnly = await asItAdmin.get("/api/activity-log?eventType=CLEARANCE_RECORD_PRINTED&to=2026-01-09");

    expect(details(both)).toEqual(["last second", "first second"]);
    expect(details(oneDay)).toEqual(["first second"]);
    expect(details(fromOnly)).toEqual(["after"]);
    expect(details(toOnly)).toEqual(["before"]);
  });

  it("pages 50 rows at a time, newest first, and answers an empty page past the last one", async () => {
    await writeRows(
      Array.from({ length: 120 }, (_, i) => ({ eventType: "ASSET_FOUND" as const, details: `row ${i + 1}`, createdAt: new Date(local(2026, 3, 1).getTime() + i * 1000) })),
    );
    const page = (n: number) => asItAdmin.get(`/api/activity-log?eventType=ASSET_FOUND&page=${n}`);

    const [first, second, third, past] = [await page(1), await page(2), await page(3), await page(4)];

    expect(first.body.entries).toHaveLength(50);
    expect(first.body.entries[0].details).toBe("row 120");
    expect(first.body).toMatchObject({ page: 1, pageCount: 3 });
    expect(second.body.entries[0].details).toBe("row 70");
    expect(third.body.entries).toHaveLength(20);
    expect(third.body.entries.at(-1).details).toBe("row 1");
    expect(past.body).toMatchObject({ entries: [], page: 4, pageCount: 3 });
  });

  it("answers pageCount 1 when no row passes the filters", async () => {
    const res = await asItAdmin.get("/api/activity-log?actorId=999999");

    expect(res.body).toMatchObject({ entries: [], page: 1, pageCount: 1 });
  });

  it.each([
    ["?from=2026-02-02&to=2026-02-01", "The start day must be on or before the end day."],
    ["?from=2026-02-30", '"from" must be a day written yyyy-mm-dd.'],
    ["?to=02/01/2026", '"to" must be a day written yyyy-mm-dd.'],
    ["?eventType=LOGIN", "Choose an event type from the list."],
    ["?page=0", "The page must be a whole number from 1."],
    ["?actorId=abc", "The actor id must be a positive whole number."],
    ["?eventType=LOGIN_SUCCESS&eventType=LOGIN_FAILURE", 'Send the filter "eventType" once.'],
    ["?email=x", 'Unknown filter "email". Use eventType, actorId, targetUserId, assetTag, from, to, or page.'],
  ])("answers 400 for the query %j", async (query, message) => {
    const res = await asItAdmin.get(`/api/activity-log${query}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: message });
  });
});

describe("who may read the activity log", () => {
  it("answers 401 with no session", async () => {
    expect((await api.get("/api/activity-log")).status).toBe(401);
  });

  it.each([USERS.staffTsg, USERS.secretary, USERS.director, USERS.labHead, USERS.custodianA])("answers 403 to $lastName", async (user) => {
    const res = await as(user).get("/api/activity-log");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, error: FORBIDDEN });
  });
});
