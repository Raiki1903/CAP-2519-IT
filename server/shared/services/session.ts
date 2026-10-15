/**
 * Session tokens and cookies: signs and checks the token login puts in the adric_session cookie, reads the Cookie
 * header, builds the Set-Cookie values, and keeps the list of tokens that logged out. (C-06)
 * Layer: shared (server service). Called by features/auth/auth.service.ts and auth.controller.ts, and by
 * shared/middleware/requireAuth.ts; the API tests import it to sign test tokens. Calls Node's crypto only, never
 * config/env.ts: the secret is passed in, so tests can use the module without a .env.
 * Used by: login, logout, and every request that needs a session.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** The name of the session cookie. */
export const SESSION_COOKIE_NAME = 'adric_session';
/** How long a session lasts after login: 8 hours (decided 2026-10-13). */
export const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

/** What a valid token says. */
export interface SessionClaims {
    userId: number;
    /** Seconds since 1970, like a cookie's own expiry. */
    expiresAt: number;
}

function signatureOf(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Builds a token `<user id>.<expiry>.<nonce>.<signature>`, the signature an HMAC-SHA256 of the first three parts.
 * Changing any part without the secret makes the signature wrong.
 *
 * @param userId the users.user_id the session belongs to
 * @param expiresAt when it stops being valid, in seconds since 1970
 * @param secret SESSION_SECRET (the tests pass their own)
 * @param nonce random by default; tests never need to pass it
 * @returns the token, made only of digits, letters, "-", "_", and "."
 */
// The nonce makes every login's token different, even for the same user in the same second:
// without it, logging out and straight back in got back the token just put on the logged-out list.
export function signSessionToken(
    userId: number,
    expiresAt: number,
    secret: string,
    nonce: string = randomBytes(16).toString('base64url'),
): string {
    const payload = `${userId}.${expiresAt}.${nonce}`;
    return `${payload}.${signatureOf(payload, secret)}`;
}

/**
 * A new token for a login, valid for SESSION_LIFETIME_SECONDS.
 *
 * @param userId the account that logged in
 * @param secret SESSION_SECRET
 * @param now the time in milliseconds, for tests
 * @returns the token for the cookie
 */
export function createSessionToken(userId: number, secret: string, now: number = Date.now()): string {
    return signSessionToken(userId, Math.floor(now / 1000) + SESSION_LIFETIME_SECONDS, secret);
}

/**
 * Checks a token's shape, signature, and expiry. It does not check the logged-out list or that the account exists:
 * auth.service.ts sessionIdentityFor does both.
 *
 * @param token the cookie's value
 * @param secret SESSION_SECRET
 * @param now the time in milliseconds, for tests
 * @returns the user id and expiry, or null for anything malformed, wrongly signed, or expired
 */
export function verifySessionToken(token: string, secret: string, now: number = Date.now()): SessionClaims | null {
    const parts = token.split('.');
    if (parts.length !== 4) return null;
    const [userIdText, expiresAtText, nonce, signature] = parts;
    if (!/^\d+$/.test(userIdText) || !/^\d+$/.test(expiresAtText) || !/^[A-Za-z0-9_-]+$/.test(nonce)) return null;

    const expected = Buffer.from(signatureOf(`${userIdText}.${expiresAtText}.${nonce}`, secret));
    const given = Buffer.from(signature);
    // timingSafeEqual throws on different lengths, and a plain === would leak how many characters matched.
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

    const expiresAt = Number(expiresAtText);
    if (expiresAt * 1000 <= now) return null;
    return { userId: Number(userIdText), expiresAt };
}

// Tokens that logged out before their expiry. In memory only: a server restart forgets it,
// so a token logged out before a restart works again until it expires (accepted 2026-10-13).
const loggedOut = new Map<string, number>();

function forgetExpired(now: number): void {
    for (const [token, expiresAt] of loggedOut) {
        if (expiresAt * 1000 <= now) loggedOut.delete(token);
    }
}

/**
 * Refuses a token from now until it would have expired anyway. Expired entries are dropped as the list is used.
 *
 * @param token the logged-out cookie's value
 * @param expiresAt its expiry, in seconds since 1970
 * @param now the time in milliseconds, for tests
 */
export function markLoggedOut(token: string, expiresAt: number, now: number = Date.now()): void {
    forgetExpired(now);
    loggedOut.set(token, expiresAt);
}

/**
 * @param token a cookie's value
 * @param now the time in milliseconds, for tests
 * @returns true if this token logged out and has not expired yet
 */
export function isLoggedOut(token: string, now: number = Date.now()): boolean {
    forgetExpired(now);
    return loggedOut.has(token);
}

/**
 * Reads one cookie from a Cookie request header. A small helper of ours: no cookie-parser is installed.
 *
 * @param header req.headers.cookie, for example "a=1; adric_session=..."
 * @param name the cookie's name
 * @returns its value as sent, or undefined when the header or the cookie is missing
 */
export function readCookie(header: string | undefined, name: string): string | undefined {
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
    }
    return undefined;
}

/**
 * The Set-Cookie value login answers: HttpOnly (page scripts cannot read it), SameSite=Lax, the whole site, 8 hours.
 *
 * @param token from createSessionToken
 * @returns the header value
 */
// No Secure flag until the app is served over HTTPS (01C tier 3 item 17): browsers drop a Secure cookie sent over http.
export function sessionCookieHeader(token: string): string {
    return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_SECONDS}`;
}

/** The Set-Cookie value logout answers: the same cookie, empty, expiring at once, so the browser deletes it. */
export function clearedSessionCookieHeader(): string {
    return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
