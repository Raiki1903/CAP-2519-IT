/**
 * HTML escaping for the disposal emails.
 * Covers escapeHtml (server/shared/utils/html.ts), which every value in a disposal email goes through. (H-20)
 * Workflow: the disposal emails. Needs no server or database.
 */
import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../server/shared/utils/html";

describe("escapeHtml", () => {
  it("turns markup in a typed name or reason into text", () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')"> & co`)).toBe("&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt; &amp; co");
  });

  it("leaves plain text and numbers as they are", () => {
    expect(escapeHtml("Test Dev Kit TEST-0001")).toBe("Test Dev Kit TEST-0001");
    expect(escapeHtml(42)).toBe("42");
  });
});
