import { createWallet, getAddr, getName, verifyWalletPassword } from "torosdk";

import {
  getConfiguredNetwork,
  type ContractKey,
  type NetworkEnv,
} from "@/app/lib/constants";
import {
  writeToronetContract,
} from "@/app/lib/toronet-contract";
import { extractAddress, isHexAddress } from "@/app/lib/toronet-common";
import { ensureToronetSDK } from "@/app/lib/toronet-sdk";

interface QueryApiResponse {
  ok?: boolean;
  error?: string;
  details?: string;
  response?: unknown;
}

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

function toErrorMessage(payload: QueryApiResponse | null, fallback: string): string {
  if (!payload) {
    return fallback;
  }

  if (payload.error && payload.details) {
    return `${payload.error} ${payload.details}`;
  }

  return payload.error ?? payload.details ?? fallback;
}

async function parseJsonResponse(response: Response): Promise<QueryApiResponse | null> {
  try {
    return (await response.json()) as QueryApiResponse;
  } catch {
    return null;
  }
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

  const response = await fetch("/api/toronet/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contract: params.contract,
      functionName: params.functionName,
      args,
      network: params.network ?? getConfiguredNetwork(),
    }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok || !payload?.ok) {
    throw new Error(toErrorMessage(payload, "Contract query failed."));
  }

  return payload.response;
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
