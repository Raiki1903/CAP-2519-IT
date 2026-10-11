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

/** The Lab Head dashboard's filters, read from the query. */
export interface LabHeadFilters {
    /** The asset tag prefix of the lab, or "" for every lab. */
    prefixFilter: string;
    startDate: Date | null;
    endDate: Date | null;
}

/** The optional `lab` query value, matched anywhere in a record's location by the services. */
export function readLabQuery(query: Query): string | undefined {
    return query.lab as string | undefined;
}

/** The optional `category` query value of the loan recommender. */
// TODO(H-16): an unknown category is not checked here; Prisma refuses it and the answer is a 500 with Prisma's raw message. errorHandler and a check against ASSET_CATEGORIES, step 13.
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
 * Reads the Lab Head dashboard's lab prefix and date filters. `labPrefix` is read before `lab`; with neither,
 * the prefix is CITe4D. "ALL" and "All Labs" mean every lab.
 * The variable names are kept, because a repeated query value (an array) makes `labParam.trim` throw, and the
 * 500 answer carries that TypeError's text.
 *
 * @throws TypeError if labPrefix or lab is sent more than once
 */
// TODO(C-02): any prefix is accepted, so anyone can read any lab's loans, borrowers, and overdue list (01C section 4.4), and an unknown prefix gives empty data rather than an error (M-14). The lab should come from the session, step 13.
export function readLabHeadFilters(query: Query): LabHeadFilters {
    const labParam = (query.labPrefix as string) || (query.lab as string) || "CITe4D";
    const cleanPrefix = labParam.trim();
    const prefixFilter = (cleanPrefix && cleanPrefix !== "All Labs" && cleanPrefix !== "ALL") ? cleanPrefix : "";

    const startDateParam = query.startDate as string;
    const endDateParam = query.endDate as string;
    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam) : null;

    return { prefixFilter, startDate, endDate };
}
