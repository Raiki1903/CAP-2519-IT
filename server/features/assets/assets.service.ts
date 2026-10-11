import type { asset_records, assets } from '@prisma/client';
import type { AssetCreateInput, AssetListItem, AssetUpdateInput, CustodianHistory } from '@shared/types/assets';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import { ASSET_CATEGORIES } from '@shared/enums/assetCategory';
import * as assetsRepository from './assets.repository';
import { checkAssetImage } from './assets.validation';
import { AppError } from '../../shared/errors/AppError';
import { DEFAULT_CUSTODIAN_ID } from '../../shared/constants/defaultCustodian';

/** Lists every asset with its current state, shaped for the screens. */
export async function listAssets(): Promise<AssetListItem[]> {
    const [dbAssets, dbMonetaries, dbRecords, dbUsers, dbLoans, dbDisposals, dbTransfers, dbReports, dbProjects] = await assetsRepository.findListTables();

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

    return formatted;
}

/** Who has held an asset, oldest first. */
export async function custodianHistory(assetTag: string): Promise<CustodianHistory> {
    let asset = await assetsRepository.findByTag(assetTag);

    if (!asset && !isNaN(Number(assetTag))) {
        asset = await assetsRepository.findById(Number(assetTag));
    }

    if (!asset) {
        throw new AppError(404, "Asset not found in database.");
    }

    // Fetch all asset_records for this asset ordered by date_logged ASC (Oldest to Newest)
    const records = await assetsRepository.findRecordsWithCustodian(asset.asset_id);

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

    return {
        assetTag: asset.asset_tag,
        assetName: asset.name,
        historyCount: history.length,
        custodianHistory: history // Sorted from oldest to newest (1..N)
    };
}

function sanitizeCategory(cat: any): any {
    if (!cat) return 'DEV_KIT';
    const formatted = String(cat).trim().toUpperCase().replace(/[\s-]+/g, '_');
    return ASSET_CATEGORIES.includes(formatted) ? formatted : 'DEV_KIT';
}

/** Registers a new asset with the next tag of its lab, its monetary row, and its first record. */
export async function registerAsset(data: AssetCreateInput): Promise<{ asset: assets; assetTag: string }> {
    const imageVal = data.image || data.image_url || data.imageUrl || null;
    checkAssetImage(imageVal);

    if (imageVal) {
        console.log(`📸 Saving image payload for new asset (${imageVal.slice(0, 30)}... [length: ${imageVal.length}])`);
    }

    // Generate a unique asset tag following the lab naming convention (<LabName>-<4-digit sequence>)
    const labPrefix = String(data.lab || "CITe4D").trim().replace(/[^a-zA-Z0-9]/g, "") || "CITe4D";
    const existingLabAssets = await assetsRepository.findTagsWithPrefix(labPrefix);

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

    const asset = await assetsRepository.createWithRecords(
        {
            asset_tag: assetTag,
            name: data.name,
            category: sanitizeCategory(data.category),
            serial_number: data.serial || null,
            manufacturer: data.manufacturer || null,
            image_url: imageVal || null,
            procurement_date: data.procured ? new Date(data.procured) : null,
            warranty_expiry: data.warranty ? new Date(data.warranty) : null,
        },
        {
            funding_source: data.funding || "Unspecified",
            acquisition_value: data.acquisitionValue ?? 0,
        },
        {
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
    );

    return { asset, assetTag };
}

/** Saves an edit to an asset, its monetary row, its newest record, and, with a condition or remarks, a new report. */
export async function updateAsset(assetTag: string, data: AssetUpdateInput): Promise<assets> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // Local demo data identifies a custodian by name (e.g. "Dr. Juan Dela Cruz");
    // the schema needs a real users.user_id. Best-effort lookup by combined name —
    // if nothing matches, the existing custodian on the record is left untouched.
    let custodianId: number | undefined;
    if (data.custodian) {
        const [first, ...rest] = String(data.custodian).replace(/^Dr\.\s*/i, "").split(" ");
        const match = await assetsRepository.findUserByName(first, rest.join(" "));
        if (match) custodianId = match.user_id;
    }

    const imageProvided = data.image !== undefined || data.image_url !== undefined || data.imageUrl !== undefined;
    const rawImage = data.image ?? data.image_url ?? data.imageUrl;
    const imageVal = imageProvided ? (rawImage || null) : existing.image_url;

    checkAssetImage(imageVal);

    if (imageProvided && rawImage) {
        console.log(`📸 Updating image payload for ${assetTag} (${String(rawImage).slice(0, 30)}... [length: ${String(rawImage).length}])`);
    }

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

    const monetary = (data.funding !== undefined || data.acquisitionValue !== undefined)
        ? {
            update: { funding_source: data.funding || "Unspecified" },
            create: {
                asset_id: existing.asset_id,
                funding_source: data.funding || "Unspecified",
                acquisition_value: data.acquisitionValue ?? 0,
            },
        }
        : null;

    return assetsRepository.saveEdit(existing, assetUpdateData, monetary, (latestRecord: asset_records | null) => {
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

        if (!(data.assetCondition || data.reportCondition || data.remarks || data.tsgRemarks || data.itsRemarks)) {
            return { record: recordData, report: null };
        }

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

        return {
            record: recordData,
            report: {
                data: {
                    asset_id: existing.asset_id,
                    reported_by_id: custodianId ?? DEFAULT_CUSTODIAN_ID,
                    report_condition: condition,
                    report_remarks: String(remarksVal || "Routine inspection verified.").slice(0, 255),
                    report_img: imageVal || null,
                },
                syncFromReport: (latestReport) => {
                    const latestCondition = latestReport ? latestReport.report_condition : condition;
                    const latestRemarks = latestReport ? latestReport.report_remarks : remarksVal;
                    return {
                        asset_condition: latestCondition as any,
                        Asset_Remarks: latestRemarks,
                    };
                },
            },
        };
    });
}

/** Deletes an asset and every row that points at it. */
export async function deleteAsset(assetTag: string): Promise<void> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    await assetsRepository.deleteWithHistory(existing.asset_id);
}
