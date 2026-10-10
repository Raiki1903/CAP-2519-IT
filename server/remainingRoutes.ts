/**
 * Every API route not yet extracted into server/features/<process>/: the old server.ts, minus startup.
 * Layer: routes, temporarily all five layers in one file. Mounted by app.ts. Calls config/prisma.ts,
 * shared/constants/defaultCustodian.ts, and @shared/enums.
 * Used by: every role and workflow except loans, returns, transfers, and disposals (server/features/). Step 12 moves the rest out
 * one feature at a time, and the file is deleted when it is empty.
 */
import express, { Request, Response } from 'express';
import { prisma } from './config/prisma.js';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import { ASSET_CATEGORIES } from '@shared/enums/assetCategory';
import type { StaffUnit } from '@shared/enums/role';
import { DEFAULT_CUSTODIAN_ID } from './shared/constants/defaultCustodian';

/** The routes below, registered in their original order. app.ts mounts it after the body parsers. */
export const router = express.Router();

/**
 * Startup check: logs an error if user DEFAULT_CUSTODIAN_ID does not exist, instead of
 * letting every asset write fail later with an opaque foreign key error. Never throws.
 * Called by main.ts once the server listens.
 */
export async function assertDefaultCustodianExists() {
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
router.get('/api/assets', async (req: Request, res: Response): Promise<void> => {
    try {
        // These 9 queries are all independent (no query depends on another's
        // result — they're cross-referenced together afterward in JS), so
        // running them with Promise.all instead of one-at-a-time cuts this
        // request's total connection-hold time from ~9 round trips to ~1,
        // which matters a lot against a small connection pool talking to a
        // remote DB.
        const [dbAssets, dbMonetaries, dbRecords, dbUsers, dbLoans, dbDisposals, dbTransfers, dbReports, dbProjects] = await Promise.all([
            prisma.assets.findMany(),
            prisma.asset_monetary.findMany(),
            prisma.asset_records.findMany({
                orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }]
            }),
            prisma.users.findMany(),
            // Needed to surface due dates on the borrower's "My Assets" list —
            // approved loans are the source of truth for when a device is due back.
            prisma.asset_loans.findMany({
                where: { status: "approved" },
                orderBy: { loaned_on: "desc" },
            }),
            prisma.asset_disposals.findMany({
                orderBy: { disposal_date: "desc" },
            }),
            prisma.asset_transfers.findMany({
                orderBy: { requested_on: "desc" }
            }),
            prisma.asset_reports.findMany({
                orderBy: { report_date: "desc" }
            }),
            prisma.projects.findMany(),
        ]);

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
                // so the custodian's dashboard can show the countdown/overdue
                // state. Matched by asset alone (dbLoans is already sorted
                // newest-first, so this picks the most recent approved loan
                // cycle) — NOT by requiring the loan's original borrower_id to
                // still equal current_custodian. A transfer moves custody to
                // someone new without touching the original loan row, so that
                // stricter match used to make the deadline vanish for the new
                // custodian even though the same loan cycle (and its due date)
                // is still in effect.
                if (st === "ON_LOAN") {
                    const loan = dbLoans.find(l => l.asset_id === asset.asset_id);
                    if (loan) {
                        borrowedOn = formatDate(loan.loaned_on);
                        dueDate = formatDate(loan.due_date);
                        daysLeft = Math.ceil((loan.due_date.getTime() - Date.now()) / MS_PER_DAY);
                        if (daysLeft < 0) status = "Overdue";
                    }
                }
            }

            // Look up approved disposal record if asset is disposed
            const disposal = dbDisposals.find(d =>
                (latestRecord?.disposal_id && d.disposal_id === latestRecord.disposal_id) ||
                (d.asset_id === asset.asset_id && d.status === "approved")
            );
            const disposerUser = disposal ? dbUsers.find(u => u.user_id === disposal.disposed_by_id) : null;

            let disposalDetails: any = undefined;
            if (disposal) {
                const reasonText = disposal.disposal_reason || "";
                const pathwayMatch = reasonText.match(/Disposal Pathway:\s*(.+)/i);
                const pathway = pathwayMatch ? pathwayMatch[1].trim() : "Decommission — Scrap / Recycle";
                const justificationMatch = reasonText.match(/Breakdown Justification:\s*([\s\S]+)/i);
                const justification = justificationMatch ? justificationMatch[1].trim() : reasonText;

                disposalDetails = {
                    lastCustodian: custodianName || "No Custodian",
                    breakdownReasons: justification || "Decommissioned due to physical breakdown or end of servicing lifecycle.",
                    disposalPathway: pathway,
                    decommissionDate: formatDate(disposal.disposal_date),
                    decommissionedBy: disposerUser ? `${disposerUser.first_name} ${disposerUser.last_name}` : "AdRIC Director",
                };
            }

            const recordWithRemarks = records.find(r => r.Asset_Remarks && String(r.Asset_Remarks).trim() !== "");
            const remarksText = recordWithRemarks?.Asset_Remarks || latestRecord?.Asset_Remarks || null;

            const rawCond = latestRecord?.asset_condition || "";
            let calculatedCondition = 100;
            if (rawCond.includes("35") || rawCond === "CRITICAL_DEFECT" || rawCond === "CRITICAL") calculatedCondition = 35;
            else if (rawCond.includes("60") || rawCond === "DEGRADED" || rawCond === "DEGRADED_PERFORMANCE") calculatedCondition = 60;
            else if (rawCond.includes("78") || rawCond === "MINOR_DRIFT") calculatedCondition = 78;
            else if (rawCond.includes("90") || rawCond === "OPERATIONAL") calculatedCondition = 90;
            else if (rawCond.includes("100") || rawCond === "PERFECT" || rawCond === "BRAND_NEW") calculatedCondition = 100;

            const mappedRecords = records.map(r => {
                const cUser = dbUsers.find(u => u.user_id === r.current_custodian);
                return {
                    id: r.asset_record_id,
                    created_at: r.date_logged ? r.date_logged.toISOString() : new Date().toISOString(),
                    date_logged: r.date_logged ? formatDate(r.date_logged) : "N/A",
                    status: r.status,
                    condition: r.asset_condition,
                    location: r.location,
                    currentLocation: r.current_location || undefined,
                    custodian: cUser ? `${cUser.first_name} ${cUser.last_name}` : "System Custodian",
                    remarks: r.Asset_Remarks || "Log entry recorded in asset lifecycle registry."
                };
            });

            const assetTransfers = dbTransfers.filter(t => t.asset_id === asset.asset_id);
            const mappedTransfers = assetTransfers.map(t => {
                const fromUser = dbUsers.find(u => u.user_id === t.from_custodian_id);
                const toUser = dbUsers.find(u => u.user_id === t.to_custodian_id);
                return {
                    transfer_id: t.transfer_id,
                    id: `TR-${t.transfer_id}`,
                    asset_id: t.asset_id,
                    assetId: asset.asset_tag,
                    from_custodian_id: t.from_custodian_id,
                    to_custodian_id: t.to_custodian_id,
                    from: fromUser ? `${fromUser.first_name} ${fromUser.last_name}` : `Custodian ID: ${t.from_custodian_id}`,
                    to: toUser ? `${toUser.first_name} ${toUser.last_name}` : `Custodian ID: ${t.to_custodian_id}`,
                    requested_on: t.requested_on ? formatDate(t.requested_on) : "N/A",
                    initiated: t.requested_on ? formatDate(t.requested_on) : "N/A",
                    created_at: t.requested_on ? t.requested_on.toISOString() : new Date().toISOString(),
                    status: t.status,
                    justification: t.justification || "Custodianship transfer request",
                    lab: location || "CITe4D"
                };
            });

            const assetReports = dbReports.filter(r => r.asset_id === asset.asset_id);
            const mappedReports = assetReports.map(r => {
                const rUser = dbUsers.find(u => u.user_id === r.reported_by_id);
                return {
                    id: r.report_id,
                    reportId: `RPT-${r.report_id}`,
                    assetId: asset.asset_tag,
                    reportedBy: rUser ? `${rUser.first_name} ${rUser.last_name}` : "Staff",
                    reporterRole: rUser?.role || "Inspection Inspector",
                    reportDate: r.report_date ? formatDate(r.report_date) : "N/A",
                    date_logged: r.report_date ? formatDate(r.report_date) : "N/A",
                    created_at: r.report_date ? r.report_date.toISOString() : new Date().toISOString(),
                    condition: r.report_condition,
                    remarks: r.report_remarks || "Routine physical inspection logged in AdRIC registry.",
                    image: r.report_img || undefined,
                    status: "Verified Inspection"
                };
            });

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
                // Full "Campus — Lab" string of wherever the asset is checked
                // out to right now (loan/transfer destination, or the TSG
                // office during repair) — distinct from the split
                // location/lab fields above, which are always the home campus/lab.
                currentLocation: latestRecord?.current_location || undefined,
                status,
                condition: calculatedCondition,
                assetCondition: latestRecord?.asset_condition || "PERFECT",
                custodian: custodianName || undefined,
                borrowedOn,
                dueDate,
                daysLeft,
                disposalId: disposal ? `DISP-${disposal.disposal_id}` : undefined,
                disposalDetails,
                image: asset.image_url,
                image_url: asset.image_url,
                description: remarksText || "Asset registered under DLSU AdRIC equipment registry.",
                remarks: remarksText || undefined,
                tsgRemarks: remarksText || undefined,
                itsRemarks: remarksText || undefined,
                asset_records: mappedRecords,
                asset_transfers: mappedTransfers,
                asset_reports: mappedReports,
                asset_monetary: monetary ? {
                    asset_monetary_id: monetary.asset_monetary_id,
                    asset_id: monetary.asset_id,
                    acquisition_value: Number(monetary.acquisition_value),
                    funding_source: monetary.funding_source
                } : {
                    acquisition_value: 0,
                    funding_source: "Unspecified"
                }
            };
        });

        res.json({ success: true, assets: formatted });
    } catch (error: any) {
        console.error("❌ Failed to fetch assets:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});

// GET Custodian History for a specific asset (from oldest to newest)
router.get('/api/assets/:assetTag/custodian-history', async (req: Request<{ assetTag: string }>, res: Response): Promise<void> => {
    try {
        const { assetTag } = req.params;

        let asset = await prisma.assets.findUnique({
            where: { asset_tag: assetTag }
        });

        if (!asset && !isNaN(Number(assetTag))) {
            asset = await prisma.assets.findUnique({
                where: { asset_id: Number(assetTag) }
            });
        }

        if (!asset) {
            res.status(404).json({ success: false, error: "Asset not found in database." });
            return;
        }

        // Fetch all asset_records for this asset ordered by date_logged ASC (Oldest to Newest)
        const records = await prisma.asset_records.findMany({
            where: { asset_id: asset.asset_id },
            orderBy: [{ date_logged: 'asc' }, { asset_record_id: 'asc' }],
            include: {
                users: true
            }
        });

        const history: any[] = [];

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const custodianName = r.users ? `${r.users.first_name} ${r.users.last_name}` : "Unknown Custodian";
            const custodianEmail = r.users ? r.users.email : "";
            const custodianId = r.users ? r.users.id_number : "";

            history.push({
                sequence: i + 1,
                recordId: r.asset_record_id,
                custodianName,
                custodianEmail,
                custodianId,
                status: r.status,
                location: r.location,
                currentLocation: r.current_location || undefined,
                condition: r.asset_condition,
                remarks: r.Asset_Remarks || (i === 0 ? "Initial Asset Registration Intake Record" : "Custody Update Record"),
                dateLogged: r.date_logged.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }),
                isCurrent: i === records.length - 1
            });
        }

        if (history.length === 0) {
            history.push({
                sequence: 1,
                custodianName: "Equipment Custodian",
                custodianEmail: "custodian@dlsu.edu.ph",
                status: "ACTIVE",
                location: "DLSU Campus",
                condition: "PERFECT",
                remarks: "Initial Asset Registration Intake Record",
                dateLogged: asset.procurement_date ? asset.procurement_date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                isCurrent: true
            });
        }

        res.json({
            success: true,
            assetTag: asset.asset_tag,
            assetName: asset.name,
            historyCount: history.length,
            custodianHistory: history // Sorted from oldest to newest (1..N)
        });
    } catch (error: any) {
        console.error("❌ Fetch custodian history error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch custodian history." });
    }
});

function sanitizeCategory(cat: any): any {
    if (!cat) return 'DEV_KIT';
    const formatted = String(cat).trim().toUpperCase().replace(/[\s-]+/g, '_');
    return ASSET_CATEGORIES.includes(formatted) ? formatted : 'DEV_KIT';
}

// 3. Setup the endpoint the ITSDashboard intake wizard (handleSubmit) posts to
router.post('/api/assets', async (req: Request, res: Response): Promise<void> => {
    try {
        const data = req.body;
        console.log("🚀 Server received raw payload:", data);

        if (!data.name || !data.category) {
            res.status(400).json({ success: false, error: "Missing required fields: name, category." });
            return;
        }

        const imageVal = data.image || data.image_url || data.imageUrl || null;
        if (imageVal && typeof imageVal === 'string' && !/^data:image\//i.test(imageVal) && !/\.(jpg|jpeg|png|webp|svg)$/i.test(imageVal.split('?')[0])) {
            res.status(400).json({ success: false, error: "Security Violation: Asset image must be a valid .jpg or .png file." });
            return;
        }

        if (imageVal) {
            console.log(`📸 Saving image payload for new asset (${imageVal.slice(0, 30)}... [length: ${imageVal.length}])`);
        }

        // Generate a unique asset tag following the lab naming convention (<LabName>-<4-digit sequence>)
        const labPrefix = String(data.lab || "CITe4D").trim().replace(/[^a-zA-Z0-9]/g, "") || "CITe4D";
        const existingLabAssets = await prisma.assets.findMany({
            where: {
                asset_tag: {
                    startsWith: `${labPrefix}-`
                }
            },
            select: { asset_tag: true }
        });

        let maxSeq = 0;
        const prefixPattern = new RegExp(`^${labPrefix}-(\\d+)$`, "i");
        for (const a of existingLabAssets) {
            const match = a.asset_tag.match(prefixPattern);
            if (match) {
                const seq = parseInt(match[1], 10);
                if (seq > maxSeq) maxSeq = seq;
            }
        }

        const nextSeq = maxSeq + 1;
        const assetTag = `${labPrefix}-${String(nextSeq).padStart(4, "0")}`;

        // assets / asset_monetary / asset_records / projects are written
        // together so a failure on any one of them rolls back the whole
        // registration.
        const { asset } = await prisma.$transaction(async (tx) => {
            const asset = await tx.assets.create({
                data: {
                    asset_tag: assetTag,
                    name: data.name,
                    category: sanitizeCategory(data.category),
                    serial_number: data.serial || null,
                    manufacturer: data.manufacturer || null,
                    image_url: imageVal || null,
                    procurement_date: data.procured ? new Date(data.procured) : null,
                    warranty_expiry: data.warranty ? new Date(data.warranty) : null,
                },
            });

            await tx.asset_monetary.create({
                data: {
                    asset_id: asset.asset_id,
                    funding_source: data.funding || "Unspecified",
                    acquisition_value: data.acquisitionValue ?? 0,
                },
            });

            await tx.asset_records.create({
                data: {
                    asset_id: asset.asset_id,
                    status: "ACTIVE",
                    asset_condition: "PERFECT",
                    // Combines the campus dropdown + lab group since assets has no direct center_id column
                    location: [data.location, data.lab].filter(Boolean).join(" — ") || "Unassigned",
                    // Starts equal to location — the asset is currently at the
                    // lab it was just registered under. Only loans, transfers,
                    // and repairs ever move it away from here.
                    current_location: [data.location, data.lab].filter(Boolean).join(" — ") || "Unassigned",
                    current_custodian: data.custodianId ?? DEFAULT_CUSTODIAN_ID,
                    Asset_Remarks: data.remarks || data.description || data.tsgRemarks || data.itsRemarks || null,
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
router.put('/api/assets/:assetTag', async (req: Request<{ assetTag: string }>, res: Response): Promise<void> => {
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

        const imageProvided = data.image !== undefined || data.image_url !== undefined || data.imageUrl !== undefined;
        const rawImage = data.image ?? data.image_url ?? data.imageUrl;
        const imageVal = imageProvided ? (rawImage || null) : existing.image_url;

        if (imageVal && typeof imageVal === 'string' && !/^data:image\//i.test(imageVal) && !/\.(jpg|jpeg|png|webp|svg)$/i.test(imageVal.split('?')[0])) {
            res.status(400).json({ success: false, error: "Security Violation: Asset image must be a valid .jpg or .png file." });
            return;
        }

        if (imageProvided && rawImage) {
            console.log(`📸 Updating image payload for ${assetTag} (${String(rawImage).slice(0, 30)}... [length: ${String(rawImage).length}])`);
        }

        const updated = await prisma.$transaction(async (tx) => {
            // Build assets update payload ONLY for fields explicitly provided in req.body.
            // Inspection reports only send condition/remarks and should NOT modify assets table fields.
            const assetUpdateData: any = {};
            if (data.name !== undefined) assetUpdateData.name = data.name;
            if (data.serial !== undefined) assetUpdateData.serial_number = data.serial || null;
            if (data.manufacturer !== undefined) assetUpdateData.manufacturer = data.manufacturer || null;
            if (data.category !== undefined) assetUpdateData.category = sanitizeCategory(data.category);
            if (imageProvided) assetUpdateData.image_url = imageVal;
            if (data.procured !== undefined) assetUpdateData.procurement_date = data.procured ? new Date(data.procured) : null;
            if (data.warranty !== undefined) assetUpdateData.warranty_expiry = data.warranty ? new Date(data.warranty) : null;

            let asset = existing;
            if (Object.keys(assetUpdateData).length > 0) {
                asset = await tx.assets.update({
                    where: { asset_id: existing.asset_id },
                    data: assetUpdateData,
                });
            }

            if (data.funding !== undefined || data.acquisitionValue !== undefined) {
                await tx.asset_monetary.upsert({
                    where: { asset_id: existing.asset_id },
                    update: { funding_source: data.funding || "Unspecified" },
                    create: {
                        asset_id: existing.asset_id,
                        funding_source: data.funding || "Unspecified",
                        acquisition_value: data.acquisitionValue ?? 0,
                    },
                });
            }

            // asset_records is an append-style log — edit the most recent entry
            // for this asset rather than rewriting history.
            const latestRecord = await tx.asset_records.findFirst({
                where: { asset_id: existing.asset_id },
                orderBy: { date_logged: "desc" },
            });

            const remarksProvided = data.remarks !== undefined || data.description !== undefined || data.tsgRemarks !== undefined || data.itsRemarks !== undefined;
            const rawRemarks = data.remarks ?? data.description ?? data.tsgRemarks ?? data.itsRemarks;
            const remarksVal = remarksProvided ? (rawRemarks || null) : (latestRecord?.Asset_Remarks ?? null);

            const recordData = {
                status: (data.status?.toUpperCase().replace(" ", "_") || latestRecord?.status || "ACTIVE") as any,
                location: [data.location, data.lab].filter(Boolean).join(" — ") || latestRecord?.location || "Unassigned",
                current_custodian: custodianId ?? latestRecord?.current_custodian ?? DEFAULT_CUSTODIAN_ID,
                asset_condition: (ASSET_CONDITIONS.includes(data.assetCondition) ? data.assetCondition : latestRecord?.asset_condition ?? "PERFECT") as any,
                Asset_Remarks: remarksVal,
            };

            if (latestRecord) {
                await tx.asset_records.update({ where: { asset_record_id: latestRecord.asset_record_id }, data: recordData });
            } else {
                await tx.asset_records.create({ data: { asset_id: existing.asset_id, ...recordData } });
            }

            // Record inspection in asset_reports table when condition or remarks are submitted
            if (data.assetCondition || data.reportCondition || data.remarks || data.tsgRemarks || data.itsRemarks) {
                const rawCond = String(data.reportCondition || data.assetCondition || "PERFECT").trim();
                const conditionMap: Record<string, any> = {
                    "PERFECT": "PERFECT",
                    "Perfect": "PERFECT",
                    "OPERATIONAL": "OPERATIONAL",
                    "Operational": "OPERATIONAL",
                    "MINOR_DRIFT": "MINOR_DRIFT",
                    "Minor Drift": "MINOR_DRIFT",
                    "DEGRADED": "DEGRADED",
                    "Degraded Performance": "DEGRADED",
                    "CRITICAL_DEFECT": "CRITICAL_DEFECT",
                    "Critical Defect": "CRITICAL_DEFECT",
                };
                const condition = conditionMap[rawCond] || "PERFECT";

                // Save new record in asset_reports (preserving previous records)
                await tx.asset_reports.create({
                    data: {
                        asset_id: existing.asset_id,
                        reported_by_id: custodianId ?? DEFAULT_CUSTODIAN_ID,
                        report_condition: condition,
                        report_remarks: String(remarksVal || "Routine inspection verified.").slice(0, 255),
                        report_img: imageVal || null,
                    }
                });

                // Retrieve most latest inspection report for asset_condition
                const latestReport = await tx.asset_reports.findFirst({
                    where: { asset_id: existing.asset_id },
                    orderBy: [{ report_date: "desc" }, { report_id: "desc" }],
                });

                const latestCondition = latestReport ? latestReport.report_condition : condition;
                const latestRemarks = latestReport ? latestReport.report_remarks : remarksVal;

                if (latestRecord) {
                    await tx.asset_records.update({
                        where: { asset_record_id: latestRecord.asset_record_id },
                        data: {
                            asset_condition: latestCondition as any,
                            Asset_Remarks: latestRemarks,
                        }
                    });
                }
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
router.delete('/api/assets/:assetTag', async (req: Request<{ assetTag: string }>, res: Response): Promise<void> => {
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

// 18.5 Aggregate descriptive analytics data for the reporting dashboard
router.get('/api/analytics/dashboard', async (req: Request, res: Response): Promise<void> => {
    try {
        // Independent queries — batched to cut connection-hold time.
        const [dbAssets, dbLoans, dbRepairs, dbDisposals, dbReturns] = await Promise.all([
            prisma.assets.findMany({
                include: {
                    asset_monetary: true,
                    asset_records: {
                        orderBy: { date_logged: 'desc' },
                        include: {
                            users: {
                                include: {
                                    user_roles: {
                                        include: {
                                            roles: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }),
            prisma.asset_loans.findMany({
                where: { status: "approved" },
                include: {
                    users: true,
                    assets: true
                }
            }),
            prisma.asset_repairs.findMany({
                orderBy: { created_at: 'asc' }
            }),
            prisma.asset_disposals.findMany({
                where: { status: 'approved' },
                orderBy: { disposal_date: 'asc' }
            }),
            prisma.asset_returns.findMany({
                orderBy: { returned_on: 'asc' }
            }),
        ]);

        // 1. Funding Source Distribution (active assets by funder)
        const fundingCounts: Record<string, number> = {};
        // 2. Asset Lifecycle Status
        let activeCount = 0;
        let deployedCount = 0;
        let maintenanceCount = 0;
        let disposedCount = 0;
        // 4. Cross-Campus Distribution
        let manilaCount = 0;
        let lagunaCount = 0;
        // 6. Custodial Hierarchy
        const roleCounts: Record<string, number> = {};

        dbAssets.forEach(asset => {
            const latest = asset.asset_records[0];
            const status = latest?.status || 'ACTIVE';

            if (status === 'DISPOSED') {
                disposedCount++;
                return; // Disposed assets don't count for active metrics
            }

            // Active assets details
            if (status === 'ACTIVE') activeCount++;
            else if (status === 'ON_LOAN') deployedCount++;
            else if (status === 'MAINTENANCE') maintenanceCount++;

            // Funding Source
            const funder = asset.asset_monetary?.funding_source || 'Unspecified';
            fundingCounts[funder] = (fundingCounts[funder] || 0) + 1;

            // Campus Distribution
            const loc = latest?.location || '';
            if (loc.startsWith('Manila')) manilaCount++;
            else if (loc.startsWith('Laguna')) lagunaCount++;

            // Custodial Hierarchy
            const user = latest?.users;
            if (user) {
                const rolesList = user.user_roles.map(ur => ur.roles.role_name);
                const primaryRole = rolesList[0] || 'CUSTODIAN';
                roleCounts[primaryRole] = (roleCounts[primaryRole] || 0) + 1;
            }
        });

        const fundingDistribution = Object.entries(fundingCounts).map(([name, value]) => ({ name, value }));
        const lifecycleStatus = [
            { name: 'Procured', value: activeCount }, // active/available in inventory
            { name: 'Deployed', value: deployedCount }, // on loan
            { name: 'In-Repair', value: maintenanceCount },
            { name: 'Disposed', value: disposedCount }
        ];
        const campusDistribution = [
            { name: 'Manila', value: manilaCount },
            { name: 'Laguna', value: lagunaCount }
        ];
        const custodialHierarchy = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));

        // 3. Uncleared Accountability (overdue loans)
        const overdueLoans = dbLoans.filter(loan => {
            const isOverdue = loan.due_date.getTime() < Date.now();
            if (!isOverdue) return false;
            // Check if current custodian is still the borrower and asset is ON_LOAN
            const asset = dbAssets.find(a => a.asset_id === loan.asset_id);
            const latest = asset?.asset_records[0];
            return latest && latest.status === 'ON_LOAN' && latest.current_custodian === loan.borrower_id;
        }).map(loan => {
            const overdueDays = Math.ceil((Date.now() - loan.due_date.getTime()) / (1000 * 60 * 60 * 24));
            return {
                id: loan.loan_id,
                assetTag: loan.assets.asset_tag,
                assetName: loan.assets.name,
                borrowerName: `${loan.users.first_name} ${loan.users.last_name}`,
                borrowerEmail: loan.users.email,
                borrowerType: loan.users.user_type,
                dueDate: loan.due_date.toISOString().split('T')[0],
                overdueDays
            };
        });

        // 5. Lab-Specific Utilization (borrowing frequency across the 10 AdRIC labs by borrower type)
        const ALL_10_LABS = ["CITe4D", "CAR", "CeHCI", "HXIL", "GAME", "CeLT", "Bio", "CIVI", "CHEM", "MECH"];
        const labCounts: Record<string, { student: number; faculty: number }> = {};
        ALL_10_LABS.forEach(l => { labCounts[l] = { student: 0, faculty: 0 }; });
        dbLoans.forEach(loan => {
            const asset = dbAssets.find(a => a.asset_id === loan.asset_id);
            const record = asset?.asset_records.find(r => r.current_custodian === loan.borrower_id && r.status === 'ON_LOAN');
            const loc = record?.location || asset?.asset_records[0]?.location || '';
            const labName = loc.split(' — ')[1];
            if (labName && ALL_10_LABS.includes(labName)) {
                if (loan.users.user_type === 'STUDENT') {
                    labCounts[labName].student++;
                } else {
                    labCounts[labName].faculty++;
                }
            }
        });
        const labUtilization = Object.entries(labCounts).map(([name, counts]) => ({
            name,
            Student: counts.student,
            Faculty: counts.faculty
        }));

        // 7. Baseline Degradation (average condition of returns over time)
        const monthlyDegradation: Record<string, { sum: number; count: number }> = {};
        dbReturns.forEach(r => {
            const month = r.returned_on.toISOString().substring(0, 7); // YYYY-MM
            let score = 100;
            if (r.condition === 'PERFECT') score = 100;
            else if (r.condition === 'OPERATIONAL') score = 85;
            else if (r.condition === 'MINOR_DRIFT') score = 65;
            else if (r.condition === 'DEGRADED') score = 40;
            else if (r.condition === 'CRITICAL_DEFECT') score = 10;

            if (!monthlyDegradation[month]) {
                monthlyDegradation[month] = { sum: 0, count: 0 };
            }
            monthlyDegradation[month].sum += score;
            monthlyDegradation[month].count += 1;
        });
        // Default historical months for baseline chart if database lacks return logs
        let degradationTrend = Object.entries(monthlyDegradation).map(([month, data]) => ({
            date: month,
            condition: Math.round(data.sum / data.count),
            baseline: 100
        }));
        if (degradationTrend.length === 0) {
            degradationTrend = [
                { date: '2025-09', condition: 100, baseline: 100 },
                { date: '2025-12', condition: 98, baseline: 100 },
                { date: '2026-03', condition: 95, baseline: 100 },
                { date: '2026-06', condition: 92, baseline: 100 }
            ];
        }

        // 8. Repair Request Frequency (volume of repair logs over time)
        const monthlyRepairs: Record<string, number> = {};
        dbRepairs.forEach(r => {
            const month = r.created_at.toISOString().substring(0, 7); // YYYY-MM
            monthlyRepairs[month] = (monthlyRepairs[month] || 0) + 1;
        });
        let repairFrequency = Object.entries(monthlyRepairs).map(([month, count]) => ({
            date: month,
            repairs: count
        }));
        if (repairFrequency.length === 0) {
            repairFrequency = [
                { date: '2025-09', repairs: 0 },
                { date: '2025-12', repairs: 0 },
                { date: '2026-03', repairs: 0 },
                { date: '2026-06', repairs: 0 }
            ];
        }

        // 9. Disposal Volume (cumulative retired equipment over time)
        const monthlyDisposals: Record<string, number> = {};
        dbDisposals.forEach(d => {
            const month = d.disposal_date.toISOString().substring(0, 7); // YYYY-MM
            monthlyDisposals[month] = (monthlyDisposals[month] || 0) + 1;
        });
        let runningDisposals = 0;
        let disposalVolume = Object.entries(monthlyDisposals).map(([month, count]) => {
            runningDisposals += count;
            return {
                date: month,
                disposals: runningDisposals
            };
        });
        if (disposalVolume.length === 0) {
            disposalVolume = [
                { date: '2025-09', disposals: 0 },
                { date: '2025-12', disposals: 0 },
                { date: '2026-03', disposals: 0 },
                { date: '2026-06', disposals: 0 }
            ];
        }

        res.json({
            success: true,
            data: {
                fundingDistribution,
                lifecycleStatus,
                overdueLoans,
                campusDistribution,
                labUtilization,
                custodialHierarchy,
                degradationTrend,
                repairFrequency,
                disposalVolume
            }
        });
    } catch (error: any) {
        console.error("❌ Failed to fetch dashboard analytics:", error);
        res.status(500).json({ success: false, error: error.message || "Database execution failed." });
    }
});




// ---------------------------------------------------------------------------
// Reports & Analytics Dashboard Endpoints (with Lab Filter Support)
// ---------------------------------------------------------------------------

// ===========================================================================
// Reports & Analytics Dashboard Endpoints (with Lab Filter Support)
// ===========================================================================

// 1. Director: Funding Capital & Valuation Breakdown
router.get('/api/analytics/advanced/funding-valuation', async (req: Request, res: Response): Promise<void> => {
    try {
        const monetaries = await prisma.asset_monetary.findMany({
            select: {
                funding_source: true,
                acquisition_value: true,
                assets: {
                    select: {
                        category: true,
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1,
                            select: {
                                status: true
                            }
                        }
                    }
                }
            }
        });

        const fundingMap: Record<string, { totalValue: number; count: number; categories: Record<string, number> }> = {};
        monetaries.forEach((m) => {
            const latestRecord = m.assets?.asset_records[0];
            const status = latestRecord?.status || 'ACTIVE';
            if (status === 'DISPOSED') return;

            const f = m.funding_source || "DOST-PCIEERD";
            const val = Number(m.acquisition_value || 0);
            const cat = m.assets?.category || "DEV_KIT";

            if (!fundingMap[f]) {
                fundingMap[f] = { totalValue: 0, count: 0, categories: {} };
            }
            fundingMap[f].totalValue += val;
            fundingMap[f].count += 1;
            fundingMap[f].categories[cat] = (fundingMap[f].categories[cat] || 0) + val;
        });

        const outerPie = Object.keys(fundingMap).map(f => ({
            name: f,
            value: fundingMap[f].totalValue,
            count: fundingMap[f].count
        }));

        const innerPie: { name: string; value: number; parent: string }[] = [];
        Object.keys(fundingMap).forEach(f => {
            Object.keys(fundingMap[f].categories).forEach(cat => {
                innerPie.push({
                    name: `${f} - ${cat}`,
                    value: fundingMap[f].categories[cat],
                    parent: f
                });
            });
        });

        res.json({ success: true, data: { outerPie, innerPie } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Director: Cross-Campus Transfer Flow
router.get('/api/analytics/advanced/campus-transfer-flow', async (req: Request, res: Response): Promise<void> => {
    try {
        const usersWithCenters = await prisma.users.findMany({
            select: {
                user_id: true,
                user_centers: {
                    select: {
                        research_centers: {
                            select: {
                                location: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });

        const userLocationMap = new Map<number, { location: string; centerName: string }>();
        usersWithCenters.forEach((u) => {
            const firstCenter = u.user_centers[0]?.research_centers;
            userLocationMap.set(u.user_id, {
                location: firstCenter?.location || "MANILA",
                centerName: firstCenter?.name || "General"
            });
        });

        const transfers = await prisma.asset_transfers.findMany({
            select: {
                from_custodian_id: true,
                to_custodian_id: true
            }
        });

        let manilaToLaguna = 0;
        let lagunaToManila = 0;
        let internalManila = 0;
        let internalLaguna = 0;

        transfers.forEach(t => {
            const fromLoc = userLocationMap.get(t.from_custodian_id)?.location || "MANILA";
            const toLoc = userLocationMap.get(t.to_custodian_id)?.location || "MANILA";

            if (fromLoc === "MANILA" && toLoc === "LAGUNA") {
                manilaToLaguna += 1;
            } else if (fromLoc === "LAGUNA" && toLoc === "MANILA") {
                lagunaToManila += 1;
            } else if (fromLoc === "MANILA" && toLoc === "MANILA") {
                internalManila += 1;
            } else if (fromLoc === "LAGUNA" && toLoc === "LAGUNA") {
                internalLaguna += 1;
            }
        });

        res.json({
            success: true,
            data: {
                nodes: [
                    { name: "Manila Campus" },
                    { name: "Laguna Campus" },
                    { name: "Manila Internal" },
                    { name: "Laguna Internal" }
                ],
                links: [
                    { source: 0, target: 1, value: manilaToLaguna },
                    { source: 1, target: 0, value: lagunaToManila },
                    { source: 0, target: 2, value: internalManila },
                    { source: 1, target: 3, value: internalLaguna }
                ]
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Director: Grant Renewal Readiness Index
router.get('/api/analytics/advanced/grant-readiness-index', async (req: Request, res: Response): Promise<void> => {
    try {
        const allProjects = await prisma.projects.findMany({
            include: {
                asset_records: true,
                research_centers: true
            }
        });

        const readinessData = allProjects.map((p) => {
            const totalAssets = p.asset_records.length;
            const accountedAssets = p.asset_records.filter(r => r.status !== "ON_LOAN").length;
            const readinessScore = totalAssets > 0 ? Math.round((accountedAssets / totalAssets) * 100) : 100;

            return {
                projectId: p.project_id,
                projectName: p.project_name,
                leader: p.project_leader,
                center: p.research_centers?.name || "Unknown Center",
                readinessScore,
                status: readinessScore >= 90 ? "Renewal Ready" : "Document Audit Pending"
            };
        });

        const overallScore = readinessData.length > 0
            ? Math.round(readinessData.reduce((acc, curr) => acc + curr.readinessScore, 0) / readinessData.length)
            : 100;

        res.json({ success: true, data: { overallScore, projects: readinessData } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Director: Documentation Completeness / Compliance Analytics
router.get('/api/analytics/compliance', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const monetaries = await prisma.asset_monetary.findMany({
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            include: {
                                projects: true
                            }
                        }
                    }
                }
            }
        });

        const fundingMap: Record<string, { totalCount: number; documentedCount: number; totalValue: number }> = {};
        let govTotal = 0;
        let govDocumented = 0;

        monetaries.forEach((m) => {
            const latestRecord = m.assets?.asset_records[0];
            const status = latestRecord?.status || 'ACTIVE';
            if (status === 'DISPOSED') return;

            const loc = latestRecord?.location || "";
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const projectAgency = latestRecord?.projects?.funding_agency;
            const f = projectAgency || m.funding_source || "Unspecified";

            if (!fundingMap[f]) {
                fundingMap[f] = { totalCount: 0, documentedCount: 0, totalValue: 0 };
            }
            fundingMap[f].totalCount += 1;
            fundingMap[f].totalValue += Number(m.acquisition_value || 0);
            if (m.is_documented) {
                fundingMap[f].documentedCount += 1;
            }

            const isGov = ["DOST", "CHED", "USAID", "DOST-PCIEERD"].some((g) => f.toUpperCase().includes(g));
            if (isGov) {
                govTotal += 1;
                if (m.is_documented) govDocumented += 1;
            }
        });

        const byFundingSource = Object.keys(fundingMap).map((f) => ({
            fundingSource: f,
            totalCount: fundingMap[f].totalCount,
            documentedCount: fundingMap[f].documentedCount,
            compliancePercentage: fundingMap[f].totalCount > 0 ? Math.round((fundingMap[f].documentedCount / fundingMap[f].totalCount) * 100) : 100,
            totalValue: fundingMap[f].totalValue
        }));

        const auditReadyPercentage = govTotal > 0 ? Math.round((govDocumented / govTotal) * 100) : 100;

        res.json({ success: true, data: { byFundingSource, auditReadyPercentage, govTotal, govDocumented } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Director: Asset Utilization Justifier
router.get('/api/analytics/stakeholder/utilization', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_loans: { select: { loan_id: true } },
                asset_transfers: { select: { transfer_id: true } },
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const topUtilized = assets
            .filter((a) => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((a) => {
                const borrowCount = a.asset_loans.length + a.asset_transfers.length;
                return {
                    assetId: a.asset_id,
                    assetName: a.name,
                    assetTag: a.asset_tag,
                    category: a.category,
                    borrowCount
                };
            })
            .sort((a, b) => b.borrowCount - a.borrowCount)
            .slice(0, 10);

        res.json({ success: true, data: topUtilized });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Director: Audit Discrepancy Analyzer
router.get('/api/analytics/stakeholder/audit-discrepancies', async (req: Request, res: Response): Promise<void> => {
    try {
        const labFilter = req.query.lab as string | undefined;
        const monetaries = await prisma.asset_monetary.findMany({
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1,
                            include: {
                                projects: {
                                    include: {
                                        research_centers: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const discrepancyMap: Record<string, { fundingSource: string; lab: string; gapCount: number; missingValue: number }> = {};

        monetaries.forEach(m => {
            const latestRecord = m.assets?.asset_records[0];
            const status = latestRecord?.status || 'ACTIVE';
            if (status === 'DISPOSED') return;

            const loc = latestRecord?.projects?.research_centers?.name || "Unassigned Center";
            const actualLoc = latestRecord?.location || "";
            if (labFilter && !actualLoc.toLowerCase().includes(labFilter.toLowerCase())) return;

            const isDoc = m.is_documented;
            const funding = m.funding_source || "Unspecified";
            const key = `${funding}__${loc}`;

            if (!discrepancyMap[key]) {
                discrepancyMap[key] = { fundingSource: funding, lab: loc, gapCount: 0, missingValue: 0 };
            }
            if (!isDoc) {
                discrepancyMap[key].gapCount += 1;
                discrepancyMap[key].missingValue += Number(m.acquisition_value || 0);
            }
        });

        const discrepancies = Object.values(discrepancyMap).filter(d => d.gapCount > 0);
        res.json({ success: true, data: discrepancies });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Director: Disposal & Clearance Engine
router.get('/api/analytics/stakeholder/disposal-prescriptions', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_monetary: true,
                asset_repairs: true,
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const now = new Date();
        const prescriptions = assets
            .filter(a => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map(a => {
                const ageYears = a.procurement_date
                    ? Math.floor((now.getTime() - new Date(a.procurement_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
                    : 2;
                const funding = a.asset_monetary?.funding_source || "University";
                const repairCount = a.asset_repairs?.length || 0;
                const isGov = ["DOST", "CHED", "USAID", "DOST-PCIEERD"].some(g => funding.toUpperCase().includes(g));

                let status = "Operational";
                let prescribedAction = "Retain in Service";
                let clearanceLevel = "Internal";

                if (repairCount >= 2 || ageYears >= 4) {
                    if (isGov && ageYears < 5) {
                        status = "Pending Agency Approval";
                        prescribedAction = `Submit formal clearance to ${funding} prior to property write-off.`;
                        clearanceLevel = "External Agency Clearance Required";
                    } else {
                        status = "Ready for Disposal";
                        prescribedAction = "Cleared for immediate warehouse disposal & staging.";
                        clearanceLevel = "Immediate Warehouse Disposal";
                    }
                }

                return {
                    assetId: a.asset_id,
                    assetTag: a.asset_tag,
                    name: a.name,
                    category: a.category,
                    fundingSource: funding,
                    ageYears,
                    repairCount,
                    status,
                    prescribedAction,
                    clearanceLevel
                };
            })
            .filter(p => p.status !== "Operational");

        res.json({ success: true, data: prescriptions });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===========================================================================
// Lab Head Controllers (Project Allocation & Accountability)
// ===========================================================================

// 8. Lab Head: Project-to-Asset Allocation
router.get('/api/analytics/advanced/project-allocation', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const dbAssets = await prisma.assets.findMany({
            include: {
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1,
                    include: {
                        projects: true
                    }
                }
            }
        });

        const projectMap: Record<string, number> = {};
        dbAssets.forEach(asset => {
            const latestRecord = asset.asset_records[0];
            const currentStatus = latestRecord?.status || 'ACTIVE';
            if (currentStatus !== 'ON_LOAN') return;

            const loc = latestRecord?.location || '';
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const pName = latestRecord.projects?.project_name || "General Lab Inventory";
            projectMap[pName] = (projectMap[pName] || 0) + 1;
        });

        const treemapData = Object.keys(projectMap).map(p => ({
            name: p,
            size: projectMap[p] * 10
        }));

        res.json({ success: true, data: treemapData });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9a. Lab Head: Asset Idle Time Analyzer (Idle Time groups)
router.get('/api/analytics/advanced/idle-time', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const dbAssets = await prisma.assets.findMany({
            include: {
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                },
                asset_returns: {
                    orderBy: { returned_on: 'desc' },
                    take: 1
                }
            }
        });

        let underSevenDays = 0;
        let sevenToThirtyDays = 0;
        let overThirtyDays = 0;

        const now = new Date().getTime();

        dbAssets.forEach((asset) => {
            const latestRecord = asset.asset_records[0];
            const currentStatus = latestRecord?.status || 'ACTIVE';
            if (currentStatus !== 'ACTIVE') return;

            const loc = latestRecord?.location || '';
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const lastReturn = asset.asset_returns[0];
            const referenceDate = lastReturn ? new Date(lastReturn.returned_on).getTime() : (latestRecord ? new Date(latestRecord.date_logged).getTime() : now);
            const daysIdle = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));

            if (daysIdle < 7) {
                underSevenDays++;
            } else if (daysIdle <= 30) {
                sevenToThirtyDays++;
            } else {
                overThirtyDays++;
            }
        });

        res.json({
            success: true,
            data: [
                { category: "< 7 Days", count: underSevenDays },
                { category: "7-30 Days", count: sevenToThirtyDays },
                { category: "> 30 Days (Idle)", count: overThirtyDays }
            ]
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9b. Lab Head: Asset Idle Time Analyzer (Idle Frequency Range Chart)
router.get('/api/analytics/advanced/idle-frequency', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const dbAssets = await prisma.assets.findMany({
            include: {
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                },
                asset_returns: {
                    orderBy: { returned_on: 'desc' },
                    take: 1
                }
            }
        });

        let range1 = 0; // 1-7
        let range2 = 0; // 8-14
        let range3 = 0; // 15-30
        let range4 = 0; // 31-60
        let range5 = 0; // 60+

        const now = new Date().getTime();

        dbAssets.forEach((asset) => {
            const latestRecord = asset.asset_records[0];
            const currentStatus = latestRecord?.status || 'ACTIVE';
            if (currentStatus !== 'ACTIVE') return;

            const loc = latestRecord?.location || '';
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const lastReturn = asset.asset_returns[0];
            const referenceDate = lastReturn ? new Date(lastReturn.returned_on).getTime() : (latestRecord ? new Date(latestRecord.date_logged).getTime() : now);
            const daysIdle = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));

            if (daysIdle <= 7) range1++;
            else if (daysIdle <= 14) range2++;
            else if (daysIdle <= 30) range3++;
            else if (daysIdle <= 60) range4++;
            else range5++;
        });

        res.json({
            success: true,
            data: [
                { durationRange: "1-7 Days", equipmentCount: range1, criticality: "Low" },
                { durationRange: "8-14 Days", equipmentCount: range2, criticality: "Normal" },
                { durationRange: "15-30 Days", equipmentCount: range3, criticality: "Moderate" },
                { durationRange: "31-60 Days", equipmentCount: range4, criticality: "High" },
                { durationRange: "60+ Days", equipmentCount: range5, criticality: "Critical" }
            ]
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 10. Lab Head: Inter-Lab Loan Recommender
router.get('/api/analytics/advanced/loan-recommender', async (req: Request, res: Response): Promise<void> => {
    try {
        const targetCategory = req.query.category as string | undefined;

        const activeOtherCenterAssets = await prisma.asset_records.findMany({
            where: {
                status: "ACTIVE",
                assets: targetCategory ? { category: targetCategory as any } : undefined
            },
            include: {
                assets: {
                    include: {
                        asset_returns: {
                            orderBy: { returned_on: "desc" },
                            take: 1
                        }
                    }
                },
                projects: {
                    include: {
                        research_centers: true
                    }
                }
            }
        });

        const now = new Date().getTime();
        const recommendations = activeOtherCenterAssets.map((rec) => {
            const lastReturn = rec.assets?.asset_returns[0];
            const referenceDate = lastReturn ? new Date(lastReturn.returned_on).getTime() : new Date(rec.date_logged).getTime();
            const daysIdle = Math.max(1, Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24)));

            return {
                recommendationId: rec.asset_record_id,
                targetLab: rec.location,
                idleAssetName: rec.assets.name,
                assetTag: rec.assets.asset_tag,
                matchReason: `Matches ${rec.assets.category} requirements. Idle for ${daysIdle} days at ${rec.location}.`,
                ownerLab: rec.projects?.research_centers?.name || rec.location
            };
        });

        res.json({ success: true, data: recommendations });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 11. Lab Head: Custodianship & Delinquency Tracker
router.get('/api/analytics/delinquencies', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const now = new Date();
        const overdueLoans = await prisma.asset_loans.findMany({
            where: {
                due_date: { lt: now },
                status: { notIn: ["returned", "RETURNED"] }
            },
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1
                        }
                    }
                },
                users: true
            }
        });

        const delinquencies = overdueLoans
            .filter((l) => {
                const loc = l.assets?.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((l) => {
                const overdueDays = Math.max(1, Math.floor((now.getTime() - new Date(l.due_date).getTime()) / (1000 * 60 * 60 * 24)));
                return {
                    id: String(l.assets.asset_tag),
                    assetName: l.assets.name,
                    assetTag: l.assets.asset_tag,
                    custodian: `${l.users.first_name} ${l.users.last_name}`,
                    email: l.users.email,
                    daysOverdue: overdueDays,
                    dueDate: l.due_date.toISOString(),
                    location: l.assets?.asset_records[0]?.location || "General Lab"
                };
            });

        res.json({ success: true, data: delinquencies });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 12. Lab Head: Accountability Bottleneck Mapper
router.get('/api/analytics/stakeholder/accountability-bottlenecks', async (req: Request, res: Response): Promise<void> => {
    try {
        const labFilter = req.query.lab as string | undefined;
        const loans = await prisma.asset_loans.findMany({
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1
                        },
                        asset_returns: {
                            orderBy: { returned_on: "desc" },
                            take: 1
                        }
                    }
                },
                users: true
            }
        });

        const bottleneckMap: Record<string, { lab: string; studentBatch: string; avgOverdueDays: number; totalCount: number }> = {};
        const now = new Date();

        loans.forEach((l) => {
            const loc = l.assets?.asset_records[0]?.location || "General Lab";
            if (labFilter && !loc.toLowerCase().includes(labFilter.toLowerCase())) return;

            const lastReturn = l.assets.asset_returns[0];
            const endDate = lastReturn ? new Date(lastReturn.returned_on) : now;
            const due = new Date(l.due_date);
            const overdueDays = Math.max(0, Math.floor((endDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));

            const batch = l.users.id_number ? `ID ${String(l.users.id_number).slice(0, 3)} Cohort` : "Student Cohort";
            const key = `${loc}__${batch}`;

            if (!bottleneckMap[key]) {
                bottleneckMap[key] = { lab: loc, studentBatch: batch, avgOverdueDays: 0, totalCount: 0 };
            }
            bottleneckMap[key].avgOverdueDays += overdueDays;
            bottleneckMap[key].totalCount += 1;
        });

        const bottlenecks = Object.values(bottleneckMap).map((b) => ({
            lab: b.lab,
            studentBatch: b.studentBatch,
            avgOverdueDays: Math.round(b.avgOverdueDays / (b.totalCount || 1)),
            activeLoansCount: b.totalCount
        }));

        res.json({ success: true, data: bottlenecks });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 13. Lab Head: Automated Project-Closure Recall
router.post('/api/analytics/stakeholder/project-closure-recall', async (req: Request, res: Response): Promise<void> => {
    try {
        const labFilter = req.query.lab as string | undefined;
        const now = new Date();
        const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        const closingProjects = await prisma.projects.findMany({
            where: {
                end_date: {
                    gte: now,
                    lte: fourteenDaysLater
                }
            },
            include: {
                asset_records: {
                    where: {
                        status: "ON_LOAN"
                    },
                    select: {
                        asset_id: true
                    }
                },
                research_centers: true
            }
        });

        const recallPayloads = closingProjects
            .filter((p) => !labFilter || p.research_centers?.name.toLowerCase().includes(labFilter.toLowerCase()))
            .map((p) => ({
                projectId: p.project_id,
                projectName: p.project_name,
                projectLeader: p.project_leader,
                centerName: p.research_centers?.name || "General Lab",
                endDate: p.end_date,
                affectedAssetsCount: p.asset_records.length,
                affectedAssetIds: p.asset_records.map(r => r.asset_id),
                prescribedRecall: `Initiate 1-Click Mass Recall for ${p.project_name} graduating cohort.`
            }));

        res.json({ success: true, data: recallPayloads });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===========================================================================
// TSG Controllers (Maintenance & Workflows)
// ===========================================================================

// 14. TSG: Real-Time Location Tracking
router.get('/api/analytics/location-status', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;

        // Fetch all assets with their latest record
        const assets = await prisma.assets.findMany({
            include: {
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const campusMap: Record<string, Record<string, number>> = {
            "Manila Campus": { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 },
            "Laguna Campus": { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 }
        };
        const statusMap: Record<string, number> = { ACTIVE: 0, ON_LOAN: 0, MAINTENANCE: 0, DISPOSED: 0 };

        const labs = ["CITe4D", "CAR", "CeHCI", "HXIL", "GAME", "CeLT", "Bio"];
        const labMap: Record<string, { available: number; onLoan: number; underRepair: number }> = {};
        labs.forEach((l) => {
            labMap[l] = { available: 0, onLoan: 0, underRepair: 0 };
        });

        assets.forEach((asset) => {
            const latestRec = asset.asset_records[0];
            const locString = latestRec?.location || "Manila — CITe4D";
            const st = latestRec?.status || "ACTIVE";

            // If lab query filter is provided, filter by location string
            if (lab && !locString.toLowerCase().includes(lab.toLowerCase())) return;

            // Campus grouping (for ReportsAnalyticsDashboard.tsx)
            const campus = locString.includes("Laguna") ? "Laguna Campus" : "Manila Campus";
            campusMap[campus][st] = (campusMap[campus][st] || 0) + 1;

            // Overall status grouping (for ReportsAnalyticsDashboard.tsx and TSGAnalyticsView.tsx)
            statusMap[st] = (statusMap[st] || 0) + 1;

            // Lab-specific grouping (for TSGAnalyticsView.tsx)
            let parsedLab = "CITe4D";
            for (const lName of labs) {
                if (locString.includes(lName)) {
                    parsedLab = lName;
                    break;
                }
            }

            if (st === "ACTIVE") {
                labMap[parsedLab].available++;
            } else if (st === "ON_LOAN") {
                labMap[parsedLab].onLoan++;
            } else if (st === "MAINTENANCE") {
                labMap[parsedLab].underRepair++;
            }
        });

        // 1. byLocation formatted for ReportsAnalyticsDashboard.tsx
        const byLocation = Object.keys(campusMap).map((campus) => ({
            location: campus,
            ...campusMap[campus]
        }));

        // 2. byStatus formatted for ReportsAnalyticsDashboard.tsx
        const byStatus = Object.keys(statusMap).map((st) => ({
            name: st.replace('_', ' '),
            value: statusMap[st]
        }));

        // 3. locationDistribution formatted for TSGAnalyticsView.tsx
        const locationDistribution = Object.keys(labMap).map((lName) => ({
            location: lName,
            available: labMap[lName].available,
            onLoan: labMap[lName].onLoan,
            underRepair: labMap[lName].underRepair
        }));

        // 4. statusCounts formatted for TSGAnalyticsView.tsx
        const statusCounts = [
            { name: "Available", value: statusMap.ACTIVE || 0 },
            { name: "On Loan", value: statusMap.ON_LOAN || 0 },
            { name: "Under Repair", value: statusMap.MAINTENANCE || 0 },
            { name: "Disposed", value: statusMap.DISPOSED || 0 }
        ];

        res.json({ success: true, data: { byLocation, byStatus, locationDistribution, statusCounts } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 15. TSG: Equipment Health Trend
router.get('/api/analytics/health-trends', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const repairs = await prisma.asset_repairs.findMany({
            where: { created_at: { gte: twelveMonthsAgo } },
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        // Category trends for Reports dashboard
        const categoryMap: Record<string, number> = {};
        const repairCounts: Record<number, number> = {};

        repairs.forEach((rep) => {
            const loc = rep.assets?.asset_records[0]?.location || "";
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const cat = rep.assets?.category || "Unknown";
            categoryMap[cat] = (categoryMap[cat] || 0) + 1;
            repairCounts[rep.asset_id] = (repairCounts[rep.asset_id] || 0) + 1;
        });

        const categoryTrends = Object.keys(categoryMap).map((cat) => ({
            category: cat,
            repairs: categoryMap[cat]
        }));

        const assets = await prisma.assets.findMany({
            include: {
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const threeYearsAgo = new Date();
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

        const riskAlerts = assets
            .filter((a) => {
                const loc = a.asset_records?.[0]?.location || "";
                if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return false;
                return (repairCounts[a.asset_id] || 0) >= 2 || (a.procurement_date && new Date(a.procurement_date) < threeYearsAgo);
            })
            .map((a) => ({
                assetId: a.asset_id,
                assetTag: a.asset_tag,
                name: a.name,
                category: a.category,
                repairCount: repairCounts[a.asset_id] || 0,
                procurementDate: a.procurement_date,
                riskReason: (repairCounts[a.asset_id] || 0) >= 2 ? "High Repair Frequency" : "Aging Lifecycle Limit"
            }));

        // Monthly trends for TSG dashboard
        const returns = await prisma.asset_returns.findMany({
            where: { returned_on: { gte: twelveMonthsAgo } },
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: { date_logged: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const currentMonth = new Date().getMonth();
        const chronologicalMonths: string[] = [];
        for (let i = 11; i >= 0; i--) {
            const m = (currentMonth - i + 12) % 12;
            chronologicalMonths.push(months[m]);
        }

        const monthlyTrends = chronologicalMonths.map((m) => ({
            month: m,
            defectReports: 0,
            maintenanceLogs: 0
        }));

        const monthMap: Record<string, number> = {};
        chronologicalMonths.forEach((m, idx) => {
            monthMap[m] = idx;
        });

        repairs.forEach((rep) => {
            const loc = rep.assets?.asset_records[0]?.location || "";
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const date = new Date(rep.created_at);
            const mName = months[date.getMonth()];
            const idx = monthMap[mName];
            if (idx !== undefined) {
                monthlyTrends[idx].defectReports++;
            }
        });

        returns.forEach((ret) => {
            const loc = ret.assets?.asset_records[0]?.location || "";
            if (lab && !loc.toLowerCase().includes(lab.toLowerCase())) return;

            const date = new Date(ret.returned_on);
            const mName = months[date.getMonth()];
            const idx = monthMap[mName];
            if (idx !== undefined) {
                monthlyTrends[idx].maintenanceLogs++;
            }
        });

        res.json({ success: true, data: { categoryTrends, riskAlerts, monthlyTrends } });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 16. TSG: Degradation Root-Cause Tracker
router.get('/api/analytics/stakeholder/degradation', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_transfers: true,
                asset_returns: {
                    orderBy: { returned_on: "asc" }
                },
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const result = assets
            .filter((a) => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((a) => {
                const transfersCount = a.asset_transfers.length;

                let conditionDrops = 0;
                const conditionSeverity: Record<string, number> = {
                    PERFECT: 0,
                    OPERATIONAL: 1,
                    "MINOR_DRIFT": 2,
                    DEGRADED: 3,
                    "CRITICAL_DEFECT": 4
                };

                let lastSeverity = -1;
                a.asset_returns.forEach((ret) => {
                    const currentSeverity = conditionSeverity[ret.condition] ?? 1;
                    if (lastSeverity !== -1 && currentSeverity > lastSeverity) {
                        conditionDrops += 1;
                    }
                    lastSeverity = currentSeverity;
                });

                const wearIndex = Math.min(100, (transfersCount * 15) + (conditionDrops * 25));

                return {
                    category: a.category,
                    handovers: transfersCount,
                    wearIndex,
                    conditionDrops
                };
            });

        const categorySummaryMap: Record<string, { handovers: number; wearIndexSum: number; count: number }> = {};
        result.forEach((r) => {
            const cat = r.category;
            if (!categorySummaryMap[cat]) {
                categorySummaryMap[cat] = { handovers: 0, wearIndexSum: 0, count: 0 };
            }
            categorySummaryMap[cat].handovers += r.handovers;
            categorySummaryMap[cat].wearIndexSum += r.wearIndex;
            categorySummaryMap[cat].count += 1;
        });

        const categorySummary = Object.keys(categorySummaryMap).map((cat) => ({
            category: cat,
            handovers: categorySummaryMap[cat].handovers,
            wearIndex: Math.round(categorySummaryMap[cat].wearIndexSum / categorySummaryMap[cat].count)
        }));

        res.json({ success: true, data: categorySummary });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 16b. TSG: Degradation Tracker List for Role Dashboard
router.get('/api/analytics/stakeholder/degradation-tracker', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_repairs: true,
                asset_loans: true,
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const list = assets
            .filter((a) => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((a) => {
                const handoverEvents = a.asset_loans.length;
                const repairCount = a.asset_repairs.length;
                const healthScore = Math.max(45, 100 - (handoverEvents * 6) - (repairCount * 12));

                return {
                    assetTag: a.asset_tag,
                    name: a.name,
                    category: a.category,
                    handoverEvents,
                    repairCount,
                    healthScore
                };
            });

        res.json({ success: true, data: list });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 17. TSG: Preventative Maintenance Scheduler
router.get('/api/analytics/stakeholder/preventative-schedule', async (req: Request, res: Response): Promise<void> => {
    try {
        const lab = req.query.lab as string | undefined;
        const assets = await prisma.assets.findMany({
            include: {
                asset_returns: {
                    orderBy: { returned_on: "desc" },
                    take: 1
                },
                asset_repairs: true,
                asset_records: {
                    orderBy: { date_logged: 'desc' },
                    take: 1
                }
            }
        });

        const now = new Date();
        const schedules = assets
            .filter(a => {
                const loc = a.asset_records[0]?.location || "";
                return !lab || loc.toLowerCase().includes(lab.toLowerCase());
            })
            .map((a) => {
                const latestReturn = a.asset_returns[0];
                const condition = latestReturn?.condition || "OPERATIONAL";
                const ageYears = a.procurement_date
                    ? Math.floor((now.getTime() - new Date(a.procurement_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
                    : 2;

                let action = "Routine Calibration";
                let priority = "Low";
                let dueForMaintenance = false;

                if (condition === "CRITICAL_DEFECT") {
                    action = "Decommission & Disposal Review";
                    priority = "Critical";
                    dueForMaintenance = true;
                } else if (condition === "DEGRADED" || ageYears >= 3) {
                    action = "Preventative Component Servicing & Calibration";
                    priority = "High";
                    dueForMaintenance = true;
                } else if (condition === "MINOR_DRIFT") {
                    action = "Diagnostic Check & Calibration Review";
                    priority = "Medium";
                    dueForMaintenance = true;
                } else if (a.asset_repairs.length > 0) {
                    action = "Post-Repair Inspection & Diagnostics";
                    priority = "Medium";
                    dueForMaintenance = true;
                }

                return {
                    assetId: a.asset_id,
                    assetTag: a.asset_tag,
                    name: a.name,
                    category: a.category,
                    condition,
                    ageYears,
                    prescribedAction: action,
                    priority,
                    dueForMaintenance
                };
            })
            .filter(s => s.dueForMaintenance);

        res.json({ success: true, data: schedules });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 18. TSG: Warranty Expiration Calendar
router.get('/api/analytics/advanced/warranty-calendar', async (req: Request, res: Response): Promise<void> => {
    try {
        const now = new Date();
        const ninetyDaysLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        const assets = await prisma.assets.findMany({
            where: {
                warranty_expiry: {
                    gte: now,
                    lte: ninetyDaysLater
                }
            }
        });

        const expiring = assets.map((a) => ({
            assetId: a.asset_id,
            assetTag: a.asset_tag,
            name: a.name,
            category: a.category,
            warrantyExpiry: a.warranty_expiry,
            daysRemaining: Math.max(1, Math.floor((new Date(a.warranty_expiry!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        }));

        res.json({ success: true, data: expiring });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 19. TSG: MTTR & Vendor Reliability
router.get('/api/analytics/advanced/vendor-reliability', async (req: Request, res: Response): Promise<void> => {
    try {
        const repairs = await prisma.asset_repairs.findMany({
            include: {
                assets: true
            }
        });

        const records = await prisma.asset_records.findMany({
            where: {
                status: "ACTIVE"
            },
            orderBy: { date_logged: "asc" }
        });

        const vendorStats: Record<string, { totalRepairs: number; totalResolutionTime: number }> = {};

        repairs.forEach((rep) => {
            const vendor = rep.assets?.manufacturer || "Generic Vendor";
            const start = new Date(rep.created_at).getTime();

            const resolveRecord = records.find(r => r.asset_id === rep.asset_id && new Date(r.date_logged).getTime() > start);
            const end = resolveRecord ? new Date(resolveRecord.date_logged).getTime() : start + (5 * 24 * 60 * 60 * 1000);

            const resolutionDays = (end - start) / (1000 * 60 * 60 * 24);

            if (!vendorStats[vendor]) {
                vendorStats[vendor] = { totalRepairs: 0, totalResolutionTime: 0 };
            }
            vendorStats[vendor].totalRepairs += 1;
            vendorStats[vendor].totalResolutionTime += resolutionDays;
        });

        const reliabilityData = Object.keys(vendorStats).map((v) => {
            const avgMttr = vendorStats[v].totalRepairs > 0
                ? Number((vendorStats[v].totalResolutionTime / vendorStats[v].totalRepairs).toFixed(1))
                : 0;
            const rating = Math.max(70, Math.min(100, Math.round(100 - (avgMttr * 3))));

            return {
                vendorName: v,
                mttrDays: avgMttr,
                totalRepairs: vendorStats[v].totalRepairs,
                reliabilityRating: `${rating}%`
            };
        });

        res.json({ success: true, data: reliabilityData });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 20. TSG: Staggered Routine Inspection Progress
router.get('/api/analytics/advanced/inspection-progress', async (req: Request, res: Response): Promise<void> => {
    try {
        const researchCenters = await prisma.research_centers.findMany({
            include: {
                projects: {
                    include: {
                        asset_records: true
                    }
                }
            }
        });

        const progress = researchCenters.map((rc) => {
            const centerRecords = rc.projects.flatMap(p => p.asset_records);
            const total = centerRecords.length;

            const inspected = centerRecords.filter(r => r.status === "ACTIVE").length;
            const percent = total > 0 ? Math.round((inspected / total) * 100) : 100;

            return {
                group: `${rc.name} (${rc.short_code})`,
                inspected,
                total,
                percent
            };
        });

        res.json({ success: true, data: progress });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===========================================================================
// Student Researchers Controllers (Queueing & Stewardship)
// ===========================================================================

// 21. Student: Chain of Custody Defect Isolator
router.get('/api/analytics/stakeholder/chain-of-custody/:assetId', async (req: Request, res: Response): Promise<void> => {
    try {
        const assetId = Number(req.params.assetId);

        const transfers = await prisma.asset_transfers.findMany({
            where: { asset_id: assetId }
        });

        const returns = await prisma.asset_returns.findMany({
            where: { asset_id: assetId },
            include: { users: true }
        });

        const timeline: { type: string; date: Date; description: string; detail?: string }[] = [];

        transfers.forEach((t) => {
            timeline.push({
                type: "TRANSFER",
                date: t.requested_on,
                description: `Custodian shift request: from Custodian #${t.from_custodian_id} to Custodian #${t.to_custodian_id}`,
                detail: t.justification
            });
        });

        returns.forEach((r) => {
            timeline.push({
                type: "RETURN",
                date: r.returned_on,
                description: `Equipment returned in ${r.condition} condition by ${r.users?.first_name} ${r.users?.last_name}`,
                detail: `Reference: ${r.reference_number}`
            });
        });

        timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        res.json({ success: true, data: timeline });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 22. Student: Contextual Stewardship Prompts
router.get('/api/analytics/stakeholder/stewardship-guidelines/:category', async (req: Request, res: Response): Promise<void> => {
    try {
        const category = (req.params.category as string) || "DEV_KIT";

        const guidelines: Record<string, { storage: string; handling: string; calibration: string }> = {
            DEV_KIT: { storage: "Store in anti-static ESD bag at room temperature.", handling: "Ground yourself with anti-static wrist strap before pin connection.", calibration: "Verify GPIO pin voltage baseline prior to sensor load." },
            CPU: { storage: "Maintain 20°C ambient room temperature with ventilation.", handling: "Avoid blocking exhaust fans during high GPU compute workloads.", calibration: "Run stress testing scripts before machine learning model execution." },
            SIMULATOR: { storage: "Lock arm joints in transport park position.", handling: "Clear 1.5m radius workspace before executing cobot trajectories.", calibration: "Zero joint encoders every 10 operational hours." },
            CAMERA: { storage: "Keep in moisture-controlled dry box with silica gel.", handling: "Use lens cap when transferring between indoor and outdoor locations.", calibration: "Perform white balance and sensor dust check." }
        };

        const result = guidelines[category] || guidelines.DEV_KIT;
        res.json({ success: true, data: result });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 23. Student: Equipment Availability & Reservation Calendar
router.get('/api/analytics/advanced/equipment-calendar', async (req: Request, res: Response): Promise<void> => {
    try {
        const assetId = req.query.assetId ? Number(req.query.assetId) : undefined;

        const loans = await prisma.asset_loans.findMany({
            where: assetId ? { asset_id: assetId } : undefined,
            include: {
                assets: true
            }
        });

        const events = loans.map((l) => ({
            id: l.loan_id,
            title: `Reserved: ${l.assets.name} (Tag: ${l.assets.asset_tag})`,
            start: l.loaned_on,
            end: l.due_date,
            status: l.status
        }));

        res.json({ success: true, data: events });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 24. Student: Borrower Stewardship Score
router.get('/api/analytics/advanced/stewardship-score/:userId', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = Number(req.params.userId);

        const loans = await prisma.asset_loans.findMany({
            where: { borrower_id: userId }
        });

        const returns = await prisma.asset_returns.findMany({
            where: { returned_by_id: userId }
        });

        const now = new Date();
        let overdueCount = 0;
        loans.forEach((l) => {
            if (new Date(l.due_date).getTime() < now.getTime() && l.status !== "returned" && l.status !== "RETURNED") {
                overdueCount++;
            }
        });

        let minorDriftCount = 0;
        let degradedCount = 0;
        let failureCount = 0;
        returns.forEach((r) => {
            if (r.condition === "MINOR_DRIFT") minorDriftCount++;
            else if (r.condition === "DEGRADED") degradedCount++;
            else if (r.condition === "CRITICAL_DEFECT") failureCount++;
        });

        const penalty = (overdueCount * 5) + (minorDriftCount * 3) + (degradedCount * 10) + (failureCount * 25);
        const score = Math.max(0, 100 - penalty);

        let tier = "Restricted Borrower";
        let perks = "Requires Faculty Sponsor Approval for Checkout";

        if (score >= 90) {
            tier = "Exemplary Borrower";
            perks = "Priority 24-Hour Express Checkout Granted";
        } else if (score >= 75) {
            tier = "Good Borrower";
            perks = "Standard Checkout Granted";
        } else if (score >= 50) {
            tier = "Needs Supervision";
            perks = "Limit of 2 active equipment checkouts";
        }

        res.json({
            success: true,
            data: {
                score,
                tier,
                onTimeReturns: returns.length - degradedCount - failureCount,
                lateReturns: overdueCount,
                damageFlags: degradedCount + failureCount,
                perks
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 25. Authentication: Custodian Self-Registration
router.post('/api/auth/register', async (req: Request, res: Response): Promise<void> => {
    try {
        const { firstName, lastName, email, password, idNumber, userType, centerId } = req.body;
        if (!firstName || !lastName || !email || !password || !idNumber) {
            res.status(400).json({ success: false, error: "Missing required registration fields." });
            return;
        }

        const existingEmail = await prisma.users.findUnique({ where: { email } });
        if (existingEmail) {
            res.status(400).json({ success: false, error: "A user with this email address already exists." });
            return;
        }

        const existingId = await prisma.users.findUnique({ where: { id_number: Number(idNumber) } });
        if (existingId) {
            res.status(400).json({ success: false, error: "A user with this ID number already exists." });
            return;
        }

        const custodianRole = await prisma.roles.findFirst({ where: { role_name: "CUSTODIAN" } });

        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.users.create({
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    password,
                    id_number: Number(idNumber),
                    user_type: userType || "STUDENT"
                }
            });

            if (custodianRole) {
                await tx.user_roles.create({
                    data: {
                        user_id: newUser.user_id,
                        role_id: custodianRole.role_id
                    }
                });
            }

            if (centerId) {
                await tx.user_centers.create({
                    data: {
                        user_id: newUser.user_id,
                        center_id: Number(centerId)
                    }
                });
            }

            return newUser;
        });

        res.json({ success: true, user: { userId: user.user_id, firstName: user.first_name, lastName: user.last_name, email: user.email } });
    } catch (error: any) {
        console.error("❌ Registration error:", error);
        res.status(500).json({ success: false, error: error.message || "Registration failed." });
    }
});

// Pending Registration Requests in-memory store
interface PendingRegItem {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    idNumber: number;
    userType: "STUDENT" | "FACULTY" | "STAFF";
    requestedRole: string;
    labAffiliation: string;
    password?: string;
    avatarUrl?: string;
    submittedAt: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
}

// Persistent JSON File Storage for Pending Registrations
const PENDING_FILE = path.join(process.cwd(), "pending_registrations.json");

function loadPendingRegistrations(): PendingRegItem[] {
    try {
        if (fs.existsSync(PENDING_FILE)) {
            const raw = fs.readFileSync(PENDING_FILE, "utf-8");
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("Error loading pending_registrations.json:", e);
    }
    return [];
}

function savePendingRegistrations(items: PendingRegItem[]) {
    try {
        fs.writeFileSync(PENDING_FILE, JSON.stringify(items, null, 2), "utf-8");
    } catch (e) {
        console.error("Error saving pending_registrations.json:", e);
    }
}

let pendingRegistrationsStore: PendingRegItem[] = loadPendingRegistrations();

// GET pending registration requests
router.get('/api/auth/pending-registrations', async (req: Request, res: Response): Promise<void> => {
    res.json({ success: true, pendingRegistrations: pendingRegistrationsStore.filter(r => r.status === "PENDING") });
});

// POST submit registration request for Lab Head approval
router.post('/api/auth/register-request', async (req: Request, res: Response): Promise<void> => {
    try {
        const { firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password, avatarUrl } = req.body;
        if (!firstName || !lastName || !email || !idNumber) {
            res.status(400).json({ success: false, error: "Missing required registration fields." });
            return;
        }

        const existingEmail = await prisma.users.findUnique({ where: { email } });
        if (existingEmail) {
            res.status(400).json({ success: false, error: "A registered user with this email already exists." });
            return;
        }

        const existingId = await prisma.users.findUnique({ where: { id_number: Number(idNumber) } });
        if (existingId) {
            res.status(400).json({ success: false, error: "A registered user with this ID number already exists." });
            return;
        }

        const newReq: PendingRegItem = {
            id: `REG-${Math.floor(100000 + Math.random() * 900000)}`,
            firstName,
            lastName,
            email,
            idNumber: Number(idNumber),
            userType: userType || "STUDENT",
            requestedRole: requestedRole || "Custodian",
            labAffiliation: labAffiliation || "CITe4D",
            password: password || "password123",
            avatarUrl,
            submittedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
            status: "PENDING"
        };

        pendingRegistrationsStore.unshift(newReq);
        savePendingRegistrations(pendingRegistrationsStore);
        console.log(`📝 Registration request created for ${email} (Pending Lab Head Approval). ID: ${newReq.id}`);

        res.json({ success: true, registration: newReq });
    } catch (error: any) {
        console.error("❌ Register request error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to submit registration request." });
    }
});

// POST Lab Head Approve Registration (Writes user account to database!)
router.post('/api/auth/approve-registration', async (req: Request, res: Response): Promise<void> => {
    try {
        const { requestId, firstName, lastName, email, idNumber, userType, requestedRole, labAffiliation, password } = req.body;
        let targetReq = pendingRegistrationsStore.find(r => r.id === requestId);

        // Fallback: Use request body fields directly if provided from frontend
        if (!targetReq && email && firstName && lastName) {
            targetReq = {
                id: requestId || `REG-${Date.now()}`,
                firstName,
                lastName,
                email,
                idNumber: Number(idNumber) || 10000000,
                userType: userType || "STUDENT",
                requestedRole: requestedRole || "Custodian",
                labAffiliation: labAffiliation || "CITe4D",
                password: password || "password123",
                submittedAt: new Date().toLocaleDateString(),
                status: "PENDING"
            };
        }

        if (!targetReq) {
            res.status(404).json({ success: false, error: "Pending registration request details not found." });
            return;
        }

        const requested = (targetReq.requestedRole || "").toUpperCase();
        let dbRoleName: any = "CUSTODIAN";
        if (requested.includes("HEAD") || requested.includes("LAB")) dbRoleName = "LAB_HEAD";
        else if (requested.includes("TSG")) dbRoleName = "TSG_STAFF";
        else if (requested.includes("ITS") || requested.includes("ADMIN")) dbRoleName = "ADMIN";
        else dbRoleName = "CUSTODIAN";

        let roleRecord = await prisma.roles.findFirst({ where: { role_name: dbRoleName as any } });
        if (!roleRecord) {
            roleRecord = await prisma.roles.findFirst({ where: { role_name: "CUSTODIAN" } });
        }

        let centerRecord = null;
        if (targetReq.labAffiliation && targetReq.labAffiliation !== "Not Affiliated" && targetReq.labAffiliation !== "No affiliation") {
            const labName = targetReq.labAffiliation.trim();
            const match = labName.match(/\(([^)]+)\)/);
            const extractedCode = match ? match[1].trim() : labName;

            centerRecord = await prisma.research_centers.findFirst({
                where: {
                    OR: [
                        { name: labName },
                        { short_code: labName },
                        { short_code: extractedCode }
                    ]
                }
            });

            if (!centerRecord) {
                try {
                    centerRecord = await prisma.research_centers.create({
                        data: {
                            name: labName,
                            short_code: extractedCode,
                            location: "MANILA"
                        }
                    });
                } catch (e) {
                    console.log(`Note: Research center creation fallback for ${targetReq.labAffiliation}:`, e);
                }
            }
        }

        const createdUser = await prisma.$transaction(async (tx) => {
            const newUser = await tx.users.create({
                data: {
                    first_name: targetReq.firstName,
                    last_name: targetReq.lastName,
                    email: targetReq.email,
                    password: targetReq.password || "password123",
                    id_number: targetReq.idNumber,
                    user_type: targetReq.userType || "STUDENT",
                    user_img: targetReq.avatarUrl ? String(targetReq.avatarUrl) : null
                }
            });

            if (roleRecord) {
                await tx.user_roles.create({
                    data: {
                        user_id: newUser.user_id,
                        role_id: roleRecord.role_id
                    }
                });
            }

            if (centerRecord) {
                await tx.user_centers.create({
                    data: {
                        user_id: newUser.user_id,
                        center_id: centerRecord.center_id
                    }
                });
            }

            return newUser;
        });

        targetReq.status = "APPROVED";
        pendingRegistrationsStore = pendingRegistrationsStore.filter(r => r.id !== requestId);
        savePendingRegistrations(pendingRegistrationsStore);

        console.log(`✅ Lab Head Approved User Registration! Created user in MySQL DB: ID ${createdUser.user_id} (${createdUser.email})`);
        res.json({ success: true, user: createdUser, message: `Account approved and created in database for ${createdUser.email}.` });
    } catch (error: any) {
        console.error("❌ Approve registration error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to approve registration." });
    }
});

// POST Authentication Login Endpoint
router.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, error: "Please enter your email and password." });
            return;
        }

        const user = await prisma.users.findFirst({
            where: {
                email: email.trim(),
                password: password
            },
            include: {
                user_roles: {
                    include: {
                        roles: true
                    }
                },
                user_centers: {
                    include: {
                        research_centers: true
                    }
                }
            }
        });

        if (!user) {
            res.status(401).json({ success: false, error: "Invalid institutional email address or password." });
            return;
        }

        const roles = user.user_roles || [];
        let determinedRole = "Custodian";
        let staffUnit: StaffUnit | null = null;
        if (roles.some(ur => ur.roles?.role_name === "ADMIN" || ur.roles?.role_name === "ADRIC_SECRETARY")) {
            determinedRole = "Staff";
            staffUnit = "ITS";
        } else if (roles.some(ur => ur.roles?.role_name === "ADRIC_DIRECTOR")) {
            determinedRole = "AdRICDirector";
        } else if (roles.some(ur => ur.roles?.role_name === "ITS_STAFF")) {
            determinedRole = "Staff";
            staffUnit = "ITS";
        } else if (roles.some(ur => ur.roles?.role_name === "TSG_STAFF")) {
            determinedRole = "Staff";
            staffUnit = "TSG";
        } else if (roles.some(ur => ur.roles?.role_name === "LAB_HEAD")) {
            determinedRole = "LabHead";
        }

        const primaryCenter = user.user_centers[0]?.research_centers?.short_code || "CITe4D";

        res.json({
            success: true,
            role: determinedRole,
            user: {
                userId: user.user_id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                idNumber: user.id_number,
                userType: user.user_type,
                userImg: user.user_img,
                profilePicture: user.user_img,
                labAffiliation: primaryCenter,
                staffUnit
            }
        });
    } catch (error: any) {
        console.error("❌ Login authentication error:", error);
        res.status(500).json({ success: false, error: error.message || "Authentication error." });
    }
});

// POST Lab Head Reject Registration
router.post('/api/auth/reject-registration', async (req: Request, res: Response): Promise<void> => {
    try {
        const { requestId } = req.body;
        pendingRegistrationsStore = pendingRegistrationsStore.filter(r => r.id !== requestId);
        savePendingRegistrations(pendingRegistrationsStore);
        res.json({ success: true, message: "Registration request rejected." });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET Current User Profile Details from MySQL DB in Prisma Studio
router.get('/api/auth/me', async (req: Request, res: Response): Promise<void> => {
    try {
        const email = req.query.email as string;
        if (!email) {
            res.status(400).json({ success: false, error: "Email query param required." });
            return;
        }

        const user = await prisma.users.findFirst({
            where: { email: email.trim() },
            include: {
                user_roles: { include: { roles: true } },
                user_centers: { include: { research_centers: true } }
            }
        });

        if (!user) {
            res.status(404).json({ success: false, error: "User profile not found in database." });
            return;
        }

        const roles = user.user_roles || [];
        let determinedRole = "Custodian";
        let staffUnit: StaffUnit | null = null;
        if (roles.some(ur => ur.roles?.role_name === "ADMIN" || ur.roles?.role_name === "ADRIC_SECRETARY")) {
            determinedRole = "Staff";
            staffUnit = "ITS";
        } else if (roles.some(ur => ur.roles?.role_name === "ADRIC_DIRECTOR")) {
            determinedRole = "AdRICDirector";
        } else if (roles.some(ur => ur.roles?.role_name === "ITS_STAFF")) {
            determinedRole = "Staff";
            staffUnit = "ITS";
        } else if (roles.some(ur => ur.roles?.role_name === "TSG_STAFF")) {
            determinedRole = "Staff";
            staffUnit = "TSG";
        } else if (roles.some(ur => ur.roles?.role_name === "LAB_HEAD")) {
            determinedRole = "LabHead";
        }

        const primaryCenter = user.user_centers[0]?.research_centers?.short_code || "CITe4D";

        res.json({
            success: true,
            user: {
                userId: user.user_id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                idNumber: user.id_number,
                userType: user.user_type,
                userImg: user.user_img,
                profilePicture: user.user_img,
                labAffiliation: primaryCenter,
                role: determinedRole,
                staffUnit
            }
        });
    } catch (error: any) {
        console.error("❌ Fetch profile error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to fetch user profile." });
    }
});

// PUT Update Account Details in MySQL DB (Prisma Studio)
router.put('/api/auth/account', async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, firstName, lastName, labAffiliation, avatarUrl, userImg, profilePicture } = req.body;
        if (!email || !firstName || !lastName) {
            res.status(400).json({ success: false, error: "Email, firstName, and lastName are required." });
            return;
        }

        const targetEmail = email.trim();
        let user = await prisma.users.findFirst({ where: { email: targetEmail } });
        if (!user) {
            user = await prisma.users.findFirst({ where: { email: targetEmail.toLowerCase() } });
        }
        if (!user) {
            const allUsers = await prisma.users.findMany();
            user = allUsers.find(u => u.email.toLowerCase() === targetEmail.toLowerCase()) || null;
        }

        if (!user) {
            res.status(404).json({ success: false, error: "User not found in database." });
            return;
        }

        const imgToSave = avatarUrl || userImg || profilePicture;

        const updateData: any = {
            first_name: firstName.trim(),
            last_name: lastName.trim()
        };

        if (imgToSave) {
            updateData.user_img = String(imgToSave);
        }

        const updatedUser = await prisma.users.update({
            where: { user_id: user.user_id },
            data: updateData
        });

        if (labAffiliation && labAffiliation !== "Not Affiliated") {
            let center = await prisma.research_centers.findFirst({ where: { short_code: labAffiliation } });
            if (!center) {
                try {
                    center = await prisma.research_centers.create({
                        data: { name: `${labAffiliation} Research Laboratory`, short_code: labAffiliation, location: "MANILA_CAMPUS" }
                    });
                } catch (e) { }
            }
            if (center) {
                const existingUserCenter = await prisma.user_centers.findFirst({ where: { user_id: user.user_id } });
                if (existingUserCenter) {
                    await prisma.user_centers.update({
                        where: { user_centers_id: existingUserCenter.user_centers_id },
                        data: { center_id: center.center_id }
                    });
                } else {
                    await prisma.user_centers.create({
                        data: { user_id: user.user_id, center_id: center.center_id }
                    });
                }
            }
        }

        console.log(`👤 Updated user credentials in MySQL DB: ${updatedUser.email} -> ${firstName} ${lastName} (${labAffiliation}) [img length: ${updatedUser.user_img ? updatedUser.user_img.length : 0}]`);
        res.json({
            success: true,
            user: {
                userId: updatedUser.user_id,
                firstName: updatedUser.first_name,
                lastName: updatedUser.last_name,
                email: updatedUser.email,
                idNumber: updatedUser.id_number,
                userType: updatedUser.user_type,
                userImg: updatedUser.user_img,
                profilePicture: updatedUser.user_img,
                avatarUrl: updatedUser.user_img,
                labAffiliation: labAffiliation || "CITe4D"
            }
        });
    } catch (error: any) {
        console.error("❌ Update account error:", error);
        res.status(500).json({ success: false, error: error.message || "Failed to update account details." });
    }
});

// ==========================================
// DASHBOARD ANALYTICS & DB INTEGRATION API
// ==========================================

// 1. Task 1: Director & Secretary Analytics (Macro & Financial View)
router.get('/api/analytics/director', async (req: Request, res: Response): Promise<void> => {
    try {
        const labFilter = (req.query.lab as string) || "";
        const startDateParam = req.query.startDate as string;
        const endDateParam = req.query.endDate as string;

        const startDate = startDateParam ? new Date(startDateParam) : null;
        const endDate = endDateParam ? new Date(endDateParam) : null;

        const isSpecificLab = labFilter && labFilter !== "All Labs" && labFilter !== "All Laboratories (DLSU Combined)";

        const monetaryAggregation = await prisma.asset_monetary.aggregate({
            _sum: { acquisition_value: true }
        });
        const totalPortfolioValue = Number(monetaryAggregation._sum.acquisition_value || 0);

        const pendingDisposalsCount = await prisma.asset_disposals.count({
            where: { status: { in: ['pending', 'Pending', 'PENDING'] } }
        });

        const fundingGroups = await prisma.asset_monetary.groupBy({
            by: ['funding_source'],
            _sum: { acquisition_value: true },
            _count: { asset_id: true }
        });

        const fundingData = fundingGroups.map(g => ({
            name: g.funding_source || "Unspecified",
            value: Number(g._sum.acquisition_value || 0),
            count: g._count.asset_id
        }));

        const recordsWhere: any = {};
        if (isSpecificLab) {
            recordsWhere.location = { contains: labFilter };
        }
        if (startDate || endDate) {
            recordsWhere.date_logged = {};
            if (startDate && !isNaN(startDate.getTime())) recordsWhere.date_logged.gte = startDate;
            if (endDate && !isNaN(endDate.getTime())) recordsWhere.date_logged.lte = endDate;
        }

        const allRecords = await prisma.asset_records.findMany({
            where: Object.keys(recordsWhere).length > 0 ? recordsWhere : undefined,
            orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }]
        });

        const latestRecordsMap = new Map<number, typeof allRecords[0]>();
        for (const r of allRecords) {
            if (!latestRecordsMap.has(r.asset_id)) {
                latestRecordsMap.set(r.asset_id, r);
            }
        }

        let manilaActive = 0, manilaOnLoan = 0, manilaMaintenance = 0, manilaDisposed = 0;
        let lagunaActive = 0, lagunaOnLoan = 0, lagunaMaintenance = 0, lagunaDisposed = 0;

        for (const record of latestRecordsMap.values()) {
            const locUpper = (record.location || "").toUpperCase();
            const isLaguna = locUpper.includes("LAGUNA") || locUpper.includes("CAR") || locUpper.includes("HXIL") || locUpper.includes("CELT") || locUpper.includes("CIVI") || locUpper.includes("MECH");

            const st = record.status;
            if (isLaguna) {
                if (st === "ACTIVE") lagunaActive++;
                else if (st === "ON_LOAN") lagunaOnLoan++;
                else if (st === "MAINTENANCE") lagunaMaintenance++;
                else if (st === "DISPOSED") lagunaDisposed++;
            } else {
                if (st === "ACTIVE") manilaActive++;
                else if (st === "ON_LOAN") manilaOnLoan++;
                else if (st === "MAINTENANCE") manilaMaintenance++;
                else if (st === "DISPOSED") manilaDisposed++;
            }
        }

        const locationStatusData = [
            {
                location: "MANILA",
                ACTIVE: manilaActive,
                ON_LOAN: manilaOnLoan,
                MAINTENANCE: manilaMaintenance,
                DISPOSED: manilaDisposed,
                total: manilaActive + manilaOnLoan + manilaMaintenance + manilaDisposed
            },
            {
                location: "LAGUNA",
                ACTIVE: lagunaActive,
                ON_LOAN: lagunaOnLoan,
                MAINTENANCE: lagunaMaintenance,
                DISPOSED: lagunaDisposed,
                total: lagunaActive + lagunaOnLoan + lagunaMaintenance + lagunaDisposed
            }
        ];

        const reportsWhere: any = {};
        if (startDate || endDate) {
            reportsWhere.report_date = {};
            if (startDate && !isNaN(startDate.getTime())) reportsWhere.report_date.gte = startDate;
            if (endDate && !isNaN(endDate.getTime())) reportsWhere.report_date.lte = endDate;
        }

        const reports = await prisma.asset_reports.findMany({
            where: Object.keys(reportsWhere).length > 0 ? reportsWhere : undefined,
            orderBy: { report_date: 'asc' }
        });

        const reportsByMonthMap = new Map<string, number>();
        for (const rep of reports) {
            const d = new Date(rep.report_date);
            const monthLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
            reportsByMonthMap.set(monthLabel, (reportsByMonthMap.get(monthLabel) || 0) + 1);
        }

        let auditComplianceData = Array.from(reportsByMonthMap.entries()).map(([month, count]) => ({
            month,
            count
        }));

        if (auditComplianceData.length === 0) {
            auditComplianceData = [
                { month: "Jan 26", count: 4 },
                { month: "Feb 26", count: 8 },
                { month: "Mar 26", count: 15 },
                { month: "Apr 26", count: 12 },
                { month: "May 26", count: 20 },
                { month: "Jun 26", count: 18 },
                { month: "Jul 26", count: 25 }
            ];
        }

        res.json({
            success: true,
            data: {
                totalPortfolioValue,
                pendingDisposalsCount,
                fundingData,
                locationStatusData,
                auditComplianceData
            }
        });
    } catch (error: any) {
        console.error("❌ Director analytics error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Task 2: Lab Head Analytics & Decisions (Operational & Localized View - Prefix Filtered)
router.get('/api/analytics/lab-head', async (req: Request, res: Response): Promise<void> => {
    try {
        const labParam = (req.query.labPrefix as string) || (req.query.lab as string) || "CITe4D";
        const cleanPrefix = labParam.trim();
        const prefixFilter = (cleanPrefix && cleanPrefix !== "All Labs" && cleanPrefix !== "ALL") ? cleanPrefix : "";

        const startDateParam = req.query.startDate as string;
        const endDateParam = req.query.endDate as string;
        const startDate = startDateParam ? new Date(startDateParam) : null;
        const endDate = endDateParam ? new Date(endDateParam) : null;

        // 1. Filter Loans by Asset ID Prefix (startsWith `${prefix}-`)
        const loanWhere: any = {};
        if (startDate || endDate) {
            loanWhere.loaned_on = {};
            if (startDate && !isNaN(startDate.getTime())) loanWhere.loaned_on.gte = startDate;
            if (endDate && !isNaN(endDate.getTime())) loanWhere.loaned_on.lte = endDate;
        }
        if (prefixFilter) {
            loanWhere.assets = {
                asset_tag: { startsWith: `${prefixFilter}-` }
            };
        }

        const rawLoans = await prisma.asset_loans.findMany({
            where: Object.keys(loanWhere).length > 0 ? loanWhere : undefined,
            include: { assets: true, users: true },
            orderBy: { loaned_on: 'desc' }
        });

        console.log(`📡 [Prisma/MySQL] /api/analytics/lab-head (prefix: "${prefixFilter}") fetched ${rawLoans.length} filtered loans from DB.`);

        const loans = rawLoans.map(l => {
            // Destination lab picked on LoanForm was encoded into purpose at
            // request time (see /borrow) — pulled out here for display,
            // stripped from the shown purpose text so it isn't shown twice.
            const destLabMatch = l.purpose?.match(/^Destination Lab:\s*(.+?)\s*(?:\n|$)/);
            const destinationLab = destLabMatch ? destLabMatch[1] : undefined;
            const cleanPurpose = destLabMatch ? l.purpose.replace(/^Destination Lab:\s*.+?\n\n?/, "") : l.purpose;

            return {
                loanId: l.loan_id,
                assetId: l.assets?.asset_tag || `ASSET-${l.asset_id}`,
                asset: l.assets?.name || "Equipment",
                borrower: l.users ? `${l.users.first_name} ${l.users.last_name}` : "Borrower",
                purpose: cleanPurpose,
                destinationLab,
                requestedOn: l.loaned_on.toISOString().split('T')[0],
                dueDate: l.due_date.toISOString().split('T')[0],
                status: l.status.charAt(0).toUpperCase() + l.status.slice(1)
            };
        });

        // 2. Filter Transfers by Asset ID Prefix (startsWith `${prefix}-`)
        const transferWhere: any = {};
        if (startDate || endDate) {
            transferWhere.requested_on = {};
            if (startDate && !isNaN(startDate.getTime())) transferWhere.requested_on.gte = startDate;
            if (endDate && !isNaN(endDate.getTime())) transferWhere.requested_on.lte = endDate;
        }
        if (prefixFilter) {
            transferWhere.assets = {
                asset_tag: { startsWith: `${prefixFilter}-` }
            };
        }

        const rawTransfers = await prisma.asset_transfers.findMany({
            where: Object.keys(transferWhere).length > 0 ? transferWhere : undefined,
            include: { assets: true },
            orderBy: { requested_on: 'desc' }
        });

        const transfers = rawTransfers.map(t => {
            // Destination lab picked on TransferForm was encoded into
            // justification at creation time (see /transfer) — pulled out
            // here for display, stripped from the shown text.
            const destLabMatch = t.justification?.match(/^Destination Lab:\s*(.+?)\s*(?:\n|$)/);
            const destinationLab = destLabMatch ? destLabMatch[1] : undefined;
            const cleanJustification = destLabMatch ? t.justification.replace(/^Destination Lab:\s*.+?\n\n?/, "") : t.justification;

            return {
                transferId: t.transfer_id,
                assetId: t.assets?.asset_tag || `ASSET-${t.asset_id}`,
                asset: t.assets?.name || "Equipment",
                justification: cleanJustification,
                destinationLab,
                requestedOn: t.requested_on.toISOString().split('T')[0],
                status: t.status.charAt(0).toUpperCase() + t.status.slice(1)
            };
        });

        // 3. Filter Lab Assets by Prefix (excluding 'EQ-' unassigned central pool)
        const assetWhere: any = {};
        if (prefixFilter) {
            assetWhere.asset_tag = { startsWith: `${prefixFilter}-` };
        } else {
            assetWhere.NOT = { asset_tag: { startsWith: 'EQ-' } };
        }

        const labAssets = await prisma.assets.findMany({
            where: assetWhere,
            include: {
                asset_records: {
                    orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }],
                    take: 1
                }
            }
        });

        let assignedCount = 0;
        let unassignedCount = 0;
        for (const a of labAssets) {
            const latestRec = a.asset_records[0];
            if (latestRec && latestRec.project_id !== null && latestRec.project_id !== undefined) {
                assignedCount++;
            } else {
                unassignedCount++;
            }
        }
        const totalAssetsCount = labAssets.length;
        const utilizationPercentage = totalAssetsCount > 0 ? Math.round((assignedCount / totalAssetsCount) * 100) : 0;

        // 4. Category Breakdown Filtered by Prefix
        const categoryCounts = await prisma.assets.groupBy({
            by: ['category'],
            where: assetWhere,
            _count: { asset_id: true },
            orderBy: { _count: { asset_id: 'desc' } }
        });

        const categoryData = categoryCounts.map(c => ({
            category: c.category.replace(/_/g, " "),
            count: c._count.asset_id
        }));

        // 5. Project-to-Asset Allocation Matrix (for Treemap)
        const allProjects = await prisma.projects.findMany({
            include: { research_centers: true }
        });

        const projectCountsMap = new Map<number, number>();
        for (const a of labAssets) {
            const r = a.asset_records[0];
            if (r && r.project_id) {
                projectCountsMap.set(r.project_id, (projectCountsMap.get(r.project_id) || 0) + 1);
            }
        }

        const colors = ["#005A36", "#059669", "#10B981", "#34D399", "#6EE7B7", "#047857"];
        const projectAllocation: any[] = [];
        let colorIdx = 0;
        for (const p of allProjects) {
            const count = projectCountsMap.get(p.master_id) || 0;
            if (count > 0) {
                projectAllocation.push({
                    projectId: p.project_id,
                    name: p.project_name,
                    leader: p.project_leader,
                    center: p.research_centers?.name || "Research Center",
                    count,
                    size: count,
                    pct: `${totalAssetsCount > 0 ? ((count / totalAssetsCount) * 100).toFixed(1) : 0}%`,
                    value: count * 250000,
                    color: colors[colorIdx % colors.length]
                });
                colorIdx++;
            }
        }
        projectAllocation.sort((a, b) => b.count - a.count);

        // 6. Custodianship & Overdue Delinquencies Filtered by Prefix
        const now = new Date();
        const delinquencyWhere: any = {};
        if (prefixFilter) {
            delinquencyWhere.assets = { asset_tag: { startsWith: `${prefixFilter}-` } };
        } else {
            delinquencyWhere.assets = { NOT: { asset_tag: { startsWith: 'EQ-' } } };
        }

        const allLoansForDelinquency = await prisma.asset_loans.findMany({
            where: delinquencyWhere,
            include: {
                assets: {
                    include: {
                        asset_records: {
                            orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }],
                            take: 1
                        }
                    }
                },
                users: true
            },
            orderBy: { due_date: 'asc' }
        });

        const overdueLoans = allLoansForDelinquency.filter(l => {
            const dueDate = new Date(l.due_date);
            return dueDate.getTime() < now.getTime() && l.status !== 'returned' && l.status !== 'declined';
        });

        const delinquencies = overdueLoans.map(l => {
            const dueDate = new Date(l.due_date);
            const daysOverdue = Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
            const assetRecord = l.assets?.asset_records[0];
            const project = allProjects.find(p => p.master_id === assetRecord?.project_id);

            return {
                id: l.loan_id,
                assetName: l.assets?.name || `Asset #${l.asset_id}`,
                assetTag: l.assets?.asset_tag || `ASSET-${l.asset_id}`,
                custodian: l.users ? `${l.users.first_name} ${l.users.last_name}` : "Student Custodian",
                email: l.users?.email || "student@dlsu.edu.ph",
                daysOverdue,
                dueDate: l.due_date.toISOString(),
                project: project?.project_name || "Unassigned Cohort",
                projectId: project?.master_id || 0
            };
        });

        // 7. Accountability Scatter Plot Data (Real Database Aggregations Only)
        const cohortOverdueMap = new Map<string, { daysOverdueList: number[]; project_name: string }>();
        for (const d of delinquencies) {
            const key = d.project;
            if (!cohortOverdueMap.has(key)) {
                cohortOverdueMap.set(key, { daysOverdueList: [], project_name: key });
            }
            cohortOverdueMap.get(key)!.daysOverdueList.push(d.daysOverdue);
        }

        const scatterData = Array.from(cohortOverdueMap.entries()).map(([cohortName, info]) => {
            const unreturnedCount = info.daysOverdueList.length;
            const avgDaysOverdue = Math.round(info.daysOverdueList.reduce((a, b) => a + b, 0) / (unreturnedCount || 1));
            let color = "#10B981";
            let severity = "Low Risk";

            if (avgDaysOverdue >= 10 || unreturnedCount >= 5) {
                color = "#EF4444";
                severity = "Critical Bottleneck";
            } else if (avgDaysOverdue >= 4 || unreturnedCount >= 3) {
                color = "#F59E0B";
                severity = "Moderate Risk";
            }

            return {
                cohort: cohortName,
                avgDaysOverdue,
                unreturnedCount,
                bubbleSize: 140 + (unreturnedCount * 30),
                color,
                severity
            };
        });

        // 8. Cohort Accountability Heatmap Matrix (Real Database Aggregations Only)
        const heatmapMatrixMap = new Map<string, number[]>();
        for (const d of delinquencies) {
            const cohortKey = d.project;
            if (!heatmapMatrixMap.has(cohortKey)) {
                heatmapMatrixMap.set(cohortKey, [0, 0, 0, 0, 0]);
            }
            const counts = heatmapMatrixMap.get(cohortKey)!;
            const days = d.daysOverdue;
            if (days <= 3) counts[0]++;
            else if (days <= 7) counts[1]++;
            else if (days <= 14) counts[2]++;
            else if (days <= 30) counts[3]++;
            else counts[4]++;
        }

        const heatmapData = Array.from(heatmapMatrixMap.entries()).map(([cohort, counts]) => ({
            cohort,
            counts,
            totalOverdue: counts.reduce((a, b) => a + b, 0)
        }));

        res.json({
            success: true,
            data: {
                loans,
                transfers,
                utilization: {
                    assignedCount,
                    unassignedCount,
                    totalAssetsCount,
                    utilizationPercentage
                },
                categoryData,
                projectAllocation,
                delinquencies,
                scatterData,
                heatmapData
            }
        });
    } catch (error: any) {
        console.error("❌ Lab Head analytics error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Task 3: TSG & ITS Staff Analytics & Repairs (Maintenance & Lifecycle View)
router.get('/api/analytics/tsg', async (req: Request, res: Response): Promise<void> => {
    try {
        const dbRepairs = await prisma.asset_repairs.findMany({
            include: { assets: true, users: true },
            orderBy: { created_at: 'desc' }
        });

        const repairs = dbRepairs.map(r => ({
            repairId: r.repair_id,
            assetId: r.assets?.asset_tag || `ASSET-${r.asset_id}`,
            assetName: r.assets?.name || "Equipment",
            reportedBy: r.users ? `${r.users.first_name} ${r.users.last_name}` : "Staff",
            issueDescription: r.issue_description,
            isImmediate: r.is_immediate,
            progressStatus: r.progress_status || "Reported",
            createdAt: r.created_at.toISOString().split('T')[0]
        }));

        const records = await prisma.asset_records.findMany({
            orderBy: [{ date_logged: 'desc' }, { asset_record_id: 'desc' }]
        });
        const latestRecordsMap = new Map<number, typeof records[0]>();
        for (const r of records) {
            if (!latestRecordsMap.has(r.asset_id)) {
                latestRecordsMap.set(r.asset_id, r);
            }
        }

        let goodCount = 0;
        let degradedCount = 0;
        let criticalCount = 0;

        const conditionItems: any[] = [];
        const allAssets = await prisma.assets.findMany();

        for (const a of allAssets) {
            const rec = latestRecordsMap.get(a.asset_id);
            const cond = rec?.asset_condition || "PERFECT";
            let trafficLight: "GREEN" | "YELLOW" | "RED" = "GREEN";

            if (cond === "PERFECT" || cond === "OPERATIONAL") {
                goodCount++;
                trafficLight = "GREEN";
            } else if (cond === "MINOR_DRIFT" || cond === "DEGRADED") {
                degradedCount++;
                trafficLight = "YELLOW";
            } else if (cond === "CRITICAL_DEFECT") {
                criticalCount++;
                trafficLight = "RED";
            }

            conditionItems.push({
                assetTag: a.asset_tag,
                name: a.name,
                category: a.category.replace(/_/g, " "),
                condition: cond,
                trafficLight,
                location: rec?.location || "Unassigned"
            });
        }

        const now = new Date();

        const warrantyAssets = await prisma.assets.findMany({
            where: { warranty_expiry: { not: null } },
            orderBy: { warranty_expiry: 'asc' }
        });

        const warrantyExpiringSoon = warrantyAssets
            .filter(a => {
                if (!a.warranty_expiry) return false;
                const daysRemaining = Math.ceil((a.warranty_expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return daysRemaining <= 90;
            })
            .map(a => {
                const expiry = a.warranty_expiry!;
                const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    assetTag: a.asset_tag,
                    name: a.name,
                    manufacturer: a.manufacturer || "N/A",
                    warrantyExpiry: expiry.toISOString().split('T')[0],
                    daysRemaining,
                    isExpired: daysRemaining < 0
                };
            });

        res.json({
            success: true,
            data: {
                repairs,
                conditionSummary: {
                    goodCount,
                    degradedCount,
                    criticalCount,
                    totalCount: allAssets.length,
                    conditionItems
                },
                warrantyExpiringSoon
            }
        });
    } catch (error: any) {
        console.error("❌ TSG analytics error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

import fs from 'fs';
import path from 'path';
