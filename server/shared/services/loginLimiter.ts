/**
 * The failed-login limit: 5 failed logins for one email from one address within 15 minutes block that pair for 15
 * minutes. (issue #136)
 * Layer: shared service. Called by features/auth/auth.service.ts (login). Calls nothing.
 * Used by: login for every role.
 * Kept in memory only, so a server restart clears it, and two server processes would each keep their own.
 */

/** Failed logins that block a key. */
const MAX_FAILURES = 5;
/** How far back failures count. */
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** How long a key stays blocked. */
const BLOCK_MS = 15 * 60 * 1000;
/** Most keys kept at once; past it, the key used longest ago is dropped. Bounds the memory a flood of emails can take. */
const MAX_KEYS = 10_000;

/** The 429 message. The same whether or not the email has an account. */
export const TOO_MANY_LOGINS_MESSAGE = "Too many failed logins. Try again in 15 minutes.";

interface KeyState {
    /** When each recent failure happened, oldest first; at most MAX_FAILURES. */
    failures: number[];
    /** Until when the key is blocked, or 0. */
    blockedUntil: number;
}

// A Map keeps insertion order, and every change re-inserts its key, so the first key is the one used longest ago.
const states = new Map<string, KeyState>();
let lastPruneAt = 0;

/** Whether a key has nothing left that counts: no block running and no failure inside the window. */
function isExpired(state: KeyState, now: number): boolean {
    return state.blockedUntil <= now && state.failures.every(at => now - at >= FAILURE_WINDOW_MS);
}

/** Drops every expired key, at most once per window, so keys nobody uses again do not stay forever. */
function pruneExpired(now: number): void {
    if (now - lastPruneAt < FAILURE_WINDOW_MS) return;
    lastPruneAt = now;
    for (const [key, state] of states) {
        if (isExpired(state, now)) states.delete(key);
    }
}

/**
 * The key a login is counted under: the email as typed, trimmed and in lower case, and the client's address.
 *
 * @param email the email from the body
 * @param ip req.ip, which behind nginx is the forwarded address (app.ts trust proxy)
 */
export function loginKey(email: unknown, ip: string | undefined): string {
    return `${String(email).trim().toLowerCase()}|${ip ?? ''}`;
}

/**
 * Whether a key is blocked now. Checked before the password is verified, so a blocked key costs no hashing.
 *
 * @param key from loginKey
 * @param now the time, for tests
 */
export function isLoginBlocked(key: string, now: number = Date.now()): boolean {
    const state = states.get(key);
    if (!state) return false;
    if (isExpired(state, now)) {
        states.delete(key);
        return false;
    }
    return state.blockedUntil > now;
}

/**
 * Counts one failed login for a key. The fifth failure within the window blocks the key.
 *
 * @param key from loginKey
 * @param now the time, for tests
 */
export function recordLoginFailure(key: string, now: number = Date.now()): void {
    pruneExpired(now);
    const state = states.get(key) ?? { failures: [], blockedUntil: 0 };
    states.delete(key);

    state.failures = [...state.failures.filter(at => now - at < FAILURE_WINDOW_MS), now].slice(-MAX_FAILURES);
    if (state.failures.length >= MAX_FAILURES) {
        state.blockedUntil = now + BLOCK_MS;
        state.failures = [];
    }
    states.set(key, state);

    while (states.size > MAX_KEYS) {
        states.delete(states.keys().next().value!);
    }
}

/**
 * Forgets a key's failures, after a successful login.
 *
 * @param key from loginKey
 */
export function clearLoginFailures(key: string): void {
    states.delete(key);
}

/** How many keys are kept now. For tests. */
export function trackedLoginKeyCount(): number {
    return states.size;
}

/** Forgets every key. For tests only: each test starts from an empty limiter. */
export function resetLoginLimiter(): void {
    states.clear();
    lastPruneAt = 0;
}
