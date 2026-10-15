/**
 * Session lookup cache: remembers, for 60 seconds per token, whose session a cookie is and with which role, so most
 * requests skip the account and role query on the slow CCS Cloud link (issue #8).
 * Layer: shared (server service). Called by features/auth/auth.service.ts (sessionIdentityFor, endSession). Imports a
 * type only, never config/env.ts or Prisma, so the API tests can use it with their own clock.
 * Used by: every request that carries a session.
 */
import type { SessionIdentity } from '@shared/types/auth';

/** How long one lookup is reused. A role change or a removed account takes effect within this time. */
export const SESSION_CACHE_SECONDS = 60;

const remembered = new Map<string, { identity: SessionIdentity; storedAt: number }>();

function isFresh(storedAt: number, now: number): boolean {
    return now - storedAt < SESSION_CACHE_SECONDS * 1000;
}

/**
 * The identity remembered for this token, if it was stored less than SESSION_CACHE_SECONDS ago.
 * Only a lookup: the caller has already checked the token's signature, expiry, and the logged-out list.
 *
 * @param token the cookie's value
 * @param now the time in milliseconds, for tests
 * @returns the identity, or undefined when none is remembered or it is too old
 */
export function recallIdentity(token: string, now: number = Date.now()): SessionIdentity | undefined {
    const entry = remembered.get(token);
    if (!entry) return undefined;
    if (!isFresh(entry.storedAt, now)) {
        remembered.delete(token);
        return undefined;
    }
    return entry.identity;
}

/**
 * Remembers a token's identity from now, and drops every entry that is too old, so the map never outgrows
 * the sessions used in the last minute.
 *
 * @param token the cookie's value
 * @param identity what the database said: user id, app role, Staff unit
 * @param now the time in milliseconds, for tests
 */
export function rememberIdentity(token: string, identity: SessionIdentity, now: number = Date.now()): void {
    for (const [key, entry] of remembered) {
        if (!isFresh(entry.storedAt, now)) remembered.delete(key);
    }
    remembered.set(token, { identity, storedAt: now });
}

/**
 * Forgets one token, at logout.
 *
 * @param token the cookie's value
 */
export function forgetIdentity(token: string): void {
    remembered.delete(token);
}

/** Forgets everything. For tests. */
export function clearIdentityCache(): void {
    remembered.clear();
}

/** How many tokens are remembered. For tests. */
export function rememberedCount(): number {
    return remembered.size;
}
