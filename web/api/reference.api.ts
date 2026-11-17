/**
 * Reference Data API: the asset categories, labs, and funding sources TSG and the Secretary keep. The only place these
 * URLs appear in the frontend.
 * Layer: api. Called by features/reference (the three sections of the Reference Data page). Calls client.ts; types
 * from @shared/types/reference.
 * Used by: the Reference Data page.
 */
import type { CategoryCreateInput, CategoryUpdateInput, FundingSourceInput, LabCreateInput, LabUpdateInput } from "@shared/types/reference";
import { apiGetRaw, apiPostRaw, apiPutRaw, readResult, type ApiResult } from "./client";

/**
 * Lists every category, inactive ones too, with how many assets have each.
 *
 * @returns `success` and `categories`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function listCategories(): Promise<ApiResult> {
  return readResult(await apiGetRaw("/api/reference/categories"), "Could not load the categories. Try again.");
}

/**
 * Adds a category. The server makes its code from the label.
 *
 * @returns `success` and `category`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function addCategory(body: CategoryCreateInput): Promise<ApiResult> {
  return readResult(await apiPostRaw("/api/reference/categories", body), "Could not add the category. Try again.");
}

/**
 * Changes a category's label, useful life, or whether it is active.
 *
 * @param code the category's code, which never changes
 * @returns `success` and `category`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function changeCategory(code: string, body: CategoryUpdateInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/reference/categories/${encodeURIComponent(code)}`, body), "Could not save the category. Try again.");
}

/**
 * Lists every lab with its campus and how many assets it is home to.
 *
 * @returns `success` and `labs`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function listLabs(): Promise<ApiResult> {
  return readResult(await apiGetRaw("/api/reference/labs"), "Could not load the labs. Try again.");
}

/**
 * Adds a lab.
 *
 * @returns `success` and `lab`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function addLab(body: LabCreateInput): Promise<ApiResult> {
  return readResult(await apiPostRaw("/api/reference/labs", body), "Could not add the lab. Try again.");
}

/**
 * Changes a lab's name or campus. The short code never changes.
 *
 * @returns `success` and `lab`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function changeLab(centerId: number, body: LabUpdateInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/reference/labs/${centerId}`, body), "Could not save the lab. Try again.");
}

/**
 * Lists every funding source with how many assets and projects name it.
 *
 * @returns `success` and `fundingSources`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function listFundingSources(): Promise<ApiResult> {
  return readResult(await apiGetRaw("/api/reference/funding-sources"), "Could not load the funding sources. Try again.");
}

/**
 * Adds a funding source.
 *
 * @returns `success` and `fundingSource`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function addFundingSource(body: FundingSourceInput): Promise<ApiResult> {
  return readResult(await apiPostRaw("/api/reference/funding-sources", body), "Could not add the funding source. Try again.");
}

/**
 * Renames a funding source.
 *
 * @returns `success` and `fundingSource`, or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function renameFundingSource(fundingSourceId: number, body: FundingSourceInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/reference/funding-sources/${fundingSourceId}`, body), "Could not save the funding source. Try again.");
}
