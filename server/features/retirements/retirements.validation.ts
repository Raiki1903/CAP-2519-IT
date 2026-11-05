/**
 * Disposal request checks: is the request shaped correctly, before any database work.
 * Layer: validation. Called by retirements.controller.ts. Calls shared/validation/ (the field and inspection readers)
 * and shared/errors/AppError.ts.
 * Used by: TSG disposal requests and completion, the Director's and the Secretary's decisions, the disposal list's filter.
 */
import type { InspectionInput } from '@shared/types/assets';
import { RETIREMENT_PATHWAYS, RETIREMENT_STATUSES, type RetirementPathway, type RetirementStatus } from '@shared/constants/retirementStatuses';
import { AppError } from '../../shared/errors/AppError';
import { readText } from '../../shared/validation/fields';
import { readInspectionInput } from '../../shared/validation/inspectionInput';

/** The longest reason or remarks text a disposal keeps. The columns are TEXT; this stays well inside them. */
const LONG_TEXT_MAX = 2000;

/** The body as an object, or an empty one when no JSON body was sent. */
function bodyOf(body: unknown): Record<string, unknown> {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/**
 * Reads the disposal id from the URL. The id is the number, not the "DISP-n" label the screens show.
 *
 * @param value the `:retirementId` path part
 * @throws AppError 400 if it is not a whole number
 */
export function readRetirementId(value: string): number {
    if (!/^\d+$/.test(value)) throw new AppError(400, "Invalid disposal id.");
    return Number(value);
}

/**
 * Reads a pathway field.
 *
 * @returns the pathway, or null when none was sent
 * @throws AppError 400 if it is not one of RETIREMENT_PATHWAYS
 */
function readPathway(data: Record<string, unknown>): RetirementPathway | null {
    const value = data.pathway;
    if (value === undefined || value === null || value === "") return null;
    if (!(RETIREMENT_PATHWAYS as readonly unknown[]).includes(value)) throw new AppError(400, "Pick a pathway from the list.");
    return value as RetirementPathway;
}

/** A disposal request, as read from the body. */
export interface RequestBody {
    reason: string;
    pathway: RetirementPathway | null;
    assessmentInspection: InspectionInput | null;
}

/**
 * Reads a disposal request body. A requester name or a last custodian in the body is not read: the requester is the
 * session user.
 *
 * @param body the request body, `{ reason, pathway?, assessmentInspection? }`
 * @throws AppError 400 if the reason is missing or too long, the pathway is unknown, or the inspection is wrong
 */
export function readRequestBody(body: unknown): RequestBody {
    const data = bodyOf(body);
    const reason = readText(data, "reason", LONG_TEXT_MAX);
    if (!reason) throw new AppError(400, "Write the reason for the disposal.");
    const assessment = data.assessmentInspection;
    return {
        reason,
        pathway: readPathway(data),
        assessmentInspection: assessment === undefined || assessment === null ? null : readInspectionInput(assessment, "assessmentInspection"),
    };
}

/** A decision, as read from the body. */
export interface DecisionBody {
    approve: boolean;
    decisionRemarks: string | null;
}

/**
 * Reads a decision body: "approve" or "deny", and the remarks, required to deny.
 *
 * @param body the request body, `{ decision, decisionRemarks? }`
 * @throws AppError 400 for another decision word, or a denial with no remarks
 */
export function readDecisionBody(body: unknown): DecisionBody {
    const data = bodyOf(body);
    if (data.decision !== "approve" && data.decision !== "deny") {
        throw new AppError(400, "decision must be 'approve' or 'deny'.");
    }
    const decisionRemarks = readText(data, "decisionRemarks", LONG_TEXT_MAX) ?? null;
    if (data.decision === "deny" && !decisionRemarks) throw new AppError(400, "Write the reason for denying.");
    return { approve: data.decision === "approve", decisionRemarks };
}

/** A completion, as read from the body. */
export interface CompleteBody {
    pathway: RetirementPathway;
    dispositionReference: string;
}

/**
 * Reads a completion body: the pathway the asset left by and the reference of that disposition.
 *
 * @param body the request body, `{ pathway, dispositionReference }`
 * @throws AppError 400 if either is missing, the pathway is unknown, or the reference is over 255 characters
 */
export function readCompleteBody(body: unknown): CompleteBody {
    const data = bodyOf(body);
    const pathway = readPathway(data);
    if (!pathway) throw new AppError(400, "Pick a pathway from the list.");
    const dispositionReference = readText(data, "dispositionReference", 255);
    if (!dispositionReference) throw new AppError(400, "Write the disposition reference.");
    return { pathway, dispositionReference };
}

/**
 * Reads `?status=` of GET /api/retirements: one or more statuses separated by commas.
 *
 * @returns the statuses, each once, or null when no filter was sent
 * @throws AppError 400 for an empty filter or an unknown status
 */
export function readStatusFilter(value: unknown): RetirementStatus[] | null {
    if (value === undefined) return null;
    if (typeof value !== 'string') throw new AppError(400, "status must be one or more disposal statuses separated by commas.");
    const statuses = [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))];
    if (statuses.length === 0) throw new AppError(400, "Pick at least one disposal status.");
    const unknown = statuses.find(s => !(RETIREMENT_STATUSES as readonly string[]).includes(s));
    if (unknown) throw new AppError(400, `Unknown disposal status: ${unknown}.`);
    return statuses as RetirementStatus[];
}
