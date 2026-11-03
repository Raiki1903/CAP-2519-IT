/**
 * Assets service: the rules for the asset list and search, an asset's history, registration (with its tag), edits, and deletion.
 * Layer: service. Called by assets.controller.ts. Calls assets.repository.ts, features/auth/auth.repository.ts,
 * assets.validation.ts, shared/constants/poolCustodian.ts, and @shared (enums and labels).
 * Used by: every role's inventory view and the bell, the asset detail modal, Staff asset registration, editing, and deletion.
 */
import { asset_inspections_type, type asset_records, type assets } from '@prisma/client';
import type {
    AssetCreateInput,
    AssetHistory,
    AssetHistoryEvent,
    AssetListFilters,
    AssetListItem,
    AssetUpdateInput,
    PersonRef,
} from '@shared/types/assets';
import type { SessionIdentity } from '@shared/types/auth';
import { ASSET_CONDITIONS, ASSET_CONDITION_LABELS } from '@shared/enums/assetCondition';
import { ASSET_CATEGORIES, ASSET_CATEGORY_LABELS, type AssetCategory } from '@shared/enums/assetCategory';
import { ASSET_STATUS_LABELS } from '@shared/enums/assetStatus';
import { CAMPUS_LABELS } from '@shared/constants/campuses';
import { LOAN_STATUS_LABELS } from '@shared/constants/loanStatuses';
import { MAINTENANCE_STATUS_LABELS } from '@shared/constants/maintenanceStatuses';
import { RETIREMENT_PATHWAY_LABELS, RETIREMENT_STATUS_LABELS } from '@shared/constants/retirementStatuses';
import { INSPECTION_TYPE_LABELS } from '@shared/constants/inspectionTypes';
import { ACTIVITY_EVENT_LABELS } from '@shared/constants/activityEvents';
import * as assetsRepository from './assets.repository';
import type { EditRows } from './assets.repository';
import * as authRepository from '../auth/auth.repository';
import { checkAssetImage, UNKNOWN_CUSTODIAN } from './assets.validation';
import { AppError } from '../../shared/errors/AppError';
import { POOL_CUSTODIAN_ID } from '../../shared/constants/poolCustodian';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** A DATE column as yyyy-mm-dd, or null. */
const dateOnly = (d: Date | null) => (d ? d.toISOString().split("T")[0] : null);

/** A display date such as "Oct 9, 2026". */
const displayDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** A person row with the name fields the answers use. */
type NamedPerson = { user_id: number; first_name: string; last_name: string };

/**
 * The person as this viewer may see them: a Researcher (the "Custodian" app role) sees only their own name and id;
 * anyone else is `{ hidden: true }`. (D2)
 */
function personFor(viewer: SessionIdentity, person: NamedPerson | null): PersonRef | null {
    if (!person) return null;
    if (viewer.role === "Custodian" && person.user_id !== viewer.userId) return { hidden: true };
    return { userId: person.user_id, name: `${person.first_name} ${person.last_name}` };
}

/** The name of a person the viewer may see, or undefined. */
function shownName(person: PersonRef | null): string | undefined {
    return person && 'userId' in person ? person.name : undefined;
}

/**
 * Lists the assets with their state worked out on the server, shaped for the screens, optionally searched and filtered.
 * The status is the stored one; holder, current location, condition, overdue, and the open loan come from the loan
 * and inspection rows (shared/services/assetState.ts), read for the whole list at once: the number of queries does
 * not grow with the number of assets.
 * A Researcher gets no other person's name (D2): the holder becomes `{ hidden: true }` and the older custodian fields
 * are left out, as are the disposal's requester and the reporters of other people's reports.
 *
 * @param viewer the session user
 * @param filters `q` (part of the tag, serial number, or name, in any letter case), `status`, and `centerId`, each optional
 * @returns one AssetListItem per matching asset, by asset id
 */
export async function listAssets(viewer: SessionIdentity, filters: AssetListFilters = {}): Promise<AssetListItem[]> {
    const dbAssets = await assetsRepository.findForList(filters);
    const [states, inspections, retirements] = await assetsRepository.findListExtras(dbAssets);

    return dbAssets.map(asset => {
        const state = states.get(asset.asset_id)!;
        const loan = state.openLoan;
        const holder: PersonRef | null = state.holder
            ? (viewer.role === "Custodian" && state.holder.userId !== viewer.userId ? { hidden: true } : { ...state.holder })
            : null;
        const holderShown = holder && 'userId' in holder ? holder : null;
        const center = asset.research_centers;

        let borrowedOn: string | undefined;
        let dueDate: string | undefined;
        let daysLeft: number | undefined;
        if (state.holder && loan) {
            borrowedOn = displayDate(loan.releasedAt ?? loan.requestedAt);
            dueDate = displayDate(loan.returnBy);
            daysLeft = Math.ceil((loan.returnBy.getTime() - Date.now()) / MS_PER_DAY);
        }

        // The disposal details of a retired asset, from its newest completed retirement.
        // TODO(M-13): the justification and the last custodian are parsed back out of the packed reason text. Batch 5 stores them in columns.
        const disposal = asset.status === "RETIRED" ? retirements.find(r => r.asset_id === asset.asset_id) : undefined;
        let disposalDetails: AssetListItem['disposalDetails'];
        if (disposal) {
            const reasonText = disposal.reason || "";
            const pathwayMatch = reasonText.match(/Disposal Pathway:\s*(.+)/i);
            const justificationMatch = reasonText.match(/Breakdown Justification:\s*([\s\S]+)/i);
            const lastCustodianMatch = reasonText.match(/Last Custodian:\s*(.+)/i);
            disposalDetails = {
                lastCustodian: viewer.role === "Custodian" ? undefined : (lastCustodianMatch ? lastCustodianMatch[1].trim() : "No Custodian"),
                breakdownReasons: (justificationMatch ? justificationMatch[1].trim() : reasonText) || "Decommissioned due to physical breakdown or end of servicing lifecycle.",
                disposalPathway: disposal.pathway ? RETIREMENT_PATHWAY_LABELS[disposal.pathway] : (pathwayMatch ? pathwayMatch[1].trim() : "Not recorded"),
                decommissionDate: displayDate(disposal.completed_at ?? disposal.requested_at),
                decommissionedBy: shownName(personFor(viewer, disposal.users)),
            };
        }

        const remarksText = state.condition?.remarks || null;
        const acquisitionValue = asset.acquisition_value === null ? null : Number(asset.acquisition_value);

        const reports = inspections.filter(r => r.asset_id === asset.asset_id).map(r => ({
            id: r.inspection_id,
            reportId: `RPT-${r.inspection_id}`,
            assetId: asset.asset_tag,
            reportedBy: shownName(personFor(viewer, r.users)),
            reporterRole: INSPECTION_TYPE_LABELS[r.type],
            reportDate: displayDate(r.inspected_at),
            date_logged: displayDate(r.inspected_at),
            created_at: r.inspected_at.toISOString(),
            condition: r.condition,
            remarks: r.remarks || "Routine physical inspection logged in AdRIC registry.",
            image: r.photo || undefined,
            status: "Verified Inspection",
        }));

        return {
            assetId: asset.asset_id,
            tag: asset.asset_tag,
            name: asset.name,
            serialNumber: asset.serial_number,
            manufacturer: asset.manufacturer,
            category: asset.category,
            categoryLabel: ASSET_CATEGORY_LABELS[asset.category as AssetCategory],
            status: asset.status,
            statusLabel: ASSET_STATUS_LABELS[asset.status],
            homeLab: { centerId: center.center_id, code: center.short_code, name: center.name, campus: center.location, campusLabel: CAMPUS_LABELS[center.location] },
            homeRoom: asset.home_room,
            currentLocation: state.currentLocation,
            holder,
            condition: state.condition?.condition ?? null,
            conditionLabel: state.condition ? ASSET_CONDITION_LABELS[state.condition.condition] : null,
            healthScore: state.condition?.healthScore ?? null,
            isOverdue: state.isOverdue,
            openLoan: loan ? { loanId: loan.loanId, status: loan.status, returnBy: dateOnly(loan.returnBy)! } : null,
            project: asset.projects ? { projectId: asset.projects.project_id, code: asset.projects.project_code, name: asset.projects.project_name } : null,
            fundingSource: asset.funding_sources ? { fundingSourceId: asset.funding_sources.funding_source_id, name: asset.funding_sources.name } : null,
            acquisitionValue,
            procurementDate: dateOnly(asset.procurement_date),
            warrantyExpiry: dateOnly(asset.warranty_expiry),
            accessories: asset.accessories,
            itsPropertyTag: asset.its_property_tag,
            tsgTag: asset.tsg_tag,
            imageUrl: asset.image_url,

            id: asset.asset_tag,
            serial: asset.serial_number || "",
            funding: asset.funding_sources?.name || "Unspecified",
            cost: acquisitionValue ?? 0,
            procured: dateOnly(asset.procurement_date) ?? "",
            warranty: dateOnly(asset.warranty_expiry) ?? "",
            location: CAMPUS_LABELS[center.location],
            lab: center.short_code,
            assetCondition: state.condition?.condition,
            custodian: holderShown?.name,
            custodianId: holderShown?.userId,
            custodianHidden: holder && !holderShown ? (true as const) : undefined,
            borrowedOn,
            dueDate,
            daysLeft,
            disposalId: disposal ? `DISP-${disposal.retirement_id}` : undefined,
            disposalDetails,
            image: asset.image_url,
            image_url: asset.image_url,
            description: remarksText || "Asset registered under DLSU AdRIC equipment registry.",
            remarks: remarksText || undefined,
            tsgRemarks: remarksText || undefined,
            itsRemarks: remarksText || undefined,
            asset_reports: reports,
            asset_monetary: { acquisition_value: acquisitionValue ?? 0, funding_source: asset.funding_sources?.name || "Unspecified" },
        };
    });
}

/**
 * One asset's history, oldest first: its loans, inspections, maintenance tickets, and retirements, step by step, and
 * its activity log rows (registered, edited, missing, found). The tag is tried as an asset id when no asset has it.
 * A Researcher sees only their own name; everyone else is `{ hidden: true }`. (D2)
 *
 * @param assetTag the asset's tag, or its numeric id
 * @param viewer the session user
 * @returns the asset's tag and name and its events
 * @throws AppError 404 if neither the tag nor the id matches an asset
 */
export async function assetHistory(assetTag: string, viewer: SessionIdentity): Promise<AssetHistory> {
    let asset: assets | null = await assetsRepository.findByTag(assetTag);
    if (!asset && !isNaN(Number(assetTag))) {
        asset = await assetsRepository.findById(Number(assetTag));
    }
    if (!asset) {
        throw new AppError(404, "Asset not found in database.");
    }

    const [loans, inspections, tickets, retirements, activity] = await assetsRepository.findHistoryRows(asset.asset_id);
    const events: AssetHistoryEvent[] = [];
    const add = (at: Date | null, kind: string, label: string, actor: NamedPerson | null, details: string | null, ids: Partial<AssetHistoryEvent> = {}) => {
        if (at) events.push({ at: at.toISOString(), kind, label, actor: personFor(viewer, actor), details, ...ids });
    };

    for (const l of loans) {
        const ids = { loanId: l.loan_id };
        add(l.requested_at, "LOAN_REQUESTED", "Loan requested", l.users, null, ids);
        if (l.decided_at) {
            const declined = l.status === "DECLINED";
            add(l.decided_at, declined ? "LOAN_DECLINED" : "LOAN_APPROVED", declined ? "Loan declined" : "Loan approved", l.decided_by, l.decision_remarks, ids);
        }
        add(l.released_at, "LOAN_RELEASED", "Released to the borrower", l.released_by, null, ids);
        add(l.return_requested_at, "LOAN_RETURN_REQUESTED", "Return requested", l.users, null, ids);
        add(l.closed_at, "LOAN_CLOSED", `Loan closed: ${LOAN_STATUS_LABELS[l.status]}`, l.received_by, l.remarks, ids);
    }
    for (const i of inspections) {
        add(i.inspected_at, "INSPECTION", `${INSPECTION_TYPE_LABELS[i.type]} inspection: ${ASSET_CONDITION_LABELS[i.condition]}`, i.users, i.remarks, { inspectionId: i.inspection_id });
    }
    for (const t of tickets) {
        const ids = { maintenanceId: t.maintenance_id };
        add(t.reported_at, "MAINTENANCE_REPORTED", "Issue reported", t.users, t.issue_description, ids);
        add(t.received_at, "MAINTENANCE_RECEIVED", "Received by TSG", t.received_by, null, ids);
        add(t.completed_at, "MAINTENANCE_COMPLETED", `Maintenance closed: ${MAINTENANCE_STATUS_LABELS[t.status]}`, t.completed_by, t.resolution_remarks, ids);
    }
    for (const r of retirements) {
        const ids = { retirementId: r.retirement_id };
        add(r.requested_at, "RETIREMENT_REQUESTED", "Retirement requested", r.users, null, ids);
        add(r.decided_at, "RETIREMENT_DECIDED", `Retirement decided: ${RETIREMENT_STATUS_LABELS[r.status]}`, r.decided_by, r.decision_remarks, ids);
        add(r.completed_at, "RETIREMENT_COMPLETED", "Retired", r.completed_by, r.disposition_reference, ids);
    }
    for (const a of activity) {
        add(a.created_at, a.event_type, ACTIVITY_EVENT_LABELS[a.event_type], a.actor, a.details);
    }

    // Oldest first. The sort keeps the order above for steps saved in the same second.
    events.sort((x, y) => x.at.localeCompare(y.at));
    return { assetTag: asset.asset_tag, assetName: asset.name, events };
}

/**
 * The next tag of a lab: its prefix and one more than the highest number its tags have, four digits.
 *
 * @param labPrefix the lab's short code
 * @param existingTags the tags the lab's assets have
 * @returns for example "CeLT-0005" after "CeLT-0004"
 */
function nextTagOf(labPrefix: string, existingTags: string[]): string {
    let maxSeq = 0;
    const prefixPattern = new RegExp(`^${labPrefix}-(\\d+)$`, "i");
    for (const tag of existingTags) {
        const match = tag.match(prefixPattern);
        if (match) {
            const seq = parseInt(match[1], 10);
            if (seq > maxSeq) maxSeq = seq;
        }
    }
    return `${labPrefix}-${String(maxSeq + 1).padStart(4, "0")}`;
}

/** The stored category for any spelling ("Dev Kit" becomes DEV_KIT), or DEV_KIT when it is missing or not a category. */
function sanitizeCategory(cat: any): any {
    if (!cat) return 'DEV_KIT';
    const formatted = String(cat).trim().toUpperCase().replace(/[\s-]+/g, '_');
    return ASSET_CATEGORIES.includes(formatted) ? formatted : 'DEV_KIT';
}

/**
 * The funding_sources row a form's funding text names, by name. Empty and "Unspecified" mean none.
 *
 * @param funding the funding text the form sent, or undefined
 * @returns the funding source id, null for none, or undefined when the text was not sent
 * @throws AppError 400 if the text names no funding source
 */
async function fundingSourceIdFor(funding: string | undefined): Promise<number | null | undefined> {
    if (funding === undefined) return undefined;
    const name = String(funding).trim();
    if (!name || name === "Unspecified") return null;
    const row = await assetsRepository.findFundingSourceByName(name);
    if (!row) {
        throw new AppError(400, "Pick a funding source from the list.");
    }
    return row.funding_source_id;
}

/**
 * Registers a new asset: its assets row, at its home lab, with the funding source and acquisition value sent.
 * Its status starts Available. The tag is the lab code and the next free number for that lab, for example "CeLT-0005",
 * numbered with the lab's row locked so two registrations at once get different tags. (H-11, issue #75)
 *
 * @param data the checked body
 * @returns the created assets row and its tag
 * @throws AppError 400 if the picture is text but not an image
 * @throws AppError 400 if the lab is not a known research center: the asset's home lab is stored on it
 * @throws AppError 400 if the funding text names no funding source
 */
export async function registerAsset(data: AssetCreateInput): Promise<{ asset: assets; assetTag: string }> {
    const imageVal = data.image || data.image_url || data.imageUrl || null;
    checkAssetImage(imageVal);

    if (imageVal) {
        console.log(`📸 Saving image payload for new asset (${imageVal.slice(0, 30)}... [length: ${imageVal.length}])`);
    }

    // The tag prefix is the lab code with anything but letters and digits removed. No lab is refused below: there is
    // no default lab.
    const labCode = String(data.lab ?? "").trim().replace(/[^a-zA-Z0-9]/g, "");
    const lab = labCode ? await assetsRepository.findLabByCode(labCode) : null;
    if (!lab) {
        throw new AppError(400, "Pick a lab from the list.");
    }
    const fundingSourceId = await fundingSourceIdFor(data.funding);

    // The lab's own short code, so the tag prefix always matches its lab letter for letter.
    const labPrefix = lab.short_code;

    const asset = await assetsRepository.createWithNextTag(lab.center_id, labPrefix, (existingTags) => nextTagOf(labPrefix, existingTags), {
        center_id: lab.center_id,
        name: data.name,
        category: sanitizeCategory(data.category),
        serial_number: data.serial || null,
        manufacturer: data.manufacturer || null,
        image_url: imageVal || null,
        procurement_date: data.procured ? new Date(data.procured) : null,
        warranty_expiry: data.warranty ? new Date(data.warranty) : null,
        funding_source_id: fundingSourceId ?? null,
        acquisition_value: data.acquisitionValue === undefined || data.acquisitionValue === "" ? null : data.acquisitionValue,
    });
    const assetTag = asset.asset_tag;

    return { asset, assetTag };
}

/**
 * Saves an edit: the assets fields that were sent (funding and value included); a new record when the edit changes the asset's
 * status, location, custodian, condition, or remarks; and, when the edit carries a condition or remarks, a new
 * inspection report, whose condition the new record takes. An existing record is never changed (issue #74), so the
 * custodian history keeps every earlier state.
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the body; every field is optional
 * @param editorId the session user, under whom the edit's condition report is filed
 * @returns the assets row, updated or as it was
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 400 if custodianId is not a Custodian account; if the edit sends a status or custodian and would
 *   leave the asset available with a person; if the picture is text but not an image; or if the funding text names no
 *   funding source. Nothing is saved.
 */
export async function updateAsset(assetTag: string, data: AssetUpdateInput, editorId: number): Promise<assets> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    // The new custodian, by user id: a target, not the person acting. null is None, the placeholder; any other id must
    // be a Custodian account, as the dropdown offers (issue #95, answer 1). Not sent leaves the custodian as it is.
    let custodianId: number | undefined;
    if (data.custodianId === null) {
        custodianId = POOL_CUSTODIAN_ID;
    } else if (data.custodianId !== undefined) {
        const custodian = data.custodianId === POOL_CUSTODIAN_ID ? null : await authRepository.findAssetHolderCandidate(data.custodianId);
        if (!custodian) {
            throw new AppError(400, UNKNOWN_CUSTODIAN);
        }
        custodianId = custodian.user_id;
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

    // Only the fields sent are written, so a value alone keeps the funding source. (M-16, issue #74)
    const fundingSourceId = await fundingSourceIdFor(data.funding);
    if (fundingSourceId !== undefined) assetUpdateData.funding_source_id = fundingSourceId;
    if (data.acquisitionValue !== undefined) assetUpdateData.acquisition_value = data.acquisitionValue === "" ? null : data.acquisitionValue;

    return assetsRepository.saveEdit(existing, assetUpdateData, (latestRecord: asset_records | null) => {
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
                inspected_by_id: editorId,
                type: asset_inspections_type.ROUTINE,
                condition: conditionMap[rawCond] || "PERFECT",
                remarks: String(remarksVal || "Routine inspection verified.").slice(0, 255),
                photo: imageVal || null,
            };
        }

        // Each record field is the body's value, else the newest record's, else a default. With a report, the condition
        // is the report's, so the two agree.
        // TODO(H-07): the status is any text upper-cased with its first space as an underscore, not checked against the enum; a bad one fails in the database with a 500. With the status enum.
        const next = {
            status: (data.status?.toUpperCase().replace(" ", "_") || latestRecord?.status || "ACTIVE") as any,
            location: [data.location, data.lab].filter(Boolean).join(" — ") || latestRecord?.location || "Unassigned",
            current_custodian: custodianId ?? latestRecord?.current_custodian ?? POOL_CUSTODIAN_ID,
            asset_condition: (report ? report.condition : ASSET_CONDITIONS.includes(data.assetCondition) ? data.assetCondition : latestRecord?.asset_condition ?? "PERFECT") as any,
            Asset_Remarks: remarksVal,
        };

        // Available means nobody holds it (team decision). Checked only when the edit sends a status or custodian, so an
        // older record that breaks the rule can still take other changes. Thrown here, the transaction saves nothing.
        if ((data.status !== undefined || data.custodianId !== undefined) && next.status === "ACTIVE" && next.current_custodian !== POOL_CUSTODIAN_ID) {
            throw new AppError(400, "An available asset has no custodian. Pick None, or change the availability.");
        }

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
