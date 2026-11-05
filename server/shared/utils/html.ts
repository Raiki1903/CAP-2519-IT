/**
 * HTML escaping for values put into an email's HTML.
 * Layer: shared (server utility). Called by features/retirements/retirements.service.ts and shared/services/mailer.ts.
 * Calls nothing.
 * Used by: the disposal emails.
 */

const HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

/**
 * Escapes a value for HTML, so a typed name or reason shows as text and never as markup. (H-20)
 *
 * @param value the text, or a number
 * @returns the text with &, <, >, " and ' replaced by their entities
 */
export function escapeHtml(value: string | number): string {
    return String(value).replace(/[&<>"']/g, ch => HTML_ENTITIES[ch]);
}
