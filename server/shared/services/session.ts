import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'adric_session';
export const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

export interface SessionClaims {
    userId: number;
    /** Seconds since 1970, like a cookie's own expiry. */
    expiresAt: number;
}

function signatureOf(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('base64url');
}

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

export function createSessionToken(userId: number, secret: string, now: number = Date.now()): string {
    return signSessionToken(userId, Math.floor(now / 1000) + SESSION_LIFETIME_SECONDS, secret);
}

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

export function markLoggedOut(token: string, expiresAt: number, now: number = Date.now()): void {
    forgetExpired(now);
    loggedOut.set(token, expiresAt);
}

export function isLoggedOut(token: string, now: number = Date.now()): boolean {
    forgetExpired(now);
    return loggedOut.has(token);
}

export function readCookie(header: string | undefined, name: string): string | undefined {
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
    }
    return undefined;
}

// No Secure flag until the app is served over HTTPS (01C tier 3 item 17): browsers drop a Secure cookie sent over http.
export function sessionCookieHeader(token: string): string {
    return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_SECONDS}`;
}

export function clearedSessionCookieHeader(): string {
    return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
