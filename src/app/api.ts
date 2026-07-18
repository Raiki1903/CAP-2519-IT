// Thin fetch() wrapper around the real Express/Prisma backend (server/server.ts).
// Base URL resolves to the Vite dev proxy ("/api" -> http://localhost:4000) unless
// VITE_API_URL is set to point somewhere else.
const BASE = (import.meta as any).env?.VITE_API_URL || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return body;
}

// ── Response shapes (mirrors server/server.ts's formatted responses) ───────
export interface BackendAsset {
  id: string;
  name: string;
  serial: string;
  manufacturer: string;
  category: string;
  funding: string;
  cost: number;
  procured: string;
  warranty: string;
  location: string;
  lab: string;
  status: string;
  condition: number;
  custodian?: string;
  borrowedOn?: string;
  dueDate?: string;
  daysLeft?: number;
}

export interface BackendLoan {
  id: string;
  loanId: number;
  assetId: string;
  asset: string;
  borrower: string;
  purpose: string;
  requestedOn: string;
  dueDate: string;
  status: "Pending" | "Approved" | "Declined";
  location: string;
  lab: string;
}

export interface BackendRepair {
  id: string;
  repairId: number;
  assetId: string;
  asset: string;
  reportedBy: string;
  description: string;
  isImmediate: boolean;
  progressStatus: string;
  createdAt: string;
}

export interface BackendReturn {
  id: string;
  returnId: number;
  assetId: string;
  asset: string;
  returnedBy: string;
  condition: string;
  accessories: string[];
  referenceNumber: string;
  returnedOn: string;
}

export interface BackendTransfer {
  id: string;
  transferId: number;
  assetId: string;
  asset: string;
  from: string;
  to: string;
  justification: string;
  requestedOn: string;
  status: "Pending" | "Approved" | "Declined";
  location: string;
  lab: string;
}

export const api = {
  getAssets: () => request<{ assets: BackendAsset[] }>("/assets"),
  createAsset: (data: Record<string, unknown>) =>
    request("/assets", { method: "POST", body: JSON.stringify(data) }),
  updateAsset: (assetTag: string, data: Record<string, unknown>) =>
    request(`/assets/${encodeURIComponent(assetTag)}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAsset: (assetTag: string) =>
    request(`/assets/${encodeURIComponent(assetTag)}`, { method: "DELETE" }),

  borrowAsset: (assetTag: string, data: { borrower: string; purpose: string; dueDate: string }) =>
    request(`/assets/${encodeURIComponent(assetTag)}/borrow`, { method: "POST", body: JSON.stringify(data) }),
  getLoans: () => request<{ loans: BackendLoan[] }>("/asset_loans"),
  decideLoan: (loanId: number, decision: "approve" | "decline") =>
    request(`/asset_loans/${loanId}/decision`, { method: "PUT", body: JSON.stringify({ decision }) }),

  reportRepair: (assetTag: string, data: { description: string; isImmediate?: boolean; reportedBy?: string }) =>
    request(`/assets/${encodeURIComponent(assetTag)}/repair`, { method: "POST", body: JSON.stringify(data) }),
  getRepairs: () => request<{ repairs: BackendRepair[] }>("/asset_repairs"),
  updateRepairStatus: (repairId: number, progressStatus: string) =>
    request(`/asset_repairs/${repairId}`, { method: "PUT", body: JSON.stringify({ progressStatus }) }),

  finalizeReturn: (assetTag: string, data: { condition: string; accessories?: string[]; returnedBy?: string }) =>
    request(`/assets/${encodeURIComponent(assetTag)}/return`, { method: "POST", body: JSON.stringify(data) }),
  getReturns: () => request<{ returns: BackendReturn[] }>("/asset_returns"),

  requestTransfer: (assetTag: string, data: { toCustodian: string; reason: string }) =>
    request(`/assets/${encodeURIComponent(assetTag)}/transfer`, { method: "POST", body: JSON.stringify(data) }),
  getTransfers: () => request<{ transfers: BackendTransfer[] }>("/asset_transfers"),
  decideTransfer: (transferId: number, decision: "approve" | "decline") =>
    request(`/asset_transfers/${transferId}/decision`, { method: "PUT", body: JSON.stringify({ decision }) }),
};
