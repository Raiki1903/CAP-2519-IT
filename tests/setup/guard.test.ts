/**
 * Tests the safety net itself: the database guard and the environment the server child process receives.
 * Covers testDatabase.ts parseTestDatabaseUrl and testServer.ts buildServerEnv. No server, no database.
 * Fixtures: made-up URLs only; the fake password is never a real one.
 */
import { afterEach, describe, expect, it } from "vitest";
import { parseTestDatabaseUrl, TestDatabaseRefused } from "./testDatabase";
import { buildServerEnv } from "./testServer";

const LOCAL_URL = "mysql://root:fake-password@localhost:3306/AdRIC_DB_test";

describe("parseTestDatabaseUrl", () => {
  it("accepts localhost and 127.0.0.1 with a database name ending in _test", () => {
    expect(parseTestDatabaseUrl(LOCAL_URL)).toMatchObject({
      host: "localhost",
      port: 3306,
      user: "root",
      password: "fake-password",
      database: "AdRIC_DB_test",
    });
    expect(parseTestDatabaseUrl("mysql://root:fake-password@127.0.0.1/AdRIC_DB_test").port).toBe(3306);
  });

  it("refuses a host that is not localhost or 127.0.0.1", () => {
    expect(() => parseTestDatabaseUrl("mysql://root:fake-password@db.example.test:3306/AdRIC_DB_test")).toThrow(TestDatabaseRefused);
    expect(() => parseTestDatabaseUrl("mysql://root:fake-password@10.0.0.5:3306/AdRIC_DB_test")).toThrow(TestDatabaseRefused);
  });

  it("refuses a database name that does not end in _test", () => {
    expect(() => parseTestDatabaseUrl("mysql://root:fake-password@localhost:3306/AdRIC_DB")).toThrow(/_test/);
    expect(() => parseTestDatabaseUrl("mysql://root:fake-password@localhost:3306/AdRIC_DB_TEST")).toThrow(TestDatabaseRefused);
    expect(() => parseTestDatabaseUrl("mysql://root:fake-password@localhost:3306/")).toThrow(TestDatabaseRefused);
  });

  it("refuses a missing password, a non-MySQL URL, and text that is not a URL", () => {
    expect(() => parseTestDatabaseUrl("mysql://root@localhost:3306/AdRIC_DB_test")).toThrow(TestDatabaseRefused);
    expect(() => parseTestDatabaseUrl("postgres://root:fake-password@localhost:5432/AdRIC_DB_test")).toThrow(TestDatabaseRefused);
    expect(() => parseTestDatabaseUrl("not a url")).toThrow(TestDatabaseRefused);
  });

  it("never puts the password or the URL in its error message", () => {
    const secret = "fake-secret-value";
    try {
      parseTestDatabaseUrl(`mysql://root:${secret}@db.example.test:3306/AdRIC_DB`);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).not.toContain("db.example.test");
    }
  });
});

describe("buildServerEnv", () => {
  const touched = ["DATABASE_HOST", "DATABASE_URL", "TEST_DATABASE_URL", "MAILGUN_API_KEY", "BACKUP_DIR"];
  const saved = Object.fromEntries(touched.map((key) => [key, process.env[key]]));
  afterEach(() => {
    for (const key of touched) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("sets all five DATABASE_* values from the test URL and drops any inherited ones", () => {
    process.env.DATABASE_HOST = "db.example.test";
    process.env.DATABASE_URL = "mysql://someone:fake@db.example.test/AdRIC_DB";
    process.env.TEST_DATABASE_URL = LOCAL_URL;

    const env = buildServerEnv(parseTestDatabaseUrl(LOCAL_URL), 45678);

    expect(env).toMatchObject({
      DATABASE_HOST: "localhost",
      DATABASE_PORT: "3306",
      DATABASE_USER: "root",
      DATABASE_PASSWORD: "fake-password",
      DATABASE_NAME: "AdRIC_DB_test",
      PORT: "45678",
    });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.TEST_DATABASE_URL).toBeUndefined();
  });

  it("switches off mail and backups with explicit empty values", () => {
    process.env.MAILGUN_API_KEY = "fake-key";
    process.env.BACKUP_DIR = "C:/somewhere";

    const env = buildServerEnv(parseTestDatabaseUrl(LOCAL_URL), 45678);

    expect(env.BACKUP_DIR).toBe("");
    expect(env.MAILGUN_API_KEY).toBe("");
    expect(env.MAILGUN_DOMAIN).toBe("");
    expect(env.MAILGUN_FROM).toBe("");
  });
});
