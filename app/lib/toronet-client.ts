import { createWallet, getAddr, getName, verifyWalletPassword } from "torosdk";

import type {
  ActivityLogRecord,
  ActivityLogWriteInput,
} from "@/app/lib/activity-log";
import {
  getConfiguredNetwork,
  type ContractKey,
  type NetworkEnv,
} from "@/app/lib/constants";
import {
  queryToronetContract,
  writeToronetContract,
} from "@/app/lib/toronet-contract";
import { extractAddress, isHexAddress } from "@/app/lib/toronet-common";
import { ensureToronetSDK } from "@/app/lib/toronet-sdk";

interface ContractApiParams {
  address?: string;
  password?: string;
  contract: ContractKey;
  functionName: string;
  args?: Array<string | number | boolean | bigint>;
  network?: NetworkEnv;
  mode?: "query" | "transaction";
}

interface LoginResult {
  address: string;
  identifier: string;
  network?: string;
}

interface SignupResult {
  address: string;
  username: string;
  network?: string;
}

export type FeedbackStatus = "new" | "in_review" | "resolved";

export interface FeedbackRecord {
  id: string;
  message: string;
  status: FeedbackStatus;
  userAddress?: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function loginWithToronet(
  identifier: string,
  password: string,
): Promise<LoginResult> {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier || !password) {
    throw new Error("Identifier and password are required.");
  }

  const network = ensureToronetSDK(getConfiguredNetwork());

  let resolvedAddress: string | null = null;
  if (isHexAddress(normalizedIdentifier)) {
    resolvedAddress = normalizedIdentifier;
  } else {
    const lookup = await getAddr({ name: normalizedIdentifier });
    resolvedAddress = extractAddress(lookup);
  }

  if (!resolvedAddress) {
    throw new Error("Invalid credentials.");
  }

  const isValid = await verifyWalletPassword({
    address: resolvedAddress,
    password,
  });

  if (!isValid) {
    throw new Error("Invalid credentials.");
  }

  return {
    address: resolvedAddress,
    identifier: normalizedIdentifier,
    network,
  };
}

export async function signupWithToronet(
  username: string,
  password: string,
): Promise<SignupResult> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password) {
    throw new Error("Username and password are required.");
  }

  const network = ensureToronetSDK(getConfiguredNetwork());
  const address = await createWallet({
    username: normalizedUsername,
    password,
  });

  if (!isHexAddress(address)) {
    throw new Error("Could not create account.");
  }

  return {
    address,
    username: normalizedUsername,
    network,
  };
}

export async function submitSignupEmailApi(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  if (!response.ok) {
    const fallback = "Could not save sign-up email.";

    let message = fallback;
    try {
      const parsed = (await response.json()) as { error?: string };
      message = parsed.error || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }
}

export async function getToronetUsernameByAddress(
  address: string,
): Promise<string | null> {
  const normalizedAddress = address.trim();
  if (!isHexAddress(normalizedAddress)) {
    return null;
  }

  ensureToronetSDK(getConfiguredNetwork());
  const result = await getName({ address: normalizedAddress });

  if (typeof result === "string" && result.trim().length > 0) {
    return result.trim();
  }

  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    for (const key of ["name", "username", "result", "value"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
}

export async function callToronetContractApi(params: ContractApiParams): Promise<unknown> {
  const args = params.args?.map((arg) => (typeof arg === "bigint" ? arg.toString() : arg)) ?? [];

  if ((params.mode ?? "query") === "transaction") {
    const result = await writeToronetContract({
      address: params.address,
      password: params.password,
      contract: params.contract,
      functionName: params.functionName,
      args,
    });

    return result.raw;
  }

  const result = await queryToronetContract({
    contract: params.contract,
    functionName: params.functionName,
    args,
    network: params.network ?? getConfiguredNetwork(),
  });

  return result.raw;
}

export async function queryToronetContractApi(
  params: Omit<ContractApiParams, "mode">,
): Promise<unknown> {
  return callToronetContractApi({
    ...params,
    mode: "query",
  });
}

export async function writeToronetContractApi(
  params: Omit<ContractApiParams, "mode">,
): Promise<unknown> {
  return callToronetContractApi({
    ...params,
    mode: "transaction",
  });
}

export async function mintOnToronetTestnet(params: {
  address: string;
  password: string;
  to: string;
  amount: string;
}): Promise<unknown> {
  const network = getConfiguredNetwork();
  if (network !== "testnet") {
    throw new Error("Minting is only enabled on testnet.");
  }

  const result = await writeToronetContract({
    address: params.address,
    password: params.password,
    contract: "stablecoin",
    functionName: "mint",
    args: [params.to, params.amount],
    network,
  });

  return result.raw;
}

export async function logActivityEventApi(payload: ActivityLogWriteInput): Promise<void> {
  const response = await fetch("/api/activity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const fallback = "Could not persist activity event.";

    let message = fallback;
    try {
      const parsed = (await response.json()) as { error?: string };
      message = parsed.error || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }
}

export async function fetchActivityHistoryApi(
  address: string,
  limit = 50,
): Promise<ActivityLogRecord[]> {
  const params = new URLSearchParams({
    address,
    limit: String(limit),
  });

  const response = await fetch(`/api/activity?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const fallback = "Could not fetch activity history.";

    let message = fallback;
    try {
      const parsed = (await response.json()) as { error?: string };
      message = parsed.error || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as { items?: ActivityLogRecord[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function submitFeedbackApi(payload: {
  message: string;
  userAddress?: string;
  username?: string;
}): Promise<void> {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const fallback = "Could not submit feedback.";

    let message = fallback;
    try {
      const parsed = (await response.json()) as { error?: string };
      message = parsed.error || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }
}

export async function fetchAdminFeedbackApi(params: {
  adminPassword: string;
  status?: FeedbackStatus;
  limit?: number;
}): Promise<FeedbackRecord[]> {
  const query = new URLSearchParams();
  if (params.status) {
    query.set("status", params.status);
  }

  if (typeof params.limit === "number" && Number.isFinite(params.limit)) {
    query.set("limit", String(Math.max(1, Math.floor(params.limit))));
  }

  const route = query.toString() ? `/api/feedback?${query.toString()}` : "/api/feedback";
  const response = await fetch(route, {
    method: "GET",
    headers: {
      "x-admin-password": params.adminPassword,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const fallback = "Could not load feedback.";

    let message = fallback;
    try {
      const parsed = (await response.json()) as { error?: string };
      message = parsed.error || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as { items?: FeedbackRecord[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function updateAdminFeedbackStatusApi(params: {
  adminPassword: string;
  id: string;
  status: FeedbackStatus;
}): Promise<void> {
  const response = await fetch("/api/feedback", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": params.adminPassword,
    },
    body: JSON.stringify({
      id: params.id,
      status: params.status,
    }),
  });

  if (!response.ok) {
    const fallback = "Could not update feedback status.";

    let message = fallback;
    try {
      const parsed = (await response.json()) as { error?: string };
      message = parsed.error || fallback;
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }
}
