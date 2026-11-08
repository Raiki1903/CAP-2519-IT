/**
 * Assets service: the rules for the asset list and search, an asset's history, registration (with its tag), edits,
 * deletion, marking an asset missing and found, and its benchmark data.
 * Layer: service. Called by assets.controller.ts and features/inspections (the routine queue). Calls assets.repository.ts,
 * shared/services/lifecycleGuard.ts, shared/services/assetState.ts, shared/middleware/permissions.ts (hasAccessRole),
 * and, inside the step's transaction, shared/services/inspections.ts (the inspection writer) and
 * shared/services/assetStatus.ts, and @shared (enums, labels, and the flag rules).
 * Used by: every role's inventory view and the bell, the asset detail modal, Staff asset registration, editing, and
 * deletion, TSG's Missing and Found, and the benchmark data (no screen yet).
 */
import { asset_inspections_type, type Prisma, type asset_condition, type assets } from '@prisma/client';
import type {
    AssetBenchmarks,
    AssetCreateInput,
    AssetHistory,
    AssetHistoryEvent,
    AssetListFilters,
    AssetListItem,
    AssetMasterData,
    AssetUpdateInput,
    InspectionInput,
    PersonRef,
} from '@shared/types/assets';
import type { SessionIdentity } from '@shared/types/auth';
import { ASSET_CONDITION_LABELS } from '@shared/enums/assetCondition';
import { ASSET_CATEGORY_LABELS, type AssetCategory } from '@shared/enums/assetCategory';
import { ASSET_STATUS_LABELS } from '@shared/enums/assetStatus';
import { CAMPUS_LABELS } from '@shared/constants/campuses';
import { LOAN_STATUS_LABELS } from '@shared/constants/loanStatuses';
import { MAINTENANCE_STATUS_LABELS } from '@shared/constants/maintenanceStatuses';
import { RETIREMENT_PATHWAY_LABELS, RETIREMENT_STATUS_LABELS } from '@shared/constants/retirementStatuses';
import { INSPECTION_TYPE_LABELS } from '@shared/constants/inspectionTypes';
import { ACTIVITY_EVENT_LABELS } from '@shared/constants/activityEvents';
import { isHealthScoreFlagged, isMetricFlagged } from '@shared/constants/metricFlagRules';
import { USEFUL_LIFE_YEARS, presentValue } from '@shared/constants/usefulLife';
import * as assetsRepository from './assets.repository';
import { AppError } from '../../shared/errors/AppError';
import { assertActionAllowed } from '../../shared/services/lifecycleGuard';
import { isHeld, serverToday } from '../../shared/services/assetState';
import { writeInspection } from '../../shared/services/inspections';
import { setAssetStatus } from '../../shared/services/assetStatus';
import { hasAccessRole } from '../../shared/middleware/permissions';

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
    const today = serverToday();

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

        // The disposal details of a retired asset, from its newest completed retirement. A disposal is never requested
        // while the asset is on loan, so there is no last custodian to name.
        const disposal = asset.status === "RETIRED" ? retirements.find(r => r.asset_id === asset.asset_id) : undefined;
        let disposalDetails: AssetListItem['disposalDetails'];
        if (disposal) {
            disposalDetails = {
                lastCustodian: viewer.role === "Custodian" ? undefined : "No Custodian",
                breakdownReasons: disposal.reason,
                disposalPathway: disposal.pathway ? RETIREMENT_PATHWAY_LABELS[disposal.pathway] : "Not recorded",
                decommissionDate: displayDate(disposal.completed_at ?? disposal.requested_at),
                decommissionedBy: shownName(personFor(viewer, disposal.users)),
            };
        }

        const remarksText = state.condition?.remarks || null;
        const acquisitionValue = asset.acquisition_value === null ? null : Number(asset.acquisition_value);
        const usefulLifeYears = USEFUL_LIFE_YEARS[asset.category as AssetCategory];
        const procurementDateOnly = dateOnly(asset.procurement_date);

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
            presentValue: presentValue(acquisitionValue, procurementDateOnly, usefulLifeYears, today),
            usefulLifeYears,
            procurementDate: procurementDateOnly,
            warrantyExpiry: dateOnly(asset.warranty_expiry),
            accessories: asset.accessories,
            itsPropertyTag: asset.its_property_tag,
            tsgTag: asset.tsg_tag,
            imageUrl: asset.image_url,

            id: asset.asset_tag,
            serial: asset.serial_number || "",
            funding: asset.funding_sources?.name || "Unspecified",
            cost: acquisitionValue ?? 0,
            procured: procurementDateOnly ?? "",
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
            disposalId: disposal ? `RET-${disposal.retirement_id}` : undefined,
            disposalDetails,
            image: asset.image_url,
            image_url: asset.image_url,
            description: remarksText || "Asset registered under DLSU AdRIC equipment registry.",
            remarks: remarksText || undefined,
            tsgRemarks: remarksText || undefined,
            itsRemarks: remarksText || undefined,
            asset_reports: reports,
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
        // A cancelled ticket keeps who cancelled it and when in completed_by and completed_at.
        if (t.status === "CANCELLED") add(t.completed_at, "MAINTENANCE_CANCELLED", "Maintenance cancelled by", t.completed_by, t.resolution_remarks, ids);
        else add(t.completed_at, "MAINTENANCE_COMPLETED", `Maintenance completed (${MAINTENANCE_STATUS_LABELS[t.status]}) by`, t.completed_by, t.resolution_remarks, ids);
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

/** The assets columns for the master data fields a body sent. */
function assetColumns(data: AssetMasterData): Prisma.assetsUncheckedUpdateInput {
    const columns: Prisma.assetsUncheckedUpdateInput = {};
    for (const [field, column] of Object.entries(MASTER_DATA_COLUMNS) as [keyof AssetMasterData, string][]) {
        const value = data[field];
        if (value === undefined) continue;
        (columns as Record<string, unknown>)[column] = (field === "procurementDate" || field === "warrantyExpiry") && value ? new Date(value as string) : value;
    }
    return columns;
}

/** Each master data field and the assets column it is stored in. */
const MASTER_DATA_COLUMNS: Record<keyof AssetMasterData, string> = {
    name: "name",
    serialNumber: "serial_number",
    manufacturer: "manufacturer",
    category: "category",
    centerId: "center_id",
    homeRoom: "home_room",
    projectId: "project_id",
    fundingSourceId: "funding_source_id",
    acquisitionValue: "acquisition_value",
    procurementDate: "procurement_date",
    warrantyExpiry: "warranty_expiry",
    accessories: "accessories",
    itsPropertyTag: "its_property_tag",
    tsgTag: "tsg_tag",
    imageUrl: "image_url",
};

/**
 * Checks that the lab, project, and funding source a body names exist.
 *
 * @throws AppError 400 naming the first one that does not
 */
async function checkReferences(data: AssetMasterData): Promise<void> {
    const [lab, project, funding] = await assetsRepository.findReferences(data.centerId ?? null, data.projectId ?? null, data.fundingSourceId ?? null);
    if (data.centerId !== undefined && !lab) throw new AppError(400, "Pick a home lab from the list.");
    if (data.projectId && !project) throw new AppError(400, "Pick a project from the list.");
    if (data.fundingSourceId && !funding) throw new AppError(400, "Pick a funding source from the list.");
}

/** One asset in the list's shape, for the answer of a registration or an edit. */
async function listedAsset(viewer: SessionIdentity, assetId: number): Promise<AssetListItem> {
    const [item] = await listAssets(viewer, { assetId });
    return item;
}

/**
 * Registers a new asset, in one transaction: the assets row at its home lab, Available, under the next tag of the lab
 * (numbered with the lab's row locked, so two registrations at once get different tags, H-11 and issue #75), its
 * Initial inspection under the TSG member who registers it, and an ASSET_REGISTERED row in the activity log.
 *
 * @param data the checked body
 * @param registrar the session user, TSG (the route checks it)
 * @returns the new asset, as the list shows it, with its tag
 * @throws AppError 400 if the home lab, project, or funding source does not exist
 */
export async function registerAsset(data: AssetCreateInput, registrar: SessionIdentity): Promise<AssetListItem> {
    await checkReferences(data);
    const lab = (await assetsRepository.findLabById(data.centerId))!;

    const { initialInspection, ...master } = data;
    const assetId = await assetsRepository.register(
        lab.center_id,
        (existingTags) => nextTagOf(lab.short_code, existingTags),
        assetColumns(master) as Omit<Prisma.assetsUncheckedCreateInput, 'asset_tag'>,
        {
            inspected_by_id: registrar.userId,
            type: asset_inspections_type.INITIAL,
            condition: initialInspection.condition as asset_condition,
            health_score: initialInspection.healthScore ?? null,
            missing_accessories: initialInspection.missingAccessories ?? null,
            remarks: initialInspection.remarks ?? null,
            photo: initialInspection.photo ?? null,
        },
        registrar.userId,
    );
    return listedAsset(registrar, assetId);
}

/**
 * Saves a master data edit, in one transaction: only the fields sent, and an ASSET_EDITED row in the activity log
 * naming the fields that changed (none when nothing changed). TSG and the Secretary may edit (the route).
 *
 * @param assetTag the asset's tag, from the URL
 * @param data the checked body: master data only
 * @param editor the session user
 * @returns the asset, as the list shows it
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the asset is Pending Retirement or Retired
 * @throws AppError 400 if the home lab, project, or funding source does not exist
 */
export async function updateAsset(assetTag: string, data: AssetUpdateInput, editor: SessionIdentity): Promise<AssetListItem> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }
    assertActionAllowed(existing, "EDIT_MASTER_DATA");
    await checkReferences(data);

    const columns = assetColumns(data);
    const changed = Object.entries(columns)
        .filter(([column, value]) => !sameValue((existing as Record<string, unknown>)[column], value))
        .map(([column]) => column);
    if (changed.length > 0) {
        await assetsRepository.saveEdit(existing.asset_id, Object.fromEntries(changed.map(c => [c, (columns as Record<string, unknown>)[c]])), editor.userId, `Changed: ${changed.join(", ")}`);
    }
    return listedAsset(editor, existing.asset_id);
}

/** Whether a stored value and a sent one are the same, for dates, decimals, and plain values. */
function sameValue(stored: unknown, sent: unknown): boolean {
    if (stored instanceof Date || sent instanceof Date) {
        return (stored as Date | null)?.getTime?.() === (sent as Date | null)?.getTime?.();
    }
    if (stored !== null && typeof stored === 'object' && 'toNumber' in (stored as object)) {
        return sent !== null && Number(stored) === Number(sent);
    }
    return (stored ?? null) === (sent ?? null);
}

/**
 * Deletes a mistaken registration: the asset and its Initial inspection, and writes an ASSET_DELETED
 * row with the tag. Its earlier activity log rows are kept, without the asset.
 * An asset with any loan, maintenance ticket, retirement, inspection besides its initial one, or remark (deleted ones
 * too) is refused: that is history, and taking the asset out of use is a retirement. (H-03, issues #69 and #169)
 *
 * @param assetTag the asset's tag, from the URL
 * @param actorId the session user, TSG (the route checks it)
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the asset has history
 */
export async function deleteAsset(assetTag: string, actorId: number): Promise<void> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) {
        throw new AppError(404, `No asset found with tag ${assetTag}.`);
    }

    const history = await assetsRepository.countHistory(existing.asset_id);
    if (history.loans + history.maintenance + history.retirements + history.laterInspections + history.remarks > 0) {
        throw new AppError(409, `${assetTag} cannot be deleted because it has history (loans, maintenance, a retirement, inspections, or remarks). To take it out of use, request its retirement instead.`);
    }

    await assetsRepository.deleteRegistration(existing.asset_id, assetTag, actorId);
}

/** The remarks a ticket still in Pending Receipt gets when its asset is marked missing. */
export const MARKED_MISSING_REMARKS = "Asset marked missing.";

/**
 * TSG marks an asset missing, in one transaction that locks the asset first: the guard (Available or On Loan), a held
 * loan Ended by Loss and closed, a ticket still in Pending Receipt cancelled ("Asset marked missing."), the asset
 * Missing, and one ASSET_MARKED_MISSING activity row with the reason. A loan still waiting for approval or release is
 * left as it is; the guard refuses its approval and release while the asset is Missing.
 *
 * @param assetTag the asset's tag, from the URL
 * @param reason why it is missing, at most 255 characters
 * @param actor the session user, TSG (the route checks it)
 * @returns the asset, as the list shows it
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 409 if the guard refuses
 */
export async function markMissing(assetTag: string, reason: string, actor: SessionIdentity): Promise<AssetListItem> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) throw new AppError(404, `No asset found with tag ${assetTag}.`);

    await assetsRepository.withAssetLock(existing.asset_id, async (tx) => {
        assertActionAllowed(await assetsRepository.findAssetIn(tx, existing.asset_id), "MARK_MISSING");
        const loan = await assetsRepository.findOpenLoanIn(tx, existing.asset_id);
        if (isHeld(loan)) {
            await assetsRepository.updateLoanIn(tx, loan!.loanId, { status: "ENDED_BY_LOSS", closed_at: new Date() });
        }
        await assetsRepository.cancelPendingTicketsIn(tx, existing.asset_id, actor.userId, MARKED_MISSING_REMARKS);
        await setAssetStatus(tx, existing.asset_id, "MISSING");
        await assetsRepository.logActivityIn(tx, { eventType: "ASSET_MARKED_MISSING", actorId: actor.userId, assetId: existing.asset_id, details: reason });
    });
    return listedAsset(actor, existing.asset_id);
}

/**
 * TSG marks a Missing asset found, in one transaction that locks the asset first: a Recovery inspection by the session
 * user, the asset Available (back at its home lab and room), and one ASSET_FOUND activity row with the remarks. The loan
 * that ended by loss stays closed.
 *
 * @param assetTag the asset's tag, from the URL
 * @param inspection the checked Recovery inspection
 * @param remarks TSG's remarks, or null
 * @param actor the session user, TSG (the route checks it)
 * @returns the asset, as the list shows it
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 400 if a metric does not apply to the asset; nothing is written
 * @throws AppError 409 if the asset is not Missing
 */
export async function markFound(assetTag: string, inspection: InspectionInput, remarks: string | null, actor: SessionIdentity): Promise<AssetListItem> {
    const existing = await assetsRepository.findByTag(assetTag);
    if (!existing) throw new AppError(404, `No asset found with tag ${assetTag}.`);

    await assetsRepository.withAssetLock(existing.asset_id, async (tx) => {
        assertActionAllowed(await assetsRepository.findAssetIn(tx, existing.asset_id), "MARK_FOUND");
        await writeInspection(tx, { assetId: existing.asset_id, type: "RECOVERY", input: inspection, inspectorId: actor.userId });
        await setAssetStatus(tx, existing.asset_id, "AVAILABLE");
        await assetsRepository.logActivityIn(tx, { eventType: "ASSET_FOUND", actorId: actor.userId, assetId: existing.asset_id, details: remarks });
    });
    return listedAsset(actor, existing.asset_id);
}

/** The 403 message when a Lab Head asks for the benchmark data of another lab's asset. */
export const NOT_YOUR_LAB_BENCHMARKS_MESSAGE = "This asset belongs to another lab. Only that lab's Head can see its benchmark data.";

/**
 * The asset's benchmark data (contract 7.6): each metric of its category with every value TSG recorded, oldest first,
 * flagged by METRIC_FLAG_RULES against the asset's first recorded value; and every health score, flagged below
 * HEALTH_SCORE_FLAG_BELOW only when the category has no metrics. A metric recorded before a category change is listed
 * too. A Self Report is left out, as it is from the condition. Reads only.
 *
 * @param assetTag the asset's tag, from the URL
 * @param viewer the session user: TSG, the Director, or the account that heads a lab (the route checks it)
 * @returns the metrics and health scores
 * @throws AppError 404 if no asset has this tag
 * @throws AppError 403 NOT_YOUR_LAB_BENCHMARKS_MESSAGE for the Head of another lab
 */
export async function assetBenchmarks(assetTag: string, viewer: SessionIdentity): Promise<AssetBenchmarks> {
    const asset = await assetsRepository.findByTag(assetTag);
    if (!asset) throw new AppError(404, `No asset found with tag ${assetTag}.`);
    if (!hasAccessRole(viewer, ["TSG_STAFF", "ADRIC_DIRECTOR"]) && viewer.headOfCenterId !== asset.center_id) {
        throw new AppError(403, NOT_YOUR_LAB_BENCHMARKS_MESSAGE);
    }

    const { inspections, categoryMetrics, baselines } = await assetsRepository.findBenchmarkRows(asset.asset_id, asset.category);
    const definitions = new Map(categoryMetrics.map(c => [c.metric_id, c.metric_definitions]));
    for (const i of inspections) {
        for (const m of i.metrics) if (!definitions.has(m.metric_id)) definitions.set(m.metric_id, m.metric_definitions);
    }

    const metrics = [...definitions.values()].sort((a, b) => a.metric_id - b.metric_id).map(d => ({
        metricId: d.metric_id,
        metricKey: d.metric_key,
        name: d.name,
        unit: d.unit,
        higherIsBetter: d.higher_is_better,
        points: inspections.flatMap(i => i.metrics.filter(m => m.metric_id === d.metric_id).map(m => {
            const value = Number(m.value);
            return {
                inspectionId: i.inspection_id,
                inspectedAt: i.inspected_at.toISOString(),
                value,
                flagged: isMetricFlagged(d.metric_key, value, baselines.get(`${asset.asset_id}:${d.metric_id}`) ?? null),
            };
        })),
    }));

    const scoreRuleApplies = categoryMetrics.length === 0;
    const healthScores = inspections.filter(i => i.health_score !== null).map(i => ({
        inspectionId: i.inspection_id,
        inspectedAt: i.inspected_at.toISOString(),
        healthScore: i.health_score!,
        flagged: scoreRuleApplies && isHealthScoreFlagged(i.health_score!),
    }));
    return { metrics, healthScores };
}
