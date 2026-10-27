/**
 * Assets service: the rules for the asset list, the custodian history, registration (with its tag), edits, and deletion.
 * Layer: service. Called by assets.controller.ts. Calls assets.repository.ts, features/auth/auth.repository.ts,
 * assets.validation.ts, shared/constants/poolCustodian.ts, and @shared/enums.
 * Used by: every role's inventory view and the bell, the asset detail modal, Staff asset registration, editing, and deletion.
 */
import type { asset_records, assets } from '@prisma/client';
import type { AssetCreateInput, AssetListItem, AssetUpdateInput, CustodianHistory } from '@shared/types/assets';
import type { SessionIdentity } from '@shared/types/auth';
import { ASSET_CONDITIONS } from '@shared/enums/assetCondition';
import { ASSET_CATEGORIES } from '@shared/enums/assetCategory';
import * as assetsRepository from './assets.repository';
import type { EditRows } from './assets.repository';
import * as authRepository from '../auth/auth.repository';
import { checkAssetImage } from './assets.validation';
import { AppError } from '../../shared/errors/AppError';
import { POOL_CUSTODIAN_ID } from '../../shared/constants/poolCustodian';

/**
 * Lists every asset with its current state, shaped for the screens.
 * Each asset's state is read from its newest record (ties on date_logged go to the higher asset_record_id),
 * its due date from the newest approved loan, and its disposal details from the disposal's packed reason text.
 * A Custodian gets no other person's name (D2): not the holder of an asset they do not hold (which is marked
 * `custodianHidden` instead), not the disposal's last custodian or requester, and inside each asset not the
 * custodian of a record, the people of a transfer they are not part of, or the reporter of a report.
 *
 * @param viewer the session user
 * @returns one AssetListItem per assets row, with its records, transfers, and reports
 */
// TODO(M-01): nine whole tables are loaded and joined in code on every call, and most screens call it. 01D rewrites it as targeted queries, in its own commit (issue #76).
// TODO(H-13): reporterRole reads a `role` field users does not have, so it is always "Inspection Inspector"; and the condition score checks spellings the condition enum does not have. A small fix.
export async function listAssets(viewer: SessionIdentity): Promise<AssetListItem[]> {
    // Whether this caller may see the name of the person with this id: everyone but a Custodian sees every name. (D2)
    const nameShown = (userId: number) => viewer.role !== "Custodian" || userId === viewer.userId;

    const [dbAssets, dbMonetaries, dbRecords, dbUsers, dbLoans, dbDisposals, dbTransfers, dbReports, dbProjects] = await assetsRepository.findListTables();

    const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const formatted = dbAssets.map(asset => {
        const monetary = dbMonetaries.find(m => m.asset_id === asset.asset_id);

        // dbRecords is newest first, so the first match is the newest record.
        const records = dbRecords.filter(r => r.asset_id === asset.asset_id);
        const latestRecord = records[0];

        let custodianName = "";
        let custodianHidden = false;
        let status = "Active";
        let location = "Manila";
        let lab = "CITe4D";
        let borrowedOn: string | undefined;
        let dueDate: string | undefined;
        let daysLeft: number | undefined;

        if (latestRecord) {
            // The placeholder stands for "nobody holds it", so it is not named. (answer 1 of the 13c questions)
            const custodian = latestRecord.current_custodian === POOL_CUSTODIAN_ID
                ? undefined
                : dbUsers.find(u => u.user_id === latestRecord.current_custodian);
            if (custodian && !nameShown(custodian.user_id)) {
                custodianHidden = true;
            } else if (custodian) {
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

            // The due date comes from the asset's newest approved loan (dbLoans is newest first), matched by
            // asset alone, not by borrower: a transfer moves custody without touching the loan row, and the
            // new custodian still needs the same due date.
            // TODO(H-04): a loan returned before issue #99 stays approved (old rows, as CCS Cloud holds), so an asset put On Loan later by a transfer can show that old loan's dates. It closes at the asset's next return.
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

        // The disposal named by the newest record, or else any approved disposal of the asset.
        // TODO(M-13): the pathway and justification are parsed back out of the packed reason text. Columns of their own, Phase 3.
        const disposal = dbDisposals.find(d =>
            (latestRecord?.disposal_id && d.disposal_id === latestRecord.disposal_id) ||
            (d.asset_id === asset.asset_id && d.status === "approved")
        );
        const disposerUser = disposal ? dbUsers.find(u => u.user_id === disposal.disposed_by_id) : null;
        const disposerHidden = !!disposerUser && !nameShown(disposerUser.user_id);

        let disposalDetails: any = undefined;
        if (disposal) {
            const reasonText = disposal.disposal_reason || "";
            const pathwayMatch = reasonText.match(/Disposal Pathway:\s*(.+)/i);
            const pathway = pathwayMatch ? pathwayMatch[1].trim() : "Decommission — Scrap / Recycle";
            const justificationMatch = reasonText.match(/Breakdown Justification:\s*([\s\S]+)/i);
            const justification = justificationMatch ? justificationMatch[1].trim() : reasonText;

            disposalDetails = {
                lastCustodian: custodianHidden ? undefined : (custodianName || "No Custodian"),
                breakdownReasons: justification || "Decommissioned due to physical breakdown or end of servicing lifecycle.",
                disposalPathway: pathway,
                decommissionDate: formatDate(disposal.disposal_date),
                decommissionedBy: disposerHidden ? undefined : (disposerUser ? `${disposerUser.first_name} ${disposerUser.last_name}` : "AdRIC Director"),
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
                custodian: cUser ? (nameShown(cUser.user_id) ? `${cUser.first_name} ${cUser.last_name}` : undefined) : "System Custodian",
                remarks: r.Asset_Remarks || "Log entry recorded in asset lifecycle registry."
            };
        });

        const assetTransfers = dbTransfers.filter(t => t.asset_id === asset.asset_id);
        const mappedTransfers = assetTransfers.map(t => {
            const fromUser = dbUsers.find(u => u.user_id === t.from_custodian_id);
            const toUser = dbUsers.find(u => u.user_id === t.to_custodian_id);
            // As in GET /api/asset_transfers: a Custodian sees both names only on a transfer they are part of.
            const namesShown = nameShown(t.from_custodian_id) || nameShown(t.to_custodian_id);
            return {
                transfer_id: t.transfer_id,
                id: `TR-${t.transfer_id}`,
                asset_id: t.asset_id,
                assetId: asset.asset_tag,
                from_custodian_id: t.from_custodian_id,
                to_custodian_id: t.to_custodian_id,
                from: !namesShown ? undefined : fromUser ? `${fromUser.first_name} ${fromUser.last_name}` : `Custodian ID: ${t.from_custodian_id}`,
                to: !namesShown ? undefined : toUser ? `${toUser.first_name} ${toUser.last_name}` : `Custodian ID: ${t.to_custodian_id}`,
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
                reportedBy: rUser ? (nameShown(rUser.user_id) ? `${rUser.first_name} ${rUser.last_name}` : undefined) : "Staff",
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
            // Where the asset is right now ("Campus — Lab": a loan or transfer destination, or the TSG Office
            // during a repair), unlike location and lab above, which are always its home.
            currentLocation: latestRecord?.current_location || undefined,
            status,
            condition: calculatedCondition,
            assetCondition: latestRecord?.asset_condition || "PERFECT",
            custodian: custodianName || undefined,
            custodianHidden: custodianHidden ? (true as const) : undefined,
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

/**
 * Who has held an asset, oldest first: one entry per asset record, with its custodian.
 * The tag is tried as an asset id when no asset has it, as the inspection route does.
 * A Custodian gets the name only of their own entries; another holder's entry has no name and is marked
 * `custodianHidden` (answer 6 of the 13c questions).
 * Only a Lab Head gets the custodian's email, the one role whose screen shows it (the full Custodian History view). (01C 4.2)
 *
 * @param assetTag the asset's tag, or its numeric id
 * @param viewer the session user
 * @returns the asset's tag and name and the entries, numbered from 1
 * @throws AppError 404 if neither the tag nor the id matches an asset
 */
export async function custodianHistory(assetTag: string, viewer: SessionIdentity): Promise<CustodianHistory> {
    let asset = await assetsRepository.findByTag(assetTag);

    if (!asset && !isNaN(Number(assetTag))) {
        asset = await assetsRepository.findById(Number(assetTag));
    }

    if (!asset) {
        throw new AppError(404, "Asset not found in database.");
    }

    const records = await assetsRepository.findRecordsWithCustodian(asset.asset_id);

    const history: any[] = [];
    const showsEmail = viewer.role === "LabHead";

    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        // An entry held by the placeholder ("nobody holds it") names no one: no name and no email.
        // No entry carries the holder's id number: no screen shows it (answer 6 of the 13c questions).
        const holder = r.current_custodian === POOL_CUSTODIAN_ID ? null : r.users;
        const hidden = !!holder && viewer.role === "Custodian" && holder.user_id !== viewer.userId;
        const custodianName = hidden ? undefined : holder ? `${holder.first_name} ${holder.last_name}` : (r.users ? undefined : "Unknown Custodian");
        const custodianEmail = hidden || !showsEmail ? undefined : holder ? holder.email : (r.users ? undefined : "");

        history.push({
            sequence: i + 1,
            recordId: r.asset_record_id,
            custodianName,
            custodianEmail,
            custodianHidden: hidden ? (true as const) : undefined,
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
        // TODO(H-09): an asset with no records gets an invented entry (a placeholder custodian and email, at "DLSU Campus"). Remove it, or say there is no history.
        history.push({
            sequence: 1,
            custodianName: "Equipment Custodian",
            custodianEmail: showsEmail ? "custodian@dlsu.edu.ph" : undefined,
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

/** The stored category for any spelling ("Dev Kit" becomes DEV_KIT), or DEV_KIT when it is missing or not a category. */
function sanitizeCategory(cat: any): any {
    if (!cat) return 'DEV_KIT';
    const formatted = String(cat).trim().toUpperCase().replace(/[\s-]+/g, '_');
    return ASSET_CATEGORIES.includes(formatted) ? formatted : 'DEV_KIT';
}

/**
 * Registers a new asset: its assets row, its monetary row, and its first record (ACTIVE, PERFECT, at its home lab).
 * The tag is the lab code and the next free number for that lab, for example "CeLT-0005".
 *
 * @param data the checked body
 * @returns the created assets row and its tag
 * @throws AppError 400 if the picture is text but not an image
 */
// TODO(H-11): the next number is read before the transaction, so two registrations in the same lab at once can pick the same tag; the second then fails with a 500. Move it into the transaction, its own commit (issue #75).
export async function registerAsset(data: AssetCreateInput): Promise<{ asset: assets; assetTag: string }> {
    const imageVal = data.image || data.image_url || data.imageUrl || null;
    checkAssetImage(imageVal);

    if (imageVal) {
        console.log(`📸 Saving image payload for new asset (${imageVal.slice(0, 30)}... [length: ${imageVal.length}])`);
    }

    // The tag prefix is the lab code with anything but letters and digits removed.
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
            // assets has no lab column, so the home campus and lab are stored together on the record.
            location: [data.location, data.lab].filter(Boolean).join(" — ") || "Unassigned",
            // A new asset is at its home lab. Only loans, transfers, and repairs move it away.
            current_location: [data.location, data.lab].filter(Boolean).join(" — ") || "Unassigned",
            // The custodian id the body sends, else the placeholder: a new asset is held by nobody until a loan or transfer.
            current_custodian: data.custodianId ?? POOL_CUSTODIAN_ID,
            Asset_Remarks: data.remarks || data.description || data.tsgRemarks || data.itsRemarks || null,
        },
    );

    return { asset, assetTag };
}

/**
 * Saves an edit: the assets fields that were sent and the monetary row; a new record when the edit changes the asset's
 * status, location, custodian, condition, or remarks; and, when the edit carries a condition or remarks, a new
 * inspection report, whose condition the new record takes. An existing record is never changed (issue #74), so the
 * custodian history keeps every earlier state.
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the body; every field is optional
 * @param editorId the session user, under whom the edit's condition report is filed
 * @returns the assets row, updated or as it was
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 400 if the picture is text but not an image
 */
export async function updateAsset(assetTag: string, data: AssetUpdateInput, editorId: number): Promise<assets> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // The dialog sends the new custodian as a display name ("Dr. Juan Dela Cruz"): a target, not the person acting.
    // It is split at the first space and matched exactly; no match leaves the record's custodian as it is.
    // TODO(H-10): two people with the same name cannot be told apart, and a two-word first name never matches (issue #32). A person picker, on a branch after step 13 (answer 8).
    let custodianId: number | undefined;
    if (data.custodian) {
        const [first, ...rest] = String(data.custodian).replace(/^Dr\.\s*/i, "").split(" ");
        const match = await authRepository.findUserByName(first, rest.join(" "));
        if (match) custodianId = match.user_id;
    }

    const imageProvided = data.image !== undefined || data.image_url !== undefined || data.imageUrl !== undefined;
    const rawImage = data.image ?? data.image_url ?? data.imageUrl;
    const imageVal = imageProvided ? (rawImage || null) : existing.image_url;

    checkAssetImage(imageVal);

    if (imageProvided && rawImage) {
        console.log(`📸 Updating image payload for ${assetTag} (${String(rawImage).slice(0, 30)}... [length: ${String(rawImage).length}])`);
    }

    // Only the assets fields the body sends are written, so a caller that sends only a condition or remarks
    // leaves the asset's own fields alone.
    const assetUpdateData: any = {};
    if (data.name !== undefined) assetUpdateData.name = data.name;
    if (data.serial !== undefined) assetUpdateData.serial_number = data.serial || null;
    if (data.manufacturer !== undefined) assetUpdateData.manufacturer = data.manufacturer || null;
    if (data.category !== undefined) assetUpdateData.category = sanitizeCategory(data.category);
    if (imageProvided) assetUpdateData.image_url = imageVal;
    if (data.procured !== undefined) assetUpdateData.procurement_date = data.procured ? new Date(data.procured) : null;
    if (data.warranty !== undefined) assetUpdateData.warranty_expiry = data.warranty ? new Date(data.warranty) : null;

    // An existing monetary row gets only the fields sent, so a value alone keeps the funding source. (M-16, issue #74)
    const monetaryUpdate: { funding_source?: string; acquisition_value?: number | string } = {};
    if (data.funding !== undefined) monetaryUpdate.funding_source = data.funding || "Unspecified";
    if (data.acquisitionValue !== undefined) monetaryUpdate.acquisition_value = data.acquisitionValue;
    const monetary = (data.funding !== undefined || data.acquisitionValue !== undefined)
        ? {
            update: monetaryUpdate,
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

        // A condition or remarks field files a report. `description` is not on the list: Edit Asset sends its remarks
        // under that name, so a remarks-only change there files none (issue #74, answer 4).
        let report: EditRows["report"] = null;
        if (data.assetCondition || data.reportCondition || data.remarks || data.tsgRemarks || data.itsRemarks) {
            // The report's condition by stored or display name; any other name is stored as PERFECT. (H-07 family, like issue #53 on the inspection route)
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
            report = {
                asset_id: existing.asset_id,
                // Filed under the Staff member who made the edit. (issue #32)
                reported_by_id: editorId,
                report_condition: conditionMap[rawCond] || "PERFECT",
                report_remarks: String(remarksVal || "Routine inspection verified.").slice(0, 255),
                report_img: imageVal || null,
            };
        }

        // Each record field is the body's value, else the newest record's, else a default. With a report, the condition
        // is the report's, so the two agree.
        // TODO(H-07): the status is any text upper-cased with its first space as an underscore, not checked against the enum; a bad one fails in the database with a 500. With the status enum.
        const next = {
            status: (data.status?.toUpperCase().replace(" ", "_") || latestRecord?.status || "ACTIVE") as any,
            location: [data.location, data.lab].filter(Boolean).join(" — ") || latestRecord?.location || "Unassigned",
            current_custodian: custodianId ?? latestRecord?.current_custodian ?? POOL_CUSTODIAN_ID,
            asset_condition: (report ? report.report_condition : ASSET_CONDITIONS.includes(data.assetCondition) ? data.assetCondition : latestRecord?.asset_condition ?? "PERFECT") as any,
            Asset_Remarks: remarksVal,
        };

        const changed = !latestRecord
            || next.status !== latestRecord.status
            || next.location !== latestRecord.location
            || next.current_custodian !== latestRecord.current_custodian
            || next.asset_condition !== latestRecord.asset_condition
            || next.Asset_Remarks !== (latestRecord.Asset_Remarks ?? null);
        if (!changed) {
            return { record: null, report };
        }

        // Where the asset is now: home when it is available (as a return writes it), and the new home when it was at
        // its old one; else it is still away (on loan, transferred, or at the TSG Office), so the newest record's place.
        const wasAtHome = !latestRecord?.current_location || latestRecord.current_location === latestRecord.location;
        const currentLocation = next.status === "ACTIVE" || wasAtHome ? next.location : latestRecord!.current_location;

        return {
            record: {
                ...next,
                current_location: currentLocation,
                // Kept from the newest record: the analytics read an asset's project there.
                project_id: latestRecord?.project_id ?? null,
            },
            report,
        };
    });
}

/**
 * Deletes an asset and every row that points at it.
 * An asset with inspection or condition reports is refused, so its reports are never deleted. (issue #69)
 *
 * @param assetTag the asset's tag, from the URL
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the asset has any report
 */
// TODO(H-03): a hard delete that destroys the asset's history. 01D turns it into "retire", a status change, with a later database change.
export async function deleteAsset(assetTag: string): Promise<void> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    if (await assetsRepository.countReports(existing.asset_id) > 0) {
        throw new AppError(409, `${assetTag} cannot be deleted because it has inspection or condition reports, which are part of its history. To take it out of use, file a disposal instead.`);
    }

    await assetsRepository.deleteWithHistory(existing.asset_id);
}
