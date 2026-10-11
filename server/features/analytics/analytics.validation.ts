import type { Request } from 'express';

type Query = Request['query'];

/** The Director dashboard's filters, read from the query. */
export interface DirectorFilters {
    labFilter: string;
    isSpecificLab: boolean;
    startDate: Date | null;
    endDate: Date | null;
}

/** The Lab Head dashboard's filters, read from the query. */
export interface LabHeadFilters {
    prefixFilter: string;
    startDate: Date | null;
    endDate: Date | null;
}

/** The optional `lab` query value. */
export function readLabQuery(query: Query): string | undefined {
    return query.lab as string | undefined;
}

/** The optional `category` query value of the loan recommender. */
export function readCategoryQuery(query: Query): string | undefined {
    return query.category as string | undefined;
}

/** Reads the Director dashboard's lab and date filters. */
export function readDirectorFilters(query: Query): DirectorFilters {
    const labFilter = (query.lab as string) || "";
    const startDateParam = query.startDate as string;
    const endDateParam = query.endDate as string;

    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam) : null;

    const isSpecificLab = labFilter && labFilter !== "All Labs" && labFilter !== "All Laboratories (DLSU Combined)";

    return { labFilter, isSpecificLab: !!isSpecificLab, startDate, endDate };
}

/** Reads the Lab Head dashboard's lab prefix and date filters. */
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
