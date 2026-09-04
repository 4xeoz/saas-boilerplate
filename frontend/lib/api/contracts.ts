import { getBackendUrl } from "./client";

export type AccountContract = {
  type: "webmcp.reentry_account_contract";
  protocol_version: "0.1";
  contract_id: string;
  site_origin: string;
  site_name: string;
  title: string;
  reason: string;
  workflow_id: string;
  event_type: string;
  human_boundary: string;
  approved_at: string;
  expires_at: string;
  runs_remaining: number;
  status: "active" | "expired" | "exhausted" | "revoked";
  connector_device_name: string;
};

export type AccountContractsResponse = {
  type: "webmcp.reentry_account_contracts";
  protocol_version: "0.1";
  contracts: AccountContract[];
};

function readErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return null;
  const code = (error as Record<string, unknown>).code;
  return typeof code === "string" ? code : null;
}

export async function listAccountContracts(): Promise<AccountContractsResponse> {
  const response = await fetch(`${getBackendUrl()}/v0.1/account/contracts`, {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const code = readErrorCode(payload);
    if (response.status === 401 || code === "session_required") {
      throw new Error("Sign in to view your contracts.");
    }
    throw new Error("Unable to load your contracts. Please try again.");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as Record<string, unknown>).type !== "webmcp.reentry_account_contracts" ||
    (payload as Record<string, unknown>).protocol_version !== "0.1" ||
    !Array.isArray((payload as Record<string, unknown>).contracts)
  ) {
    throw new Error("The contracts service returned an invalid response.");
  }

  return payload as AccountContractsResponse;
}
