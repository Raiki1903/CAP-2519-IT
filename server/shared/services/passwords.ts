/**
 * Password hashing: the only code that hashes or checks a password. (C-03, issue #10)
 * Layer: shared (server service). Called by features/auth, the demo seed, the upgrade script, and the tests. Calls Node's crypto.
 * Used by: login, sign-ups and their approval, prisma/seed.ts, and prisma/hashExistingPasswords.ts.
 * It imports no server config, so the database tools can use it without loading .env.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

// A stored hash names its own cost, so these limits stop a damaged row from asking for huge memory or time.
const MAX_MEMORY_BYTES = 256 * 1024 * 1024;
const MAX_P = 8;
const MIN_STORED_SALT_BYTES = 16;
const MIN_STORED_KEY_BYTES = 32;

const HASH_PATTERN = /^scrypt\$(\d{1,7})\$(\d{1,3})\$(\d{1,3})\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/;

interface ScryptParameters {
    N: number;
    r: number;
    p: number;
}

interface ParsedHash extends ScryptParameters {
    salt: Buffer;
    key: Buffer;
}

function formatHash({ N, r, p }: ScryptParameters, salt: Buffer, key: Buffer): string {
    return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function isBase64(text: string): boolean {
    return text.length % 4 === 0;
}

function parseHash(stored: unknown): ParsedHash | null {
    if (typeof stored !== 'string') return null;
    const match = HASH_PATTERN.exec(stored);
    if (!match) return null;

    const [N, r, p] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const isPowerOfTwo = N > 1 && Number.isInteger(Math.log2(N));
    if (!isPowerOfTwo || r < 1 || p < 1 || p > MAX_P || 128 * N * r > MAX_MEMORY_BYTES) return null;
    if (!isBase64(match[4]) || !isBase64(match[5])) return null;

    const salt = Buffer.from(match[4], 'base64');
    const key = Buffer.from(match[5], 'base64');
    if (salt.length < MIN_STORED_SALT_BYTES || key.length < MIN_STORED_KEY_BYTES) return null;
    return { N, r, p, salt, key };
}

function deriveKey(plain: string, salt: Buffer, keyBytes: number, { N, r, p }: ScryptParameters): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        // Node's default memory limit is too low for these parameters. Twice what scrypt needs leaves room for its own overhead.
        const maxmem = 2 * 128 * r * (N + p);
        scrypt(plain, salt, keyBytes, { N, r, p, maxmem }, (error, key) => (error ? reject(error) : resolve(key)));
    });
}

/**
 * Hashes a password for storing.
 *
 * @param plain the password as typed
 * @returns `scrypt$N$r$p$<salt base64>$<key base64>`, with a new random salt each time
 */
export async function hashPassword(plain: string): Promise<string> {
    const parameters = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P };
    const salt = randomBytes(SALT_BYTES);
    return formatHash(parameters, salt, await deriveKey(plain, salt, KEY_BYTES, parameters));
}

/**
 * Checks a password against a stored hash, using the parameters in the hash.
 * Never throws on bad input, and has no plain-text fallback.
 *
 * @param plain the password as sent; anything but a string is simply wrong
 * @param stored the stored value
 * @returns true only for the right password and a valid hash
 */
export async function verifyPassword(plain: unknown, stored: unknown): Promise<boolean> {
    const parsed = parseHash(stored);
    if (typeof plain !== 'string' || !parsed) return false;
    try {
        const key = await deriveKey(plain, parsed.salt, parsed.key.length, parsed);
        return timingSafeEqual(key, parsed.key);
    } catch {
        return false;
    }
}

/**
 * Whether a value is a hash in the stored format, as opposed to a password still in plain text.
 *
 * @param value the value to check
 * @returns true only for the format hashPassword writes
 */
export function isPasswordHash(value: unknown): value is string {
    return parseHash(value) !== null;
}

/**
 * A valid hash no password belongs to, for login to verify against when it has no real hash to check, so that the
 * answer takes the same time and does not reveal which emails exist. It has the same cost and sizes as a real hash.
 */
export const DUMMY_PASSWORD_HASH = formatHash(
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
    randomBytes(SALT_BYTES),
    randomBytes(KEY_BYTES),
);
