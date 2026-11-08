/**
 * Asset remarks API: who reads, adds, and deletes the remarks on an asset, the text's rules, and the soft delete.
 * Covers GET and POST /api/assets/:tag/remarks and DELETE /api/assets/:tag/remarks/:remarkId.
 * Workflow: the Remarks section of the asset detail modal, in every view.
 * Fixtures: the accounts (USERS), LAB (headed by the Lab Head), and the seeded assets in four statuses. The tests add
 * their own assets (TEST-1601 onward) and a lab OTHER with one asset, and write some remarks directly with fixed times.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { addExtraAsset, type ExtraAsset } from "../setup/extraAssets";
import { ASSETS, USERS, type TestUser } from "../setup/fixtures";
import { useApiHarness } from "../setup/harness";
import { NOT_YOUR_LAB_REMARK_MESSAGE, NOT_YOUR_REMARK_MESSAGE, REMARK_NOT_FOUND_MESSAGE } from "../../server/features/assets/remarks.service";

const { db, as, api } = useApiHarness();

const FORBIDDEN = "Your role is not allowed to do this.";

let nextTag = 1601;
/** A new Available asset at LAB, with a tag no other test in this file uses. */
function freshAsset(): Promise<ExtraAsset> {
  return addExtraAsset(db, { tag: `TEST-${nextTag++}` });
}

/** A remark written directly, at a fixed time. */
async function remarkOn(assetId: number, author: TestUser, text: string, at: string) {
  const row = await db.asset_remarks.create({ data: { asset_id: assetId, author_id: author.userId, remark_text: text, created_at: new Date(at) } });
  return row.remark_id;
}

const remarksPath = (tag: string) => `/api/assets/${tag}/remarks`;

/** An asset at a lab LAB's Head does not head. */
let otherLabAsset: ExtraAsset;
beforeAll(async () => {
  const other = await db.research_centers.create({ data: { name: "Test Other Lab", short_code: "OTHER", location: "MANILA" } });
  otherLabAsset = await addExtraAsset(db, { tag: "OTHER-0001", centerId: other.center_id });
});

describe("GET /api/assets/:tag/remarks", () => {
  it("sends the remarks newest first, with the author's name and time, and never a deleted one", async () => {
    const asset = await freshAsset();
    const older = await remarkOn(asset.assetId, USERS.staffTsg, "Older remark", "2026-10-01T08:00:00Z");
    const newer = await remarkOn(asset.assetId, USERS.director, "Newer remark", "2026-10-02T08:00:00Z");
    const gone = await remarkOn(asset.assetId, USERS.staffTsg, "Deleted remark", "2026-10-03T08:00:00Z");
    await db.asset_remarks.update({ where: { remark_id: gone }, data: { deleted_by_id: USERS.staffTsg.userId, deleted_at: new Date() } });

    const res = await as(USERS.staffTsg).get(remarksPath(asset.tag));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      canAdd: true,
      remarks: [
        { remarkId: newer, author: { userId: USERS.director.userId, name: USERS.director.fullName }, createdAt: "2026-10-02T08:00:00.000Z", text: "Newer remark", canDelete: false },
        { remarkId: older, author: { userId: USERS.staffTsg.userId, name: USERS.staffTsg.fullName }, createdAt: "2026-10-01T08:00:00.000Z", text: "Older remark", canDelete: true },
      ],
    });
  });

  it("puts the later of two remarks saved at the same moment first", async () => {
    const asset = await freshAsset();
    const first = await remarkOn(asset.assetId, USERS.staffTsg, "First", "2026-10-05T08:00:00Z");
    const second = await remarkOn(asset.assetId, USERS.staffTsg, "Second", "2026-10-05T08:00:00Z");

    const res = await as(USERS.staffTsg).get(remarksPath(asset.tag));

    expect(res.body.remarks.map((r: { remarkId: number }) => r.remarkId)).toEqual([second, first]);
  });

  it("answers every Active account, and shows a Researcher the author's name too", async () => {
    const asset = await freshAsset();
    await remarkOn(asset.assetId, USERS.director, "Seen by all", "2026-10-06T08:00:00Z");

    for (const user of [USERS.custodianA, USERS.admin, USERS.labHead, USERS.secretary, USERS.director]) {
      const res = await as(user).get(remarksPath(asset.tag));
      expect(res.status, user.email).toBe(200);
      expect(res.body.remarks[0].author, user.email).toEqual({ userId: USERS.director.userId, name: USERS.director.fullName });
    }
  });

  it("says who may add: TSG, the Director, the Secretary, and the home lab's Head, nobody else", async () => {
    const asset = await freshAsset();
    const expected: [TestUser, boolean][] = [
      [USERS.staffTsg, true], [USERS.director, true], [USERS.secretary, true], [USERS.labHead, true],
      [USERS.custodianA, false], [USERS.admin, false],
    ];
    for (const [user, canAdd] of expected) {
      const res = await as(user).get(remarksPath(asset.tag));
      expect(res.body.canAdd, user.email).toBe(canAdd);
    }
    // LAB's Head on another lab's asset.
    expect((await as(USERS.labHead).get(remarksPath(otherLabAsset.tag))).body.canAdd).toBe(false);
  });

  it("says who may delete each remark: its author, the home lab's Head, and the IT Admin", async () => {
    const asset = await freshAsset();
    await remarkOn(asset.assetId, USERS.director, "Director's remark", "2026-10-07T08:00:00Z");
    const expected: [TestUser, boolean][] = [
      [USERS.director, true], [USERS.labHead, true], [USERS.admin, true],
      [USERS.staffTsg, false], [USERS.secretary, false], [USERS.custodianA, false],
    ];
    for (const [user, canDelete] of expected) {
      const res = await as(user).get(remarksPath(asset.tag));
      expect(res.body.remarks[0].canDelete, user.email).toBe(canDelete);
    }

    await remarkOn(otherLabAsset.assetId, USERS.director, "On another lab's asset", "2026-10-07T08:00:00Z");
    expect((await as(USERS.labHead).get(remarksPath(otherLabAsset.tag))).body.remarks[0].canDelete).toBe(false);
  });

  it("answers 404 for an unknown tag and 401 without a session", async () => {
    expect((await as(USERS.staffTsg).get(remarksPath("TEST-9999"))).status).toBe(404);
    expect((await api.get(remarksPath(ASSETS.available.tag))).status).toBe(401);
  });
});

describe("POST /api/assets/:tag/remarks", () => {
  it("lets TSG, the Director, the Secretary, and the home lab's Head add a remark, saved under their own id and trimmed", async () => {
    const asset = await freshAsset();
    for (const user of [USERS.staffTsg, USERS.director, USERS.secretary, USERS.labHead]) {
      const res = await as(user).post(remarksPath(asset.tag), { text: `  Remark by ${user.lastName}  ` });

      expect(res.status, user.email).toBe(201);
      expect(res.body.remark, user.email).toMatchObject({
        author: { userId: user.userId, name: user.fullName },
        text: `Remark by ${user.lastName}`,
        canDelete: true,
      });
      const row = await db.asset_remarks.findUniqueOrThrow({ where: { remark_id: res.body.remark.remarkId } });
      expect(row).toMatchObject({ asset_id: asset.assetId, author_id: user.userId, remark_text: `Remark by ${user.lastName}`, deleted_at: null, deleted_by_id: null });
    }
  });

  it("answers 403 to a Researcher, the IT Admin, and the Head of another lab, and saves nothing", async () => {
    const asset = await freshAsset();

    for (const user of [USERS.custodianA, USERS.admin]) {
      const res = await as(user).post(remarksPath(asset.tag), { text: "Not allowed" });
      expect(res.status, user.email).toBe(403);
      expect(res.body.error, user.email).toBe(FORBIDDEN);
    }
    const otherHead = await as(USERS.labHead).post(remarksPath(otherLabAsset.tag), { text: "Not my lab" });
    expect(otherHead.status).toBe(403);
    expect(otherHead.body.error).toBe(NOT_YOUR_LAB_REMARK_MESSAGE);

    expect(await db.asset_remarks.count({ where: { asset_id: { in: [asset.assetId, otherLabAsset.assetId] }, remark_text: { in: ["Not allowed", "Not my lab"] } } })).toBe(0);
  });

  it("takes up to 500 characters and refuses a missing, empty, longer, or non-text remark with 400", async () => {
    const asset = await freshAsset();

    expect((await as(USERS.staffTsg).post(remarksPath(asset.tag), { text: "x".repeat(500) })).status).toBe(201);
    // The limit counts the trimmed text.
    expect((await as(USERS.staffTsg).post(remarksPath(asset.tag), { text: ` ${"y".repeat(500)} ` })).status).toBe(201);

    const refused: [unknown, string][] = [
      [{}, "Write the remark first."],
      [{ text: "" }, "Write the remark first."],
      [{ text: "   " }, "Write the remark first."],
      [{ text: "z".repeat(501) }, "A remark can be at most 500 characters."],
      [{ text: 42 }, "The remark must be text."],
    ];
    for (const [body, message] of refused) {
      const res = await as(USERS.staffTsg).post(remarksPath(asset.tag), body);
      expect(res.status, JSON.stringify(body).slice(0, 40)).toBe(400);
      expect(res.body.error).toBe(message);
    }
    expect(await db.asset_remarks.count({ where: { asset_id: asset.assetId } })).toBe(2);
  });

  it("answers 404 for an unknown tag", async () => {
    const res = await as(USERS.staffTsg).post(remarksPath("TEST-9999"), { text: "Nowhere" });
    expect(res.status).toBe(404);
  });

  it("is allowed in every asset status and never changes the asset", async () => {
    for (const seeded of [ASSETS.onLoan, ASSETS.inRepair, ASSETS.disposed, ASSETS.available]) {
      const before = await db.assets.findUniqueOrThrow({ where: { asset_id: seeded.assetId } });
      const res = await as(USERS.director).post(remarksPath(seeded.tag), { text: `Remark in ${seeded.listStatus}` });

      expect(res.status, seeded.tag).toBe(201);
      expect(await db.assets.findUniqueOrThrow({ where: { asset_id: seeded.assetId } }), seeded.tag).toEqual(before);
    }
  });

  it("saves both of two remarks sent at the same moment", async () => {
    const asset = await freshAsset();

    const [first, second] = await Promise.all([
      as(USERS.staffTsg).post(remarksPath(asset.tag), { text: "At once, one" }),
      as(USERS.director).post(remarksPath(asset.tag), { text: "At once, two" }),
    ]);

    expect([first.status, second.status]).toEqual([201, 201]);
    const rows = await db.asset_remarks.findMany({ where: { asset_id: asset.assetId }, orderBy: { remark_text: "asc" } });
    expect(rows.map(r => r.remark_text)).toEqual(["At once, one", "At once, two"]);
  });
});

describe("DELETE /api/assets/:tag/remarks/:remarkId", () => {
  const deletePath = (tag: string, remarkId: number | string) => `/api/assets/${tag}/remarks/${remarkId}`;

  it("lets the author delete their own remark: the row stays with who and when, and the list no longer sends it", async () => {
    const asset = await freshAsset();
    const remarkId = await remarkOn(asset.assetId, USERS.staffTsg, "Mine", "2026-10-08T08:00:00Z");

    const res = await as(USERS.staffTsg).delete(deletePath(asset.tag, remarkId));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, deleted: remarkId });
    const row = await db.asset_remarks.findUniqueOrThrow({ where: { remark_id: remarkId } });
    expect(row.deleted_by_id).toBe(USERS.staffTsg.userId);
    expect(row.deleted_at).toBeInstanceOf(Date);
    expect(row.remark_text).toBe("Mine");
    expect((await as(USERS.staffTsg).get(remarksPath(asset.tag))).body.remarks).toEqual([]);
  });

  it("answers 403 to TSG deleting the Director's remark, and to a Researcher and the Head of another lab", async () => {
    const asset = await freshAsset();
    const remarkId = await remarkOn(asset.assetId, USERS.director, "Director's", "2026-10-09T08:00:00Z");
    const otherRemark = await remarkOn(otherLabAsset.assetId, USERS.director, "Other lab's", "2026-10-09T08:00:00Z");

    const attempts: [TestUser, string, number][] = [
      [USERS.staffTsg, asset.tag, remarkId],
      [USERS.secretary, asset.tag, remarkId],
      [USERS.custodianA, asset.tag, remarkId],
      [USERS.labHead, otherLabAsset.tag, otherRemark],
    ];
    for (const [user, tag, id] of attempts) {
      const res = await as(user).delete(deletePath(tag, id));
      expect(res.status, user.email).toBe(403);
      expect(res.body.error, user.email).toBe(NOT_YOUR_REMARK_MESSAGE);
    }
    const rows = await db.asset_remarks.findMany({ where: { remark_id: { in: [remarkId, otherRemark] } } });
    expect(rows.every(r => r.deleted_at === null && r.deleted_by_id === null)).toBe(true);
  });

  it("lets the home lab's Head delete the Director's remark", async () => {
    const asset = await freshAsset();
    const remarkId = await remarkOn(asset.assetId, USERS.director, "Director's", "2026-10-10T08:00:00Z");

    const res = await as(USERS.labHead).delete(deletePath(asset.tag, remarkId));

    expect(res.status).toBe(200);
    expect((await db.asset_remarks.findUniqueOrThrow({ where: { remark_id: remarkId } })).deleted_by_id).toBe(USERS.labHead.userId);
  });

  it("lets the IT Admin delete anyone's remark, on any lab's asset", async () => {
    const asset = await freshAsset();
    const ours = await remarkOn(asset.assetId, USERS.staffTsg, "TSG's", "2026-10-11T08:00:00Z");
    const theirs = await remarkOn(otherLabAsset.assetId, USERS.director, "Director's elsewhere", "2026-10-11T08:00:00Z");

    expect((await as(USERS.admin).delete(deletePath(asset.tag, ours))).status).toBe(200);
    expect((await as(USERS.admin).delete(deletePath(otherLabAsset.tag, theirs))).status).toBe(200);
    const rows = await db.asset_remarks.findMany({ where: { remark_id: { in: [ours, theirs] } } });
    expect(rows.map(r => r.deleted_by_id)).toEqual([USERS.admin.userId, USERS.admin.userId]);
  });

  it("answers 404 for a remark already deleted, a remark of another asset, and an unknown tag; 400 for an id that is not a number", async () => {
    const asset = await freshAsset();
    const other = await freshAsset();
    const remarkId = await remarkOn(asset.assetId, USERS.staffTsg, "Once", "2026-10-12T08:00:00Z");
    const elsewhere = await remarkOn(other.assetId, USERS.staffTsg, "Elsewhere", "2026-10-12T08:00:00Z");

    expect((await as(USERS.staffTsg).delete(deletePath(asset.tag, remarkId))).status).toBe(200);
    const again = await as(USERS.staffTsg).delete(deletePath(asset.tag, remarkId));
    expect(again.status).toBe(404);
    expect(again.body.error).toBe(REMARK_NOT_FOUND_MESSAGE);

    const wrongAsset = await as(USERS.admin).delete(deletePath(asset.tag, elsewhere));
    expect(wrongAsset.status).toBe(404);
    expect(wrongAsset.body.error).toBe(REMARK_NOT_FOUND_MESSAGE);
    expect((await db.asset_remarks.findUniqueOrThrow({ where: { remark_id: elsewhere } })).deleted_at).toBeNull();

    expect((await as(USERS.admin).delete(deletePath("TEST-9999", elsewhere))).status).toBe(404);
    expect((await as(USERS.admin).delete(deletePath(asset.tag, "abc"))).status).toBe(400);
  });

  it("gives one of two deletes at the same moment a 200 and the other a 404, and keeps the first delete's who", async () => {
    const asset = await freshAsset();
    const remarkId = await remarkOn(asset.assetId, USERS.director, "Raced", "2026-10-13T08:00:00Z");

    const results = await Promise.all([
      as(USERS.director).delete(deletePath(asset.tag, remarkId)),
      as(USERS.admin).delete(deletePath(asset.tag, remarkId)),
    ]);

    expect(results.map(r => r.status).sort()).toEqual([200, 404]);
    const winner = results[0].status === 200 ? USERS.director : USERS.admin;
    expect((await db.asset_remarks.findUniqueOrThrow({ where: { remark_id: remarkId } })).deleted_by_id).toBe(winner.userId);
  });
});
