import { apiPost, type ApiResult } from "./client";

export interface ReturnInput {
  returnedBy: string;
  condition: string;
  comments: string;
}

export function finalizeReturn(assetTag: string, input: ReturnInput): Promise<ApiResult> {
  return apiPost(`/api/assets/${assetTag}/return`, input);
}
