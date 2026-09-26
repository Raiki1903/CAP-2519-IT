# 01C. Security Map

Project: CAP-2519-IT. Phase 1B. Date: 2026-09-18.

**What this document is.** A security review of our own system, written by our own team, for the purpose of fixing it. Nothing here is an attack on anyone else's system, and nothing here should be used against any system we do not own. Every weakness below is described so that we can close it before the next defense and before this system ever holds real institutional data.

**What this document assumes.** The system currently runs on a developer laptop against a shared university database. It is not deployed publicly. That is the only reason the findings below have not already caused harm.

Companion documents: [01A-system-trace.md](01A-system-trace.md) for how the system works, [01B-findings-register.md](01B-findings-register.md) for the ranked defect list.

---

## Table of contents

1. [One-paragraph summary](#1-one-paragraph-summary)
2. [Attack surface](#2-attack-surface)
3. [Authentication](#3-authentication)
4. [Authorization, route by route](#4-authorization-route-by-route)
5. [Sensitive data map](#5-sensitive-data-map)
6. [Input handling](#6-input-handling)
7. [Configuration and secrets](#7-configuration-and-secrets)
8. [Data Privacy Act mapping (panel comment D2)](#8-data-privacy-act-mapping-panel-comment-d2)
9. [Prioritized remediation plan](#9-prioritized-remediation-plan)

---

## 1. One-paragraph summary

- **Technical:** The API has no authentication, no authorization, and no audit. Identity is a plaintext email in an unsigned cookie, and the server will answer any question about any email. Passwords are stored, compared, returned in at least one response body, and committed to the repository in 113 backup files. Database credentials are hardcoded as fallbacks in tracked code. The only security controls that exist are React components choosing which buttons to render.
- **Simple:** Right now the system has no lock on the door. The website politely hides menus from people who should not use them, but the server behind it does whatever anyone asks. On top of that, real passwords are written in plain text inside the project folder, which is the most urgent thing on this list.

---

## 2. Attack surface

Everything below is reachable by anyone who can send a network request to the machine running the API, plus anyone who can read the repository.

### 2.1 HTTP API

- **Technical:** 62 routes on port 4000 ([server.ts#L4753](../../server.ts#L4753)), all under `/api`. `app.use(cors())` with no options allows every origin ([L11](../../server.ts#L11)), so any web page in any tab can call the API with the browser's cooperation. There is no rate limiting, no request size limit below 50 MB ([L12-L13](../../server.ts#L12-L13)), no HTTPS, and no request logging beyond `console.log`.
- **Simple:** One open door with 62 rooms behind it. Any website you have open in another tab can walk in.

### 2.2 Static files and the frontend

- **Technical:** Vite serves the React bundle in development. The bundle contains the localStorage mock with 11 demo accounts and their passwords ([prismaClient.ts#L202-L214](../../src/app/prismaClient.ts#L202-L214)), which ship to the browser of anyone who loads the page. There is no production build in use and no static file serving from Express.
- **Simple:** The demo usernames and passwords are inside the website's own code, which every visitor downloads.

### 2.3 Database connection

- **Technical:** A direct MariaDB connection from the server to `ccscloud.dlsu.edu.ph` on a non-standard port, with a connection pool of 20 ([prisma.ts](../../prisma.ts)). Host, port, user, database, and password all have literal fallbacks in that tracked file. `allowPublicKeyRetrieval: true` is set, which permits the client to fetch the server's public key over an unencrypted channel during authentication; there is no TLS configuration for the connection.
- **Simple:** The project connects straight to the university database using an address and password written inside the code, so anyone with the code can connect too, without going through the app at all.

### 2.4 Email

- **Technical:** Mailgun HTTP API through [mailer.ts](../../mailer.ts), keyed by three environment variables. Four events send mail. Recipients are chosen by database lookup, and bodies interpolate user-controlled text without escaping ([server.ts#L1514-L1518](../../server.ts#L1514-L1518), [L1774-L1778](../../server.ts#L1774-L1778)). Sends happen after the HTTP response, so failures are invisible.
- **Simple:** The system can send mail from an institutional address, and whatever someone typed into a form goes into that mail unchecked.

### 2.5 Server file system

- **Technical:** Two locations are read and written at runtime: `pending_registrations.json` ([L3692-L3712](../../server.ts#L3692-L3712)) and `scratch/backups/` ([L4719-L4742](../../server.ts#L4719-L4742)). Both paths are built from `process.cwd()`, not from user input, so there is no path traversal risk; the risk is what they contain and that they are committed.
- **Simple:** The server writes two kinds of file next to the code. Neither should be in the repository.

### 2.6 The repository itself

- **Technical:** The largest exposure in the system is not a network path. It is `scratch/backups/` (113 tracked files, each containing the full `users` table with the `password` field) plus `pending_registrations.json`. Anyone with read access to the repository, now or in the future, has those credentials, and git history preserves them after deletion.
- **Simple:** The code repository is currently the easiest way to get everyone's password. That is not a hacking problem, it is a housekeeping problem, and it is the first thing to fix.

### 2.7 Browser storage

- **Technical:** Session cookies with no `HttpOnly`, `Secure`, or `SameSite` attributes ([context.tsx#L5-L13](../../src/app/context.tsx#L5-L13)), plus five localStorage keys holding application data. Any script running on the page, including a compromised npm dependency, can read and rewrite all of it.
- **Simple:** The login state and some app data sit in the browser in a form that any script on the page can read or change.

---

## 3. Authentication

### 3.1 How identity is established today

- **Technical:**
  1. `POST /api/auth/login` matches `email` and plaintext `password` inside a single Prisma `findFirst` ([server.ts#L3894-L3898](../../server.ts#L3894-L3898)). MySQL string comparison uses the column collation, `utf8mb4_unicode_ci`, which is case insensitive, so `Password123` and `password123` both match.
  2. On success the browser writes three cookies: `session_user_email`, `session_last_activity`, `session_created` ([Login.tsx#L77-L80](../../src/app/components/Login.tsx#L77-L80)).
  3. On every page load, `GET /api/auth/me?email=<cookie value>` returns that user's profile and role ([context.tsx#L498](../../src/app/context.tsx#L498), [server.ts#L3966](../../server.ts#L3966)). No password, token, or signature is involved.
  4. If the API rejects the credentials, the login screen falls back to the localStorage mock and can still grant a Custodian session ([Login.tsx#L55-L73](../../src/app/components/Login.tsx#L55-L73)).
- **Simple:** Logging in checks your password once. After that, being logged in means nothing more than having your email address written in a cookie.

### 3.2 How it can be forged

| Method | Effort | Result |
|---|---|---|
| Edit the `session_user_email` cookie in dev tools to another person's address | Seconds, no tools beyond the browser | Full session as that person, including AdRIC Director |
| Call any endpoint directly with curl or Postman | Seconds | Everything, since no endpoint checks anything |
| Read a committed backup file and log in normally | Minutes | A genuine session, indistinguishable from the real user |
| Call `GET /api/auth/pending-registrations` | Seconds | Credentials of everyone awaiting approval |
| Call `POST /api/auth/approve-registration` with an invented body | Seconds | A new account with ADMIN or LAB_HEAD ([server.ts#L3774-L3801](../../server.ts#L3774-L3801)) |

### 3.3 What authentication does not protect

- **Technical:** No password strength rule beyond 6 characters on the client only ([Register.tsx#L69](../../src/app/components/Register.tsx#L69)); no rate limiting or lockout on login; no password reset flow, so a forgotten password requires a database edit; no password change in the app at all; no multi-factor; no session invalidation on the server, so "logging out" only clears cookies locally; no record of who logged in or when.
- **Simple:** There is no limit on password guessing, no way to change or reset a password inside the app, and no way to see who has logged in.

---

## 4. Authorization, route by route

- **Technical:** For all 62 routes, the enforced column is **nothing**. There is no middleware, no role check, no ownership check, and no record-level scoping anywhere in `server.ts`. The "should be allowed" column below is our own intent, taken from the UI's role gating, and is the specification for the fix.
- **Simple:** Every single row of this table says the server checks nothing. The middle column is what we meant to happen.

### 4.1 Authentication and account routes

| Route | Should be allowed | Enforced | Extra exposure |
|---|---|---|---|
| `POST /api/auth/login` | public | nothing | Unlimited attempts, case-insensitive password match |
| `POST /api/auth/register-request` | public | nothing | Unlimited creation of pending records, no CAPTCHA, no email verification |
| `GET /api/auth/pending-registrations` | Lab Head, own lab only | **nothing** | Returns `password` for every pending applicant |
| `POST /api/auth/approve-registration` | Lab Head, own lab only | **nothing** | Creates accounts with any role from the body; the response echoes the created row including `password` ([L3878](../../server.ts#L3878)) |
| `POST /api/auth/reject-registration` | Lab Head, own lab only | **nothing** | Silently discards someone's application |
| `GET /api/auth/me?email=` | the signed-in user only | **nothing** | Any email, returns role, ID number, lab, avatar |
| `PUT /api/auth/account` | the signed-in user only | **nothing** | Target is the email in the body, so anyone can rename anyone or move them to another lab |
| `POST /api/auth/register` (dead) | n/a | nothing | Direct account creation, no approval step |

### 4.2 Asset routes

| Route | Should be allowed | Enforced | Extra exposure |
|---|---|---|---|
| `GET /api/assets` | any signed-in user | **nothing** | Whole registry with custodian names and images |
| `POST /api/assets` | ITS, TSG | **nothing** | Anyone can create assets |
| `PUT /api/assets/:tag` | ITS, TSG | **nothing** | Anyone can rewrite an asset and its newest history row |
| `DELETE /api/assets/:tag` | ITS only, arguably nobody | **nothing** | Anyone can erase an asset and its custody chain |
| `GET /api/assets/:tag/custodian-history` | any signed-in user | **nothing** | Returns custodian **email and ID number** for every holder ([L447-L454](../../server.ts#L447-L454)) |
| `POST /api/assets/:tag/inspection` | Custodian, ITS, TSG | **nothing** | Anyone can attach an inspection and change an asset's condition |
| `GET /api/asset-reports`, `GET /api/asset_reports` | ITS, TSG | **nothing** | Returns reporter email ([L880](../../server.ts#L880)) |

### 4.3 Workflow routes

| Route | Should be allowed | Enforced | Extra exposure |
|---|---|---|---|
| `POST /api/assets/:tag/borrow` | Custodian, as themselves | **nothing** | Borrower is a typed name, so a request can be filed in anyone's name |
| `GET /api/asset_loans` | Lab Head, ITS, TSG | **nothing** | Also writes a row (H-08) |
| `PUT /api/asset_loans/:id/decision` | Lab Head of the asset's lab | **nothing** | Anyone can approve any loan |
| `POST /api/assets/:tag/transfer` | current custodian only | **nothing** | Anyone can start a transfer of anyone's asset to anyone |
| `GET /api/asset_transfers` | Lab Head, participants | **nothing** | Returns recipient emails ([L1576](../../server.ts#L1576)) |
| `PUT /api/asset_transfers/:id/decision` | recipient, or Lab Head (undecided, see open question 1) | **nothing** | Anyone can accept custody on someone else's behalf |
| `PUT /api/asset_transfers/:id/accept` (dead) | recipient | **nothing** | Would permanently stall the transfer (M-12) |
| `POST /api/assets/:tag/return` | TSG, ITS | **nothing** | Anyone can close out any asset |
| `GET /api/asset_returns` (dead) | TSG, ITS | **nothing** | |
| `POST /api/assets/:tag/repair` | Custodian, Lab Head, TSG, ITS | **nothing** | |
| `GET /api/asset_repairs` | TSG, ITS | **nothing** | |
| `PUT /api/asset_repairs/:id` | TSG, ITS | **nothing** | Any string accepted as status |
| `PUT /api/asset_repairs/:id/status` | TSG, ITS | **nothing** | Same, and out of sync with the above |
| `POST /api/assets/:tag/disposal` | ITS, TSG | **nothing** | |
| `GET /api/asset_disposals` | Director, ITS, TSG | **nothing** | |
| `PUT /api/asset_disposals/:id/decision` | AdRIC Director only | **nothing** | Anyone can authorize destruction of institutional equipment |

### 4.4 Analytics routes (30)

| Group | Routes | Should be allowed | Enforced | Notes |
|---|---|---|---|---|
| Role dashboards | `director`, `lab-head`, `tsg`, `dashboard` | the matching role | **nothing** | `lab-head` accepts any lab prefix as a query parameter, so any caller can read any lab's data |
| Personal data exposed | `dashboard` (borrower email, [L2025](../../server.ts#L2025)), `delinquencies` (email, [L2805](../../server.ts#L2805)), `accountability-bottlenecks` (ID number fragment, [L2852](../../server.ts#L2852)), `chain-of-custody/:assetId`, `stewardship-score/:userId` | restricted, and arguably Director only | **nothing** | `stewardship-score/:userId` is a direct object reference: change the number in the URL to read another person's borrowing record |
| Everything else | the remaining 25 | signed-in roles | **nothing** | Read-only, but they describe the whole institution's equipment and finances |

---

## 5. Sensitive data map

Locations and counts only. No values are reproduced anywhere in these documents.

| Data | Where it exists | Exposure |
|---|---|---|
| Passwords, live accounts | `users.password` column; 113 files under `scratch/backups/` (the newest holds 25 user rows, none hashed); `pending_registrations.json` (1 record) | Committed to git; returned by `GET /api/auth/pending-registrations`; echoed in the `approve-registration` response; printed nowhere, but present in every backup |
| Passwords, demo accounts | [prismaClient.ts#L202-L214](../../src/app/prismaClient.ts#L202-L214) (11 accounts); [reference/AdRIC_DB_Schema.sql](../reference/AdRIC_DB_Schema.sql) seed (14 accounts) | Shipped to every browser; committed; these are working credentials for seeded roles |
| Email addresses | `users.email`; returned by login, `/me`, custodian history, asset reports, transfers, dashboard, delinquencies | Any unauthenticated caller |
| Student and staff ID numbers | `users.id_number`; returned by `/me` and custodian history; partially in accountability analytics | Any unauthenticated caller |
| Profile photos | `users.user_img` as base64; returned with profile responses | Any unauthenticated caller with the email |
| Accountability records (who held what, who was late) | `asset_records`, `asset_loans`, `asset_returns` | Whole registry readable by anyone |
| Database credentials | [prisma.ts#L5-L15](../../prisma.ts#L5-L15) literal fallbacks | Committed |
| Mailgun credentials | environment variables only: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM` | Correctly kept out of the repository. This is the one thing already done right |
| Request bodies including images | `console.log` at [server.ts#L515](../../server.ts#L515) and elsewhere | Terminal scrollback, and any future log file |

- **Simple:** Names, emails, ID numbers, photos and passwords are all reachable without logging in, and the passwords are additionally sitting in the repository. The only secret currently handled correctly is the email service key.

---

## 6. Input handling

### 6.1 Validation

- **Technical:** Validation is per handler, inconsistent, and mostly presence checks. `POST /api/assets` requires only `name` and `category` ([L517](../../server.ts#L517)). Unknown categories are silently rewritten to `DEV_KIT` ([L505-L509](../../server.ts#L505-L509)) rather than rejected. `condition` on returns is checked against a list ([L1336](../../server.ts#L1336)), which is the best example in the file. `progressStatus` on repairs accepts any string ([L1208](../../server.ts#L1208)). Numeric ids are parsed with `parseInt` and checked with `Number.isInteger`, which is sound. Dates are passed to `new Date()` with no validity check, so an invalid date becomes `Invalid Date` and fails at the database layer with a raw error. There is no schema validation library anywhere.
- **Simple:** Each endpoint checks whatever its author remembered to check. Some bad input is corrected silently instead of refused, which hides mistakes.

### 6.2 Injection

- **Technical:** SQL injection risk is low in `server.ts` because every query goes through Prisma's parameterised client and there is no raw SQL in the file. The raw SQL that exists is in `scratch/` scripts with literal strings, not user input. The real injection exposure is **HTML injection** into two sinks: Mailgun message bodies and the QR print window ([ITSDashboard.tsx#L2196-L2212](../../src/app/components/ITSDashboard.tsx#L2196-L2212)). React escapes by default, so the app's own screens are not a cross-site scripting sink, but `printWindow.document.write` bypasses React entirely.
- **Simple:** The database side is protected because of the library we use. The email and print-a-tag features are not, because they build pages out of text people typed.

### 6.3 File and image upload

- **Technical:** Images never reach the server as files. The browser reads them with `FileReader.readAsDataURL` and posts base64 strings, which are stored in `LONGTEXT` columns. The server checks that an asset image looks like a data URL or ends in an image extension ([L523-L526](../../server.ts#L523-L526)), which is a string check, not content inspection: any payload prefixed with `data:image/` passes. Avatar uploads on the account page have no check at all. There is no size limit below the global 50 MB body limit, no image dimension limit, and no malware scanning.
- **Simple:** Pictures are turned into very long pieces of text and stored in the database. The server only glances at the first few characters to decide it is an image.

### 6.4 Payload size and denial of service

- **Technical:** `express.json({ limit: '50mb' })` ([L12](../../server.ts#L12)) applies to every route, including unauthenticated ones. With a connection pool of 20 and endpoints that load nine whole tables per call ([L64-L87](../../server.ts#L64-L87)), a handful of concurrent requests can exhaust both memory and the pool. No rate limiting exists.
- **Simple:** Anyone can send very large requests, and a few heavy page loads at once can stall the server.

### 6.5 Output escaping

- **Technical:** Three classes. React output is escaped automatically. Email HTML is not escaped. The print window is not escaped. Error responses return raw database messages ([L283-L286](../../server.ts#L283-L286)), which is information disclosure rather than injection.
- **Simple:** The website itself is safe. Emails, printed tags, and error messages are not.

---

## 7. Configuration and secrets

| Item | State | Action |
|---|---|---|
| `.env` | Does not exist in this working copy. The app runs entirely on hardcoded fallbacks | Create it, and never commit it. It is already in `.gitignore` |
| `.env.example` | Does not exist | Add it, listing variable **names** only: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_URL`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM`, plus a new `PORT` and a frontend `VITE_API_URL` |
| Two configuration systems | `prisma.ts` reads five `DATABASE_*` variables; `prisma.config.ts` reads `DATABASE_URL`. Neither is set, so the server silently uses fallbacks while the Prisma CLI fails | Use one source of truth, and validate it at startup |
| Hardcoded fallbacks | Connection details including a password in [prisma.ts#L5-L15](../../prisma.ts#L5-L15) | Delete. Fail loudly when a variable is missing |
| Hardcoded port | `const PORT = 4000` ([L4753](../../server.ts#L4753)) | Read from the environment |
| Hardcoded API base URL | Over 20 literals of `http://localhost:4000` in `src/` | Replace with one client reading `VITE_API_URL` |
| CORS | `app.use(cors())`, all origins, all methods | Restrict to the frontend origin, and enable credentials only when a real session exists |
| `.gitignore` | Covers `node_modules`, `dist`, `.env`, `/generated/prisma`, `.vite`, `*.log`. Does **not** cover `scratch/backups/` or `pending_registrations.json` | Add both. This is the single change that prevents the credential leak recurring |
| Cookie flags | None set | Set `HttpOnly`, `SameSite=Lax`, and `Secure` once the session is server-side and served over HTTPS |
| Dependency hygiene | No audit step, no lockfile policy, `allowScripts` entries in `package.json` permit install scripts for five packages | Run `npm audit` as part of the routine described in [01D](01D-restructure-plan.md) |

---

## 8. Data Privacy Act mapping (panel comment D2)

The proposal commits to compliance with the Data Privacy Act of 2012 (Republic Act 10173), including retention and deletion policies for graduating students. This table maps each obligation we took on to what the system actually does today. It is deliberately blunt, because the gap is the point.

| Obligation (our commitment) | System today | Finding |
|---|---|---|
| **Security of personal data** (organizational, physical, technical measures) | No authentication, no authorization, no encryption in transit, no access control on personal data | C-02, C-06 |
| **Confidentiality of credentials** | Passwords stored in clear text, committed to the repository, returned by an open endpoint and in one response body | C-01, C-03, C-04 |
| **Proportionality and minimization** (collect and expose only what is needed) | Endpoints return email, ID number, and photo alongside asset data to any caller; every backup copies the whole users table | Section 5 |
| **Retention limits** (keep only as long as necessary) | No retention fields, no expiry, no archival. 113 point-in-time copies of the user table accumulate with no rotation | H-17, F-39 in 01A |
| **Right to erasure and deletion policy for graduating students** | No account status, no graduation date, no delete or anonymize path. All foreign keys are `NO ACTION`, so a user with any history cannot be deleted at all | D2 in 01-codebase-map |
| **Accuracy and correction rights** | A user can edit their own name and photo, but anyone can edit anyone's, and there is no record of who changed what | 4.1, H-10 |
| **Accountability and audit trail** (demonstrate compliance) | No audit log of any kind. No login records, no approver identity on any decision, and the actor is often guessed as user 1 | H-10 |
| **Breach notification readiness** | Impossible: with no logs and no authentication, we could not determine whether data was accessed, by whom, or when | Section 3.3 |
| **Data sharing and transfers** | Personal data leaves the database in emails and in committed JSON files, with no controls on either | C-01, 2.4 |

- **Simple:** The document promises a set of protections. The system currently provides none of them, and in two places it actively works against them by publishing credentials. Closing D2 honestly means changing the system, not only the proposal.

---

## 9. Prioritized remediation plan

Ordered by risk against effort. No code is written here; each item says what the fix is in principle.

### Tier 1: do immediately, before any further demo

| # | Action | Why first | Effort |
|---|---|---|---|
| 1 | Stop the backup job from including the `users` table, and stop it writing inside the repository at all | It is actively producing new copies of credentials every 6 hours | S |
| 2 | Add `scratch/backups/` and `pending_registrations.json` to `.gitignore`, then remove them from tracking | Prevents recurrence; without this, every later cleanup is undone by the next commit | S |
| 3 | Rotate every password that appears in those files, and the database password in `prisma.ts` | The exposed values must be assumed known | S |
| 4 | Decide with the adviser whether git history needs rewriting, and record the decision | Deleting files does not remove them from history. This is a judgment call about who has cloned the repository | S, plus a decision |
| 5 | Remove the hardcoded connection fallbacks; fail on startup when configuration is missing | Stops the shared database being reachable from the code alone | S |
| 6 | Remove `password` from the `pending-registrations` response and from the `approve-registration` response | Two lines, closes two direct credential leaks | S |
| 7 | Remove the request-body fallback in `approve-registration` | Closes anonymous account creation with arbitrary roles | S |

### Tier 2: do before the next defense

| # | Action | Why | Effort |
|---|---|---|---|
| 8 | Hash passwords with bcrypt or argon2; compare in application code, never in a SQL `WHERE`; exclude the column from every `select` | Makes every remaining exposure survivable | M |
| 9 | Introduce a real session: a signed, `HttpOnly` cookie or a JWT issued at login, validated on every request, with logout invalidating it server-side | Removes the "edit a cookie, become the Director" path | M |
| 10 | Add `requireAuth` middleware applied to every route except login and register-request, then per-route role checks derived from the tables in section 4 | Turns the intended permissions into enforced ones | M |
| 11 | Derive the acting user from the session, not from a typed name, and remove `DEFAULT_CUSTODIAN_ID` as a fallback | Fixes both a security hole and the data integrity problem in H-10 | M |
| 12 | Restrict CORS to the frontend origin; move the port and API base URL into configuration | Closes the cross-origin path and unblocks running the app on two machines | S |
| 13 | Add one error-handling middleware: log the detail, return a generic message and a code | Stops leaking schema details in error strings | S |
| 14 | Escape interpolated values in email bodies and the QR print window | Closes the only injection sinks we have | S |
| 15 | Add an `audit_log` table and write a row for every state change: who, what, when, from where | Required for the Data Privacy Act accountability obligation, and for the panel's chain-of-custody questions | M |
| 16 | Remove the login fallback to the localStorage mock, and delete the seeded demo passwords from the shipped bundle | Removes working credentials from the browser bundle | S |

### Tier 3: do before this system holds real data

| # | Action | Why | Effort |
|---|---|---|---|
| 17 | Serve over HTTPS and set `Secure` on cookies | Credentials and personal data currently cross the network in the clear | M |
| 18 | Add rate limiting and lockout on login, and a password reset flow | Nothing currently stops guessing, and nothing helps a user who forgets | M |
| 19 | Implement retention and deletion: an account lifecycle status, a graduation or end date, and an anonymize routine that preserves custody history while removing personal identifiers | This is the D2 commitment, and it needs schema work in Phase 3 | L |
| 20 | Move images out of the database to object or file storage with size and type checks, and lower the 50 MB body limit | Removes the memory and pool exhaustion surface | M |
| 21 | Scope every query by the caller's lab or ownership, server-side, replacing the client-side fuzzy matching | Stops one lab reading another's records | M |
| 22 | Add dependency auditing and a review step for new packages | The install-script allowlist in `package.json` currently permits five packages to run code at install time | S |

- **Simple:** Do the seven small things in Tier 1 this week, because they are mostly deletions and they stop the bleeding. Tier 2 is the real work of adding a lock to the door, and it should be done before you stand in front of the panel again. Tier 3 is what you would need before this system ever holds real student records.
