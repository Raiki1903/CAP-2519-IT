# Task #176: bigger demo seed for the final deploy (CAP1DEF comment 10)

Model: Opus 5.5, effort High.

You work in the worktree `C:\dev\CAP-2519-IT-seed`, branch `feat/176-demo-seed` (from `origin/main` `475ff20c`). Another Claude Code session works in `C:\dev\CAP-2519-IT` on `web/` files at the same time: don't touch `web/`. Both sessions use the same local test database, so **ask Raiki before every `npm test`**.

**Commit 1:** this file, `docs/tasks/176-demo-seed.md`, as it is (`docs(tasks): add the demo seed brief (#176)`).

## Goal

Replace the small demo seed (11 accounts, 12 assets) with one that makes every screen look used: about 28 accounts, about 60 assets in all 10 labs, about 6 months of history. It still runs only through `npm run seed` on an empty local database, in one transaction; `seedTarget.ts` and `checkDatabase` stay as they are. **This is the database we deploy tonight,** so every row must follow `docs/contracts/lifecycle.md` exactly as if the app had written it.

## Hard rules

- **Made-up people only.** Every account is `demo.*@dlsu.edu.ph` with first name "Demo". Never copy a person's name, a "c/o" note, or a property code from TSG's Excel. Project leaders are demo Lab Heads' display names.
- Don't read the pre-UAT dump, `.env`, or anything outside the repo. The Excel facts you need are below.
- No schema, migration or package change. Files: `prisma/seed.ts`, `prisma/seedData.ts` (split into more files under `prisma/` if it gets long, for example `prisma/seedHistory.ts`), `tests/db/demoSeed.test.ts`, `docs/guides/DATABASE-MIGRATIONS.md` (the line the seed prints), `AGENTS.md` (the test count, which is stale at 888). Ask before any other file.
- **Keep the 11 existing emails** with their roles, labs and heads (smoke tests and manuals use them). `demo.researcher.a` keeps an On Loan asset; `demo.pending` stays Pending.
- **Dates:** purchase dates are fixed (from the Excel). Everything that must look current (loans, tickets, warranties, inspections, remarks, log rows) is relative to the day the seed runs, so the insights fire on deploy day and for a few weeks after.
- Repo rules as usual: CODE-COMMENTS.md, one change per commit, no em dashes.

## Accounts (about 28)

- Keep 1 to 11. Add a made-up Lab Head for each of the 8 labs without one: `demo.labhead.<shortcode in lower case>@dlsu.edu.ph`, Researcher role, FACULTY, member of the lab, set as its `head_user_id`.
- About 10 more researchers (`demo.researcher.d` onward), FACULTY and STUDENT mixed, spread over all 10 labs, 3 of them in two labs.
- One INACTIVE researcher (deactivated by the IT Admin, no open loan, some old returned loans). One REJECTED sign-up. One anonymized former researcher with old loans, written exactly the way `anonymizeUser` in `users.repository.ts` leaves the row.
- `status_decided_by_id` and `status_decided_at` set (the IT Admin) on every approved, rejected or deactivated account.

## Assets (about 60), from TSG's Excel

**Labs:** COMET is HXIL's old name; GameLab is GAME. The ADRIC, SJ212, RL208 and CCS Capex sheets are only a source of models for labs with few rows. Bio has no sheet: give it ADRIC dev kits and a workstation.

**Rough count per lab:** TE3D 9, CNIS 7, GAME 7, CITe4D 7, HXIL 6, CeHCI 5, CAR 5, CIVI 4, CeLT 4, Bio 4. At most 3 units of one model per lab.

**Models per sheet** (category, purchase date):
- CITe4D: Xiaomi Mi 360 Home Security Camera 2K (CAMERA, 2022-09-09); SanDisk 32GB microSD for the camera (MEMORY_CARD, 2022-09-09); LG UHD 65" TV (TV, AY 2021-22); Epson EB-X51 projector (PROJECTOR, 2023-03-13); Sony ICD-UX570 voice recorder (RECORDER, 2023-02-20); Canon PowerShot SX620 (CAMERA, AY 2022-23).
- CAR: ViewPlus MM-27KI 27" 2K IPS monitor (MONITOR, 2024-02-22).
- CeLT: LG UHD 65" TV (AY 2021-22).
- CeHCI: LG UHD 65" TV; HP Z2 Tower G9 workstation (CPU, 2024-08-15).
- CIVI: Acer Nitro ED320QR 31.5" curved monitor (MONITOR, 2024-03-18); Lenovo Legion Tower 7i Gen 8 (CPU, 2024-06-16).
- CNIS: LG UHD 65" TV; MikroTik RB952Ui-5ac2nD router (ROUTER, 2024-05-29); Arduino Sensor Kit, Raspberry Pi 4 8GB, ESP32 dev board (DEV_KIT, 2024-05-29).
- HXIL (COMET): LG UHD 65" TV; Mac mini M2 (CPU, 2023-09-15); Logitech G29 racing wheel (SIMULATOR, 2023-03-14); Wheel Stand Pro (SIMULATOR, 2023-07-07).
- GAME: Wacom Intuos Draw CTL-490 (TABLET, 2023-03-28); LG UHD 65" TV; Meta Quest 2 (VR, AY 2022-23); HP Z2 Tower G9 (CPU, 2024-08-15).
- TE3D: Canon Pixma G3020 (PRINTER, 2022-09-09); LG UHD 65" TV; Linksys LGS3G2C 48-port switch (SWITCH, 2022-07-02); WD My Book 8TB and Seagate One Touch 1TB (HARD_DRIVE, 2022-09-09); Focusrite Scarlett Solo 3rd Gen (AUDIO, 2023-05-05); Wacom Intuos Medium (TABLET, 2023-06-01); Sony HDR-CX405 Handycam (VIDEO_CAMERA, 2024-05-30); Maono AU-BM10 boundary microphone (AUDIO, 2024-05-30); JBL Flip 6 (SPEAKER, 2024-05-30).
- Extra models: ADRIC (DEV_KIT, 2024): Jetson Nano, Jetson AGX Orin, Raspberry Pi 4 4GB, Arduino Uno, ESP32-CAM, Raspberry Pi Camera v2, LD06 LiDAR. RL208 (AY 2018-19): Cisco SG350-52 switch, Acer Predator PO5-615s (CPU), Acer Nitro VG240Y 23.8" monitor, MakerBot Replicator (PRINTER), Samsung 43" UA43RU7100 TV. SJ212 and CCS Capex: Wacom Intuos Wireless, One by Wacom Medium and Small (TABLET).

**Skip:** whiteboards, extension and power cords, UPS, cables, software (MaxQDA), the projector screen, the Hakko rework station. **The HP keyboard and mouse** go in the workstation's accessories ("keyboard, mouse"), not as assets.

**Every asset:** tag `<ShortCode>-0001` upward per lab (the app's numbering continues from the highest); invented serial; manufacturer; a made-up but realistic acquisition value in PHP; procurement date (the Excel date, or August of the academic year when blank); warranty 1 to 3 years after purchase; home room (Excel rooms where a sheet has one: CeLT G409, CeHCI G402, CNIS G403, HXIL G406, GAME G411; otherwise invent one in the same style); a funding source; an invented ITS property tag in the Excel's format (3 digits, dash, 6 digits) on about half; accessories where they make sense.

- **Projects:** 6 or 7, over at least 5 labs (invented code and name, leader = a demo Lab Head's display name, funding source, start and end dates). About 20 assets point to one; some loans carry `project_id`.
- **Funding:** spread over DOST-PCIEERD, DOST-SEI, CHED, Internal Grants and DOST; exactly 2 assets on "Personal (self-funded)".
- **Photos:** every asset gets a small generated SVG (the category name and a simple shape on a plain colour, under 2 KB) as a `data:image/svg+xml;base64,...` URL in `image_url`. One SVG per category is fine. No downloaded pictures.

## Status mix and history

- About 45 Available, 6 On Loan (one of them Return Requested), 3 Maintenance, 1 Pending Retirement, 2 Retired, 1 Missing.
- Open requests on Available assets: 2 Pending Approval, 1 Pending Release (approved by the home Head).
- **Loans, about 6 months:** about 100 Returned loans over the last 26 weeks, 2 to 6 a week, with 2 or 3 busier weeks, plus a few Declined and Cancelled. Every released loan: decided by the home lab's Head at that time (the HEAD_CHANGED row says when a Head changed), released and received by a TSG account, destination one of the borrower's labs, LOAN_RELEASE and RETURN inspections linked on the loan, `closed_at` set. No two loans of one asset overlap. Lab Heads don't borrow. Nothing happens to an asset after it is Retired.
- **Maintenance:** about 12 tickets in 6 months, mostly Resolved with a MAINTENANCE completion inspection. The 3 open ones: INSPECTING, REPAIRING, EXTERNAL_SERVICE (an asset under warranty, provider as the warranty rule writes it). One RETURN_DAMAGE from a damaged return. One BEYOND_REPAIR that led to a retirement.
- **Retirement:** 2 COMPLETED (Director or Secretary decides, TSG completes, pathway and disposition reference set, so the Disposal Record page prints), 1 PENDING, 1 DENIED (previous status restored). The requester never decides.
- **Missing:** 1 asset; its loan ENDED_BY_LOSS; an ASSET_MARKED_MISSING log row.
- **Inspections:** INITIAL at registration for every asset; ROUTINE ones so the routine queue shows some assets due and some done; health scores that match the condition; `asset_inspection_metrics` rows for categories that have metrics. Most assets keep a steady condition.
- **Remarks:** about 10 `asset_remarks` by allowed authors (TSG, Director, Secretary, the home Lab Head), one soft-deleted.
- **Module 6:** about 8 `user_tickets` over all types and statuses (resolved ones with remarks, resolved by the IT Admin). `activity_log` rows as the services write them (copy their details texts): LOGIN_SUCCESS, LOGIN_FAILURE (no typed email stored), SIGNUP_APPROVED, SIGNUP_REJECTED, one ROLE_CHANGED, one LABS_CHANGED, one HEAD_CHANGED, USER_DEACTIVATED, USER_ANONYMIZED, TICKET_STATUS_CHANGED, ASSET_REGISTERED per asset, CLEARANCE_RECORD_PRINTED.

## Insights (`server/features/analytics/insights.rules.ts`)

Each rule fires on 2 to 4 assets, no more, so the Insights panels aren't flooded:
- WAR-01: warranties ending in about 10, 25 and 60 days.
- LOAN-02: one held loan about 10 days past return-by, one about 20 days past.
- REP-03: one asset with 3 tickets in 180 days (one still open), one with 3 all resolved.
- LIFE-04: 2 or 3 old monitors or dev kits past their months (the RL208 models from 2019 work).
- COND-05: 2 or 3 assets whose newest TSG inspection is worse than the one before (one Critical Defect). Careful: every loan writes 2 inspections, so random conditions would fire this on dozens of assets.

## Tests

Extend `tests/db/demoSeed.test.ts` (it runs the seed on the emptied test database). Keep its two tests. Add: counts in range; one of every asset status; every On Loan asset has exactly one held loan, every Maintenance asset one open ticket, every Pending Retirement asset one PENDING retirement; no overlapping loans on one asset; every loan's decider is the home lab's Head at that time; every destination is one of the borrower's labs; every email starts with `demo.` (except the anonymized row's placeholder); each insight rule fires 1 to 4 times (call the insight rules or service on the seeded rows).

## Stops

1. **Plan:** check the facts above against the code (what each service writes per step, the anonymized row, the log details texts, the routine queue rule, the warranty provider text). List the files and ask your questions in the AGENTS.md format. Stop.
2. **Build:** one change per commit. Typecheck (must stay 25), build, `npm test` (ask Raiki first). Report what the seed prints. Stop.
3. **Hand checks:** give Raiki one-line PowerShell commands to drop and recreate `adric_uat_check`, run `migrate deploy` and the seed on it (Raiki types the passwords), then checks H1 to H10, **read-only** (only looking at screens), across Staff, Lab Head, Researcher, Director, Secretary and IT Admin: Overview cards, Inventory with photos, an asset modal with history, remarks, project and present value, Loans tabs, Analytics loans per week and Insights, a Disposal Record print, IT Admin Users, Activity Log, Tickets. Read-only, because Raiki dumps this same database for the deploy. Stop.

## Addendum (Raiki, 16:44): use the pre-UAT dump for names and photos

Raiki says the pre-UAT dump is dummy data, so the seed may use it. This replaces the "first name Demo" part of "Made-up people only", the "Don't read the pre-UAT dump" rule and the Photos line above. The Excel rule (no names or property codes from it) still holds. Raiki tells you where the dump is.

- **Read it only with a script you write outside the repo** (for example in `C:\dev\uat-data\`). The script prints only what you need: asset names, categories and photos, and people's first and last names. Never print, copy or save passwords, emails or ID numbers. Don't load the dump into any database.
- **Names:** new accounts may use first and last names from the dump. Emails stay `demo.*@dlsu.edu.ph`. The 11 existing accounts keep their names. The repo is public, so skip any name that looks like a real person (a team member, an adviser, a Lab Head, a TSG staff member) and anything that looks like a joke.
- **Photos stay out of the repo** (it's public, and the photos are big). The script saves the dump's asset photos as files in `C:\dev\uat-data\seed-photos\`, named by a short key such as `mac-mini.jpg`. Look at each one and keep only real equipment: delete test pictures, people, anime or cartoon art, toys (the Gundam), memes. Shrink any photo over 200 KB to 1280 px on the long side, JPEG quality 0.8 (the same as `compressImage.ts`), with a PowerShell `System.Drawing` step in that same outside script. If a photo can't be shrunk, drop it.
- **The seed** reads an optional `SEED_PHOTOS_DIR` (the same way it reads `SEED_PASSWORD`). Each asset in `seedData.ts` can name a photo key. If the folder is set and the file is there, `image_url` becomes that JPEG as a `data:image/jpeg;base64,...` URL. Otherwise it falls back to the generated SVG. Tests run without the folder, so they use the SVGs. Write the variable into `DATABASE-MIGRATIONS.md` next to `SEED_PASSWORD`.
- **AGENTS.md counts:** the screen review branch brings typecheck down to 21. At the end, pull `main` into this branch, then set both counts in `AGENTS.md` (typecheck and tests) to what your final run shows.
