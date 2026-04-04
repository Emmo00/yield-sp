import { createWallet, getAddr, verifyWalletPassword } from "torosdk";

import { getConfiguredNetwork, type ContractKey } from "@/app/lib/constants";
import { extractAddress, isHexAddress } from "@/app/lib/toronet-common";
import { ensureToronetSDK } from "@/app/lib/toronet-sdk";

interface ApiResponseShape {
  ok?: boolean;
  error?: string;
  details?: string;
  response?: unknown;
  address?: string;
  identifier?: string;
  username?: string;
  network?: string;
  contractAddress?: string;
}

interface ContractApiParams {
  address: string;
  password: string;
  contract: ContractKey;
  functionName: string;
  args?: Array<string | number | boolean | bigint>;
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

function toErrorMessage(payload: ApiResponseShape | null, fallback: string): string {
  if (!payload) {
    return fallback;
  }

  if (payload.error && payload.details) {
    return `${payload.error} ${payload.details}`;
  }

  return payload.error ?? payload.details ?? fallback;
}

async function parseJsonResponse(response: Response): Promise<ApiResponseShape | null> {
  try {
    return (await response.json()) as ApiResponseShape;
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

export async function callToronetContractApi(params: ContractApiParams): Promise<unknown> {
  const response = await fetch("/api/toronet/contract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: params.address,
      password: params.password,
      contract: params.contract,
      functionName: params.functionName,
      args: params.args?.map((arg) => (typeof arg === "bigint" ? arg.toString() : arg)) ?? [],
      mode: params.mode ?? "query",
    }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok || !payload?.ok) {
    throw new Error(toErrorMessage(payload, "Contract call failed."));
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
  const response = await fetch("/api/toronet/mint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok || !payload?.ok) {
    throw new Error(toErrorMessage(payload, "Mint request failed."));
  }

  return payload.response;
}
