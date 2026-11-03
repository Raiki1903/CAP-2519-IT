/**
 * Analytics query reading: the lab, prefix, category, and date filters of the analytics routes.
 * Layer: validation. Called by analytics.controller.ts. Calls nothing.
 * Used by: the Director, Lab Head, and Staff analytics views.
 * Nothing here refuses a request: every filter is optional and has a fallback, so none of the routes answers 400.
 */
import type { Request } from 'express';

type Query = Request['query'];

/** The Director dashboard's filters, read from the query. */
export interface DirectorFilters {
    /** The `lab` query value, or "". */
    labFilter: string;
    /** False for "", "All Labs", and "All Laboratories (DLSU Combined)", which mean every lab. */
    isSpecificLab: boolean;
    startDate: Date | null;
    endDate: Date | null;
}

/** The Lab Head dashboard's date filters, read from the query. The lab is the one the session user heads. */
export interface LabHeadFilters {
    startDate: Date | null;
    endDate: Date | null;
}

/** The optional `lab` query value, matched anywhere in a record's location by the services. */
export function readLabQuery(query: Query): string | undefined {
    return query.lab as string | undefined;
}

/** The optional `category` query value of the loan recommender. */
// TODO: an unknown category is not checked here; Prisma refuses it and the answer is errorHandler's generic 500, not a 400. A check against ASSET_CATEGORIES (step 12 batch 4, proposal 8).
export function readCategoryQuery(query: Query): string | undefined {
    return query.category as string | undefined;
}

/**
 * Reads the Director dashboard's lab and date filters.
 * A date that does not parse is kept as an invalid Date, and the repository leaves it out of the filter.
 */
export function readDirectorFilters(query: Query): DirectorFilters {
    const labFilter = (query.lab as string) || "";
    const startDateParam = query.startDate as string;
    const endDateParam = query.endDate as string;

    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam) : null;

    const isSpecificLab = labFilter && labFilter !== "All Labs" && labFilter !== "All Laboratories (DLSU Combined)";

    return { labFilter, isSpecificLab: !!isSpecificLab, startDate, endDate };
}

/**
 * Reads the Lab Head dashboard's date filters. A date that does not parse is kept as an invalid Date, and the
 * repository leaves it out of the filter.
 */
export function readLabHeadFilters(query: Query): LabHeadFilters {
    const startDateParam = query.startDate as string;
    const endDateParam = query.endDate as string;
    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam) : null;

    return { startDate, endDate };
}
