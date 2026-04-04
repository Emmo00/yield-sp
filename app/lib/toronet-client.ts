import { createWallet, getAddr, verifyWalletPassword } from "torosdk";

import { getConfiguredNetwork, type ContractKey } from "@/app/lib/constants";
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
