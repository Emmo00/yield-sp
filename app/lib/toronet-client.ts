import type { ContractKey } from "@/app/lib/constants";

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
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier, password }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok || !payload?.ok || !payload.address) {
    throw new Error(toErrorMessage(payload, "Login failed."));
  }

  return {
    address: payload.address,
    identifier: payload.identifier ?? identifier,
    network: payload.network,
  };
}

export async function signupWithToronet(
  username: string,
  password: string,
): Promise<SignupResult> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok || !payload?.ok || !payload.address) {
    throw new Error(toErrorMessage(payload, "Sign-up failed."));
  }

  return {
    address: payload.address,
    username: payload.username ?? username,
    network: payload.network,
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
