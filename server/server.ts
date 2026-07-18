// server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/prisma/client.js'; // ⚠️ Matches your seed.ts import path

const app = express();

// 1. Configure Middleware
app.use(cors());
app.use(express.json());

// 2. Initialize Driver Adapter for MariaDB / MySQL
const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST || 'localhost',
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || 'Barbatos@08', // Matches your DB credentials
    database: process.env.DATABASE_NAME || 'AdRIC_DB',
});

const prisma = new PrismaClient({ adapter });

// TODO: replace with the actual logged-in user's id once auth/session is wired up.
// asset_records.current_custodian is a required FK to users.user_id — the intake
// form doesn't collect this yet, so every asset is provisionally logged under this id.
const DEFAULT_CUSTODIAN_ID = 1;

// Fail loudly and immediately if DEFAULT_CUSTODIAN_ID doesn't exist, instead of
// letting every asset write crash later with an opaque FK constraint error.
async function assertDefaultCustodianExists() {
    const user = await prisma.users.findUnique({ where: { user_id: DEFAULT_CUSTODIAN_ID } });
    if (!user) {
        console.error(
            `\n❌ Startup check failed: no user with user_id = ${DEFAULT_CUSTODIAN_ID} exists in the 'users' table.\n` +
            `   asset_records.current_custodian is a required foreign key, so asset writes will fail until this is fixed.\n` +
            `   Run: SELECT user_id, first_name, last_name FROM users;  to see valid ids, then update DEFAULT_CUSTODIAN_ID.\n` +
            `   If the users table is empty, insert at least one user row first.\n`
        );
    } else {
        console.log(`✅ Default custodian check passed: user_id ${user.user_id} (${user.first_name} ${user.last_name})`);
    }
}

// 2.5 Setup GET route to fetch and map assets from the MySQL database
app.get('/api/assets', async (req: Request, res: Response): Promise<void> => {
    try {
        const dbAssets = await prisma.assets.findMany();
        const dbMonetaries = await prisma.asset_monetary.findMany();
        const dbRecords = await prisma.asset_records.findMany({
            orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }]
        });
        const dbUsers = await prisma.users.findMany();
        // Needed to surface due dates on the borrower's "My Assets" list —
        // approved loans are the source of truth for when a device is due back.
        const dbLoans = await prisma.asset_loans.findMany({
            where: { status: "approved" },
            orderBy: { loaned_on: "desc" },
        });

        const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        const formatted = dbAssets.map(asset => {
            const monetary = dbMonetaries.find(m => m.asset_id === asset.asset_id);

            // Get the latest log entry for this asset
            const records = dbRecords.filter(r => r.asset_id === asset.asset_id);
            const latestRecord = records[0];

            let custodianName = "";
            let status = "Active";
            let location = "Manila";
            let lab = "CITe4D";
            let borrowedOn: string | undefined;
            let dueDate: string | undefined;
            let daysLeft: number | undefined;

            if (latestRecord) {
                const custodian = dbUsers.find(u => u.user_id === latestRecord.current_custodian);
                if (custodian) {
                    custodianName = `${custodian.first_name} ${custodian.last_name}`;
                }

                const st = latestRecord.status;
                if (st === "ACTIVE") status = "Active";
                else if (st === "ON_LOAN") status = "On Loan";
                else if (st === "MAINTENANCE") status = "Maintenance";
                else if (st === "DISPOSED") status = "Disposed";

                const parts = latestRecord.location.split(" — ");
                if (parts[0]) location = parts[0];
                if (parts[1]) lab = parts[1];

                // On loan: pull borrowedOn/dueDate from the matching approved loan
                // (the one whose borrower is the asset's current custodian) so the
                // custodian's dashboard can show the countdown/overdue state.
                if (st === "ON_LOAN") {
                    const loan = dbLoans.find(l => l.asset_id === asset.asset_id && l.borrower_id === latestRecord.current_custodian);
                    if (loan) {
                        borrowedOn = formatDate(loan.loaned_on);
                        dueDate = formatDate(loan.due_date);
                        daysLeft = Math.ceil((loan.due_date.getTime() - Date.now()) / MS_PER_DAY);
                        if (daysLeft < 0) status = "Overdue";
                    }
                }
            }

            return {
                id: asset.asset_tag,
                name: asset.name,
                serial: asset.serial_number || "",
                manufacturer: asset.manufacturer || "",
                category: asset.category,
                funding: monetary?.funding_source || "Unspecified",
                cost: monetary ? Number(monetary.acquisition_value) : 0,
                procured: asset.procurement_date ? asset.procurement_date.toISOString().split("T")[0] : "",
                warranty: asset.warranty_expiry ? asset.warranty_expiry.toISOString().split("T")[0] : "",
                location,
                lab,
                status,
                condition: 100,
                custodian: custodianName || undefined,
                borrowedOn,
                dueDate,
                daysLeft,
            };
        });

        res.json({ success: true, assets: formatted });
    } catch (error: any) {
        console.error("❌ Failed to fetch assets:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 3. Setup the endpoint the ITSDashboard intake wizard (handleSubmit) posts to
app.post('/api/assets', async (req: Request, res: Response): Promise<void> => {
    try {
        const data = req.body;
        console.log("🚀 Server received raw payload:", data);

        if (!data.name || !data.category) {
            res.status(400).json({ success: false, error: "Missing required fields: name,  category." });
            return;
        }

        // Generate a unique asset tag (assets.asset_tag is required + unique)
        const assetTag = `EQ-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

        // assets / asset_monetary / asset_records are written together so a
        // failure on any one of them rolls back the whole registration.
        const { asset } = await prisma.$transaction(async (tx) => {
            const asset = await tx.assets.create({
                data: {
                    asset_tag: assetTag,
                    name: data.name,
                    category: data.category,
                    serial_number: data.serial || null,
                    manufacturer: data.manufacturer || null,
                    procurement_date: data.procured ? new Date(data.procured) : null,
                    warranty_expiry: data.warranty ? new Date(data.warranty) : null,
                },
            });

            await tx.asset_monetary.create({
                data: {
                    asset_id: asset.asset_id,
                    funding_source: data.funding || "Unspecified",
                    // TODO: intake form has no acquisition-cost field yet — defaulting to 0
                    acquisition_value: data.acquisitionValue ?? 0,
                },
            });

            await tx.asset_records.create({
                data: {
                    asset_id: asset.asset_id,
                    status: "ACTIVE",
                    // Combines the campus dropdown + lab group since assets has no direct center_id column
                    location: [data.location, data.lab].filter(Boolean).join(" — ") || "Unassigned",
                    current_custodian: data.custodianId ?? DEFAULT_CUSTODIAN_ID,
                },
            });

            return { asset };
        });

        console.log("✅ Asset saved to MySQL successfully:", asset.asset_id, assetTag);
        res.json({ success: true, asset });
    } catch (error: any) {
        console.error("❌ MySQL Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 4. Edit an existing asset (EditAssetDialog -> handleSave)
app.put('/api/assets/:assetTag', async (req: Request<{ assetTag: string }>, res: Response): Promise<void> => {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        console.log(`🚀 Server received update for ${assetTag}:`, data);

        const existing = await prisma.assets.findUnique({ where: { asset_tag: assetTag } });
        if (!existing) {
            res.status(404).json({ success: false, error: `No asset found with tag ${assetTag}.` });
            return;
        }

        // Local demo data identifies a custodian by name (e.g. "Dr. Juan Dela Cruz");
        // the schema needs a real users.user_id. Best-effort lookup by combined name —
        // if nothing matches, the existing custodian on the record is left untouched.
        let custodianId: number | undefined;
        if (data.custodian) {
            const [first, ...rest] = String(data.custodian).replace(/^Dr\.\s*/i, "").split(" ");
            const match = await prisma.users.findFirst({
                where: { first_name: first, last_name: rest.join(" ") },
            });
            if (match) custodianId = match.user_id;
        }

        const updated = await prisma.$transaction(async (tx) => {
            const asset = await tx.assets.update({
                where: { asset_id: existing.asset_id },
                data: {
                    name: data.name,
                    serial_number: data.serial || null,
                    manufacturer: data.manufacturer || null,
                    category: data.category,
                    procurement_date: data.procured ? new Date(data.procured) : null,
                    warranty_expiry: data.warranty ? new Date(data.warranty) : null,
                },
            });

            await tx.asset_monetary.upsert({
                where: { asset_id: existing.asset_id },
                update: { funding_source: data.funding || "Unspecified" },
                create: {
                    asset_id: existing.asset_id,
                    funding_source: data.funding || "Unspecified",
                    acquisition_value: data.acquisitionValue ?? 0,
                },
            });

            // asset_records is an append-style log — edit the most recent entry
            // for this asset rather than rewriting history.
            const latestRecord = await tx.asset_records.findFirst({
                where: { asset_id: existing.asset_id },
                orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }],
            });

            const recordData = {
                status: (data.status?.toUpperCase().replace(" ", "_") || latestRecord?.status || "ACTIVE") as any,
                location: [data.location, data.lab].filter(Boolean).join(" — ") || latestRecord?.location || "Unassigned",
                current_custodian: custodianId ?? latestRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID,
            };

            if (latestRecord) {
                await tx.asset_records.update({ where: { asset_record_id: latestRecord.asset_record_id }, data: recordData });
            } else {
                await tx.asset_records.create({ data: { asset_id: existing.asset_id, ...recordData } });
            }

            return asset;
        });

        console.log("✅ Asset updated in MySQL successfully:", updated.asset_id);
        res.json({ success: true, asset: updated });
    } catch (error: any) {
        console.error("❌ MySQL Update Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 5. Delete an asset (Delete Confirmation Dialog)
app.delete('/api/assets/:assetTag', async (req: Request<{ assetTag: string }>, res: Response): Promise<void> => {
    try {
        const { assetTag } = req.params;
        console.log(`🚀 Server received delete request for ${assetTag}`);

        const existing = await prisma.assets.findUnique({ where: { asset_tag: assetTag } });
        if (!existing) {
            res.status(404).json({ success: false, error: `No asset found with tag ${assetTag}.` });
            return;
        }

        // No ON DELETE CASCADE is defined in the schema, so every table with an
        // asset_id FK has to be cleared out first or this fails on a constraint error.
        await prisma.$transaction(async (tx) => {
            const id = existing.asset_id;
            await tx.asset_records.deleteMany({ where: { asset_id: id } });
            await tx.asset_monetary.deleteMany({ where: { asset_id: id } });
            await tx.asset_loans.deleteMany({ where: { asset_id: id } });
            await tx.asset_repairs.deleteMany({ where: { asset_id: id } });
            await tx.asset_transfers.deleteMany({ where: { asset_id: id } });
            await tx.asset_returns.deleteMany({ where: { asset_id: id } });
            await tx.asset_disposals.deleteMany({ where: { asset_id: id } });
            await tx.assets.delete({ where: { asset_id: id } });
        });

        console.log("✅ Asset deleted from MySQL successfully:", assetTag);
        res.json({ success: true });
    } catch (error: any) {
        console.error("❌ MySQL Deletion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 6. Log an equipment loan request (AssetDetailModal -> LoanForm handleSubmit)
app.post('/api/assets/:assetTag/borrow', async (req: Request<{ assetTag: string }>, res: Response): Promise<void> => {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        console.log(`🚀 Server received loan request for ${assetTag}:`, data);

        if (!data.borrower || !data.purpose || !data.dueDate) {
            res.status(400).json({ success: false, error: "Missing required fields: borrower, purpose, dueDate." });
            return;
        }

        const existing = await prisma.assets.findUnique({ where: { asset_tag: assetTag } });
        if (!existing) {
            res.status(404).json({ success: false, error: `No asset found with tag ${assetTag}.` });
            return;
        }

        // LoanForm collects the borrower as a free-text name (e.g. "A. Dela Cruz"), same
        // convention EditAssetDialog already uses for custodian — best-effort lookup by
        // combined name, falling back to DEFAULT_CUSTODIAN_ID if nothing matches.
        // asset_loans.borrower_id is a required FK, so this always needs a resolved id.
        let borrowerId = DEFAULT_CUSTODIAN_ID;
        const [first, ...rest] = String(data.borrower).replace(/^Dr\.\s*/i, "").split(" ");
        const match = await prisma.users.findFirst({
            where: { first_name: first, last_name: rest.join(" ") },
        });
        if (match) borrowerId = match.user_id;

        // Only the asset_loans row (the approval-pipeline record) is written here.
        // Custody does NOT move to the borrower yet — asset_records stays untouched
        // until the Lab Head approves this request via PUT /api/asset_loans/:id/decision,
        // so the asset keeps showing under its current custodian while the request is pending.
        const loan = await prisma.asset_loans.create({
            data: {
                asset_id: existing.asset_id,
                borrower_id: borrowerId,
                purpose: data.purpose,
                due_date: new Date(data.dueDate),
                status: "pending",
            },
        });

        console.log("✅ Loan request logged in MySQL successfully:", loan.loan_id, assetTag);
        res.json({ success: true, loan });
    } catch (error: any) {
        console.error("❌ MySQL Loan Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 7. Fetch all equipment loan/borrow requests (LabHeadDashboard custody tab)
app.get('/api/asset_loans', async (req: Request, res: Response): Promise<void> => {
    try {
        const dbLoans = await prisma.asset_loans.findMany({ orderBy: { loaned_on: 'desc' } });
        const dbAssets = await prisma.assets.findMany();
        const dbUsers = await prisma.users.findMany();
        const dbRecords = await prisma.asset_records.findMany({ orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }] });

        const formatted = dbLoans.map(loan => {
            const asset = dbAssets.find(a => a.asset_id === loan.asset_id);
            const borrower = dbUsers.find(u => u.user_id === loan.borrower_id);

            // Use the asset's latest logged record purely to derive campus/lab for
            // branch-scoping the request card (mirrors the "Campus — Lab" convention
            // used elsewhere) — it does not reflect loan status.
            const latestRecord = dbRecords.find(r => r.asset_id === loan.asset_id);
            const [campus, lab] = (latestRecord?.location || "Unassigned").split(" — ");

            let status: "Pending" | "Approved" | "Declined" = "Pending";
            if (loan.status === "approved") status = "Approved";
            else if (loan.status === "declined") status = "Declined";

            return {
                id: `LOAN-${loan.loan_id}`,
                loanId: loan.loan_id,
                assetId: asset?.asset_tag || "",
                asset: asset?.name || "",
                borrower: borrower ? `${borrower.first_name} ${borrower.last_name}` : "",
                purpose: loan.purpose,
                requestedOn: loan.loaned_on.toISOString().split("T")[0],
                dueDate: loan.due_date.toISOString().split("T")[0],
                status,
                location: campus || "",
                lab: lab || "",
            };
        });

        res.json({ success: true, loans: formatted });
    } catch (error: any) {
        console.error("❌ Failed to fetch loans:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 8. Approve or decline a pending loan/borrow request (LabHeadDashboard -> decideLoan)
app.put('/api/asset_loans/:loanId/decision', async (req: Request<{ loanId: string }>, res: Response): Promise<void> => {
    try {
        const loanId = parseInt(req.params.loanId, 10);
        const { decision } = req.body as { decision?: string };
        console.log(`🚀 Server received loan decision for #${loanId}:`, decision);

        if (!Number.isInteger(loanId)) {
            res.status(400).json({ success: false, error: "Invalid loan id." });
            return;
        }
        if (decision !== "approve" && decision !== "decline") {
            res.status(400).json({ success: false, error: "decision must be 'approve' or 'decline'." });
            return;
        }

        const loan = await prisma.asset_loans.findUnique({ where: { loan_id: loanId } });
        if (!loan) {
            res.status(404).json({ success: false, error: `No loan found with id ${loanId}.` });
            return;
        }
        if (loan.status !== "pending") {
            res.status(400).json({ success: false, error: `Loan #${loanId} has already been ${loan.status}.` });
            return;
        }

        // asset_loans (approval status) and asset_records (append-only custody log)
        // are updated together so a failure on either rolls back the whole decision.
        const updatedLoan = await prisma.$transaction(async (tx) => {
            const newLoanStatus = decision === "approve" ? "approved" : "declined";
            const updated = await tx.asset_loans.update({
                where: { loan_id: loanId },
                data: { status: newLoanStatus },
            });

            if (decision === "approve") {
                // This is the actual custody handoff: /borrow only logged the
                // request, so the asset is still with its prior custodian until
                // now. Append a new asset_records entry moving it to the borrower.
                // Location carries forward from the latest record — the loan form's
                // destination lab isn't persisted on asset_loans, so we don't have
                // a new location to move it to here.
                const latestRecord = await tx.asset_records.findFirst({
                    where: { asset_id: loan.asset_id },
                    orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }],
                });

                await tx.asset_records.create({
                    data: {
                        asset_id: loan.asset_id,
                        status: "ON_LOAN",
                        location: latestRecord?.location ?? "Unassigned",
                        current_custodian: loan.borrower_id,
                    },
                });
            }
            // On decline, asset_records is untouched — custody never left the
            // prior custodian in the first place, so there's nothing to revert.

            return updated;
        });

        console.log(`✅ Loan #${loanId} ${decision}d successfully.`);
        res.json({ success: true, loan: updatedLoan });
    } catch (error: any) {
        console.error("❌ MySQL Loan Decision Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 9. Log a repair/maintenance request against an asset (RepairForm -> handleSubmit,
//    and ReturnForm -> handleSubmit when a custodian flags the item on return).
//    This is the shared function referenced from both forms.
app.post('/api/assets/:assetTag/repair', async (req: Request<{ assetTag: string }>, res: Response): Promise<void> => {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        console.log(`🚀 Server received repair request for ${assetTag}:`, data);

        if (!data.description || !String(data.description).trim()) {
            res.status(400).json({ success: false, error: "Missing required field: description." });
            return;
        }

        const existing = await prisma.assets.findUnique({ where: { asset_tag: assetTag } });
        if (!existing) {
            res.status(404).json({ success: false, error: `No asset found with tag ${assetTag}.` });
            return;
        }

        // Same free-text-name -> user_id lookup convention used by /borrow and
        // EditAssetDialog's custodian field, falling back to DEFAULT_CUSTODIAN_ID.
        let reporterId = DEFAULT_CUSTODIAN_ID;
        if (data.reportedBy) {
            const [first, ...rest] = String(data.reportedBy).replace(/^Dr\.\s*/i, "").split(" ");
            const match = await prisma.users.findFirst({
                where: { first_name: first, last_name: rest.join(" ") },
            });
            if (match) reporterId = match.user_id;
        }

        const repair = await prisma.asset_repairs.create({
            data: {
                asset_id: existing.asset_id,
                reported_by_id: reporterId,
                issue_description: data.description,
                is_immediate: !!data.isImmediate,
                progress_status: data.isImmediate ? "Awaiting Immediate Dispatch" : "Pending TSG Review",
            },
        });

        console.log("✅ Repair request logged in MySQL successfully:", repair.repair_id, assetTag);
        res.json({ success: true, repair });
    } catch (error: any) {
        console.error("❌ MySQL Repair Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 10. Fetch all repair/maintenance requests (ITSDashboard queue)
app.get('/api/asset_repairs', async (req: Request, res: Response): Promise<void> => {
    try {
        const dbRepairs = await prisma.asset_repairs.findMany({ orderBy: { created_at: 'desc' } });
        const dbAssets = await prisma.assets.findMany();
        const dbUsers = await prisma.users.findMany();

        const formatted = dbRepairs.map(repair => {
            const asset = dbAssets.find(a => a.asset_id === repair.asset_id);
            const reporter = dbUsers.find(u => u.user_id === repair.reported_by_id);

            return {
                id: `MNT-${repair.repair_id}`,
                repairId: repair.repair_id,
                assetId: asset?.asset_tag || "",
                asset: asset?.name || "Unknown Asset",
                reportedBy: reporter ? `${reporter.first_name} ${reporter.last_name}` : "Unknown",
                description: repair.issue_description,
                isImmediate: repair.is_immediate,
                progressStatus: repair.progress_status,
                createdAt: repair.created_at.toISOString(),
            };
        });

        res.json({ success: true, repairs: formatted });
    } catch (error: any) {
        console.error("❌ Failed to fetch repairs:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 11. Update a repair ticket's progress status (ITSDashboard -> Acknowledge &
//     Assign Technician, and RepairProgressDialog -> Update Progress). There's
//     no separate "acknowledged" flag in the schema — the ITSDashboard treats
//     any progress_status other than the two initial values /repair sets
//     ("Pending TSG Review" / "Awaiting Immediate Dispatch") as acknowledged.
//     This also moves the underlying asset in/out of MAINTENANCE to match:
//     acknowledging (or any in-progress status) puts it into MAINTENANCE;
//     "Fixed & Completed" hands it back to whoever reported the issue as
//     ON_LOAN (not ACTIVE) — ACTIVE means "available in the pool, nobody
//     holding it," which made AssetDetailModal show the Loan/pool button set
//     instead of the custody actions (Return Asset, Request Repair, etc.)
//     for a custodian who actually still has the device in hand.
const MAINTENANCE_STATUSES = ["Inspection Phase", "Warranty Holder Possession", "Third-Party Repairer Possession"];

app.put('/api/asset_repairs/:repairId', async (req: Request<{ repairId: string }>, res: Response): Promise<void> => {
    try {
        const repairId = parseInt(req.params.repairId, 10);
        const { progressStatus } = req.body as { progressStatus?: string };
        console.log(`🚀 Server received repair status update for #${repairId}:`, progressStatus);

        if (!Number.isInteger(repairId)) {
            res.status(400).json({ success: false, error: "Invalid repair id." });
            return;
        }
        if (!progressStatus || !String(progressStatus).trim()) {
            res.status(400).json({ success: false, error: "Missing required field: progressStatus." });
            return;
        }

        const existing = await prisma.asset_repairs.findUnique({ where: { repair_id: repairId } });
        if (!existing) {
            res.status(404).json({ success: false, error: `No repair ticket found with id ${repairId}.` });
            return;
        }

        // asset_repairs (the ticket) and asset_records (the asset's actual
        // status) are updated together so a failure on either rolls back both.
        const repair = await prisma.$transaction(async (tx) => {
            const repair = await tx.asset_repairs.update({
                where: { repair_id: repairId },
                data: { progress_status: progressStatus },
            });

            const desiredStatus = progressStatus === "Fixed & Completed"
                ? "ON_LOAN"
                : MAINTENANCE_STATUSES.includes(progressStatus)
                    ? "MAINTENANCE"
                    : null;

            if (desiredStatus) {
                const latestRecord = await tx.asset_records.findFirst({
                    where: { asset_id: existing.asset_id },
                    orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }],
                });

                // Skip if the asset is already in the target status — avoids
                // piling up redundant records as the ticket moves between the
                // various in-progress statuses (which all map to MAINTENANCE).
                if (!latestRecord || latestRecord.status !== desiredStatus) {
                    await tx.asset_records.create({
                        data: {
                            asset_id: existing.asset_id,
                            status: desiredStatus,
                            location: latestRecord?.location ?? "Unassigned",
                            // Fixed & Completed hands the asset back to whoever
                            // reported the issue; otherwise custody is untouched.
                            current_custodian: desiredStatus === "ON_LOAN"
                                ? existing.reported_by_id
                                : (latestRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID),
                        },
                    });
                }
            }

            return repair;
        });

        console.log(`✅ Repair #${repairId} progress updated to "${progressStatus}".`);
        res.json({ success: true, repair });
    } catch (error: any) {
        console.error("❌ MySQL Repair Update Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 12. Finalize an asset return (ReturnForm -> handleSubmit, TSG/ITS branch only).
//     asset_returns requires condition/accessories/reference_number up front —
//     unlike asset_loans/asset_transfers/asset_disposals it has no status column,
//     so it can only represent a *finalized* turn-in, not a pending request.
//     The custodian's initial "Submit Return Request" step stays local/mock —
//     there's nowhere in the schema to persist a pending return short of a
//     migration (happy to add a status column there too if you want that leg
//     tracked in the DB as well).
const CONDITION_MAP: Record<string, string> = {
    "Pristine": "PRISTINE",
    "Operational": "OPERATIONAL",
    "Degraded": "DEGRADED",
    "Complete Failure": "COMPLETE_FAILURE",
};

app.post('/api/assets/:assetTag/return', async (req: Request<{ assetTag: string }>, res: Response): Promise<void> => {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        console.log(`🚀 Server received return finalization for ${assetTag}:`, data);

        if (!data.condition) {
            res.status(400).json({ success: false, error: "Missing required field: condition." });
            return;
        }
        const conditionEnum = CONDITION_MAP[data.condition];
        if (!conditionEnum) {
            res.status(400).json({ success: false, error: `Unrecognized condition: ${data.condition}.` });
            return;
        }

        const existing = await prisma.assets.findUnique({ where: { asset_tag: assetTag } });
        if (!existing) {
            res.status(404).json({ success: false, error: `No asset found with tag ${assetTag}.` });
            return;
        }

        // Same free-text-name -> user_id lookup convention used by /borrow and /repair.
        let returnedById = DEFAULT_CUSTODIAN_ID;
        if (data.returnedBy) {
            const [first, ...rest] = String(data.returnedBy).replace(/^Dr\.\s*/i, "").split(" ");
            const match = await prisma.users.findFirst({
                where: { first_name: first, last_name: rest.join(" ") },
            });
            if (match) returnedById = match.user_id;
        }

        const referenceNumber = `CLR-${Date.now().toString(36).toUpperCase()}`;

        // asset_returns (the finalized ledger entry) and asset_records (the
        // append-only status log) are written together so a failure on either
        // rolls back the whole finalization.
        const ret = await prisma.$transaction(async (tx) => {
            const ret = await tx.asset_returns.create({
                data: {
                    asset_id: existing.asset_id,
                    returned_by_id: returnedById,
                    condition: conditionEnum as any,
                    accessories: Array.isArray(data.accessories) ? data.accessories : [],
                    reference_number: referenceNumber,
                },
            });

            // Closing the loop: asset goes back into the general pool — status
            // ACTIVE, custodian reset to the default/unassigned holder. Location
            // carries forward from the latest record (unchanged).
            const latestRecord = await tx.asset_records.findFirst({
                where: { asset_id: existing.asset_id },
                orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }],
            });

            await tx.asset_records.create({
                data: {
                    asset_id: existing.asset_id,
                    status: "ACTIVE",
                    location: latestRecord?.location ?? "Unassigned",
                    current_custodian: DEFAULT_CUSTODIAN_ID,
                },
            });

            return ret;
        });

        console.log("✅ Return finalized in MySQL successfully:", ret.return_id, assetTag);
        res.json({ success: true, return: ret });
    } catch (error: any) {
        console.error("❌ MySQL Return Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 13. Fetch all finalized returns (audit trail / verification)
app.get('/api/asset_returns', async (req: Request, res: Response): Promise<void> => {
    try {
        const dbReturns = await prisma.asset_returns.findMany({ orderBy: { returned_on: 'desc' } });
        const dbAssets = await prisma.assets.findMany();
        const dbUsers = await prisma.users.findMany();

        const formatted = dbReturns.map(r => {
            const asset = dbAssets.find(a => a.asset_id === r.asset_id);
            const returnedBy = dbUsers.find(u => u.user_id === r.returned_by_id);

            return {
                id: `RET-${r.return_id}`,
                returnId: r.return_id,
                assetId: asset?.asset_tag || "",
                asset: asset?.name || "Unknown Asset",
                returnedBy: returnedBy ? `${returnedBy.first_name} ${returnedBy.last_name}` : "Unknown",
                condition: r.condition,
                accessories: r.accessories,
                referenceNumber: r.reference_number,
                returnedOn: r.returned_on.toISOString(),
            };
        });

        res.json({ success: true, returns: formatted });
    } catch (error: any) {
        console.error("❌ Failed to fetch returns:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 14. Log a custodianship transfer request (TransferForm -> handleSubmit).
//     Same pattern as /borrow: only the asset_transfers row (the approval
//     record) is written here. Custody does NOT move to the recipient yet —
//     asset_records stays untouched until the Lab Head approves via
//     PUT /api/asset_transfers/:id/decision.
app.post('/api/assets/:assetTag/transfer', async (req: Request<{ assetTag: string }>, res: Response): Promise<void> => {
    try {
        const { assetTag } = req.params;
        const data = req.body;
        console.log(`🚀 Server received transfer request for ${assetTag}:`, data);

        if (!data.toCustodian || !data.reason) {
            res.status(400).json({ success: false, error: "Missing required fields: toCustodian, reason." });
            return;
        }

        const existing = await prisma.assets.findUnique({ where: { asset_tag: assetTag } });
        if (!existing) {
            res.status(404).json({ success: false, error: `No asset found with tag ${assetTag}.` });
            return;
        }

        // From-custodian is read straight off the asset's own record log — no
        // name lookup needed since we already know exactly who holds it.
        const latestRecord = await prisma.asset_records.findFirst({
            where: { asset_id: existing.asset_id },
            orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }],
        });
        const fromCustodianId = latestRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID;

        // Recipient is collected as free text (e.g. "Dr. Elena Castro"), same
        // lookup convention as borrower/reporter elsewhere — falls back to
        // DEFAULT_CUSTODIAN_ID if nothing matches. to_custodian_id is a
        // required FK, so this always needs a resolved id.
        let toCustodianId = DEFAULT_CUSTODIAN_ID;
        const [first, ...rest] = String(data.toCustodian).replace(/^Dr\.\s*/i, "").split(" ");
        const match = await prisma.users.findFirst({
            where: { first_name: first, last_name: rest.join(" ") },
        });
        if (match) toCustodianId = match.user_id;

        const transfer = await prisma.asset_transfers.create({
            data: {
                asset_id: existing.asset_id,
                from_custodian_id: fromCustodianId,
                to_custodian_id: toCustodianId,
                justification: data.reason,
                status: "pending",
            },
        });

        console.log("✅ Transfer request logged in MySQL successfully:", transfer.transfer_id, assetTag);
        res.json({ success: true, transfer });
    } catch (error: any) {
        console.error("❌ MySQL Transfer Insertion Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 15. Fetch all custodianship transfer requests (LabHeadDashboard custody tab)
app.get('/api/asset_transfers', async (req: Request, res: Response): Promise<void> => {
    try {
        const dbTransfers = await prisma.asset_transfers.findMany({ orderBy: { requested_on: 'desc' } });
        const dbAssets = await prisma.assets.findMany();
        const dbUsers = await prisma.users.findMany();
        const dbRecords = await prisma.asset_records.findMany({ orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }] });

        const formatted = dbTransfers.map(t => {
            const asset = dbAssets.find(a => a.asset_id === t.asset_id);
            const fromUser = dbUsers.find(u => u.user_id === t.from_custodian_id);
            const toUser = dbUsers.find(u => u.user_id === t.to_custodian_id);

            // Used purely to branch-scope the request card (mirrors "Campus —
            // Lab" convention elsewhere) — not the destination lab picked on
            // the form, which isn't persisted anywhere on asset_transfers.
            const latestRecord = dbRecords.find(r => r.asset_id === t.asset_id);
            const [campus, lab] = (latestRecord?.location || "Unassigned").split(" — ");

            let status: "Pending" | "Approved" | "Declined" = "Pending";
            if (t.status === "approved") status = "Approved";
            else if (t.status === "declined") status = "Declined";

            return {
                id: `TRF-${t.transfer_id}`,
                transferId: t.transfer_id,
                assetId: asset?.asset_tag || "",
                asset: asset?.name || "Unknown Asset",
                from: fromUser ? `${fromUser.first_name} ${fromUser.last_name}` : "Unknown",
                to: toUser ? `${toUser.first_name} ${toUser.last_name}` : "Unknown",
                justification: t.justification,
                requestedOn: t.requested_on.toISOString().split("T")[0],
                status,
                location: campus || "Unassigned",
                lab: lab || "",
            };
        });

        res.json({ success: true, transfers: formatted });
    } catch (error: any) {
        console.error("❌ Failed to fetch transfers:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 16. Approve or decline a pending custodianship transfer (LabHeadDashboard -> decideTransfer)
app.put('/api/asset_transfers/:transferId/decision', async (req: Request<{ transferId: string }>, res: Response): Promise<void> => {
    try {
        const transferId = parseInt(req.params.transferId, 10);
        const { decision } = req.body as { decision?: string };
        console.log(`🚀 Server received transfer decision for #${transferId}:`, decision);

        if (!Number.isInteger(transferId)) {
            res.status(400).json({ success: false, error: "Invalid transfer id." });
            return;
        }
        if (decision !== "approve" && decision !== "decline") {
            res.status(400).json({ success: false, error: "decision must be 'approve' or 'decline'." });
            return;
        }

        const transfer = await prisma.asset_transfers.findUnique({ where: { transfer_id: transferId } });
        if (!transfer) {
            res.status(404).json({ success: false, error: `No transfer found with id ${transferId}.` });
            return;
        }
        if (transfer.status !== "pending") {
            res.status(400).json({ success: false, error: `Transfer #${transferId} has already been ${transfer.status}.` });
            return;
        }

        // asset_transfers (approval status) and asset_records (append-only
        // custody log) are updated together so a failure on either rolls back
        // the whole decision.
        const updatedTransfer = await prisma.$transaction(async (tx) => {
            const newStatus = decision === "approve" ? "approved" : "declined";
            const updated = await tx.asset_transfers.update({
                where: { transfer_id: transferId },
                data: { status: newStatus },
            });

            if (decision === "approve") {
                // This is the actual custody handoff — the asset stays with its
                // prior custodian until now. Unlike a loan, a transfer is a
                // permanent reassignment, so status goes to ACTIVE under the
                // new custodian rather than ON_LOAN.
                const latestRecord = await tx.asset_records.findFirst({
                    where: { asset_id: transfer.asset_id },
                    orderBy: [{ date_logged: "desc" }, { asset_record_id: "desc" }],
                });

                await tx.asset_records.create({
                    data: {
                        asset_id: transfer.asset_id,
                        status: "ON_LOAN",
                        location: latestRecord?.location ?? "Unassigned",
                        current_custodian: transfer.to_custodian_id,
                    },
                });
            }
            // On decline, asset_records is untouched — custody never left the
            // original custodian.

            return updated;
        });

        console.log(`✅ Transfer #${transferId} ${decision}d successfully.`);
        res.json({ success: true, transfer: updatedTransfer });
    } catch (error: any) {
        console.error("❌ MySQL Transfer Decision Failed:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// 17. Start the Application Listener
const PORT = 4000;
app.listen(PORT, async () => {
    console.log(`\n==================================================`);
    console.log(`✅ Mini-Backend API is actively listening!`);
    console.log(`🚀 Route Ready: http://localhost:${PORT}/api/assets`);
    console.log(`==================================================\n`);
    await assertDefaultCustodianExists();
});