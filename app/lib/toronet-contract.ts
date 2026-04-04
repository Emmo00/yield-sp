import { Contract, JsonRpcProvider } from "ethers";

import ERC20_ABI from "@/app/abis/ERC20.json";
import LOAN_VAULT_ABI from "@/app/abis/LoanVault.json";
import {
  getConfiguredNetwork,
  getContractAddress,
  getToronetBaseUrl,
  getToronetRpcUrl,
  type ContractKey,
  type NetworkEnv,
} from "@/app/lib/constants";

type ContractCallArg = string | number | boolean | bigint;
type JsonRecord = Record<string, unknown>;

interface AbiFunction {
  type?: string;
  name?: string;
  stateMutability?: string;
}

type ContractAbi = readonly AbiFunction[];

export interface ToronetContractCallInput {
  address?: string;
  password?: string;
  contract: ContractKey;
  functionName: string;
  args?: ContractCallArg[];
  network?: NetworkEnv;
}

const CONTRACT_ABIS: Record<ContractKey, ContractAbi> = {
  "loan-vault": LOAN_VAULT_ABI as ContractAbi,
  stablecoin: ERC20_ABI as ContractAbi,
};

const PROVIDERS: Partial<Record<NetworkEnv, JsonRpcProvider>> = {};

function toApiValue(value: ContractCallArg): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return String(value);
}

function encodeFunctionArguments(args: ContractCallArg[] = []): string {
  return args.map((arg) => encodeURIComponent(toApiValue(arg))).join("|");
}

function getFunctionMutability(
  contract: ContractKey,
  functionName: string,
): string | null {
  const abi = CONTRACT_ABIS[contract];
  const fnEntry = abi.find(
    (entry) => entry?.type === "function" && entry?.name === functionName,
  );

  return fnEntry?.stateMutability ?? null;
}

function isReadOnlyFunction(mutability: string | null): boolean {
  return mutability === "view" || mutability === "pure";
}

function getReadProvider(network: NetworkEnv): JsonRpcProvider {
  const existing = PROVIDERS[network];
  const rpcUrl = getToronetRpcUrl(network);

  if (existing && existing._getConnection().url === rpcUrl) {
    return existing;
  }

  const provider = new JsonRpcProvider(rpcUrl);
  PROVIDERS[network] = provider;
  return provider;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function extractToronetError(payload: unknown): string | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return null;
    }

    return /error|invalid|failed|exception|unauthorized/i.test(trimmed)
      ? trimmed
      : null;
  }

  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  for (const key of ["error", "err", "details", "message", "reason"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  if (record.ok === false) {
    return "Toronet keystore request failed.";
  }

  if (typeof record.status === "string" && record.status.toLowerCase() === "error") {
    return "Toronet keystore request returned error status.";
  }

  return null;
}

function buildKeystorePayload(
  input: ToronetContractCallInput & { address: string; password: string },
  contractAddress: string,
) {
  return {
    op: "callContractFunction",
    params: [
      { name: "addr", value: input.address },
      { name: "pwd", value: input.password },
      { name: "contractaddress", value: contractAddress },
      { name: "functionname", value: input.functionName },
      {
        // Toronet API requires a pipe-delimited list with URI-encoded values.
        name: "functionarguments",
        value: encodeFunctionArguments(input.args),
      },
      {
        // Toronet API expects the full ABI JSON string URI-encoded.
        name: "abi",
        value: encodeURIComponent(JSON.stringify(CONTRACT_ABIS[input.contract])),
      },
    ],
  };
}

async function callToronetWrite(
  input: ToronetContractCallInput,
): Promise<{ raw: unknown; network: NetworkEnv; contractAddress: string }> {
  const address = input.address?.trim() ?? "";
  const password = input.password ?? "";
  if (!address || !password) {
    throw new Error("address and password are required for transaction calls.");
  }

  const network = input.network ?? getConfiguredNetwork();
  const contractAddress = getContractAddress(input.contract, network);
  const baseUrl = normalizeBaseUrl(getToronetBaseUrl(network));

  const writeInput: ToronetContractCallInput & { address: string; password: string } = {
    ...input,
    address,
    password,
  };

  const response = await fetch(`${baseUrl}/api/keystore/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(buildKeystorePayload(writeInput, contractAddress)),
  });

  const responseJson = await response.json().catch(() => null);
  const extractedError = extractToronetError(responseJson);

  if (!response.ok) {
    throw new Error(
      extractedError ?? `Contract call failed with status ${response.status}`,
    );
  }

  if (extractedError) {
    throw new Error(extractedError);
  }

  return {
    raw: responseJson,
    network,
    contractAddress,
  };
}

export async function callToronetContract(
  input: ToronetContractCallInput,
): Promise<{ raw: unknown; network: NetworkEnv; contractAddress: string }> {
  return callToronetWrite(input);
}

export async function queryToronetContract(
  input: ToronetContractCallInput,
): Promise<{ raw: unknown; network: NetworkEnv; contractAddress: string }> {
  const network = input.network ?? getConfiguredNetwork();
  const contractAddress = getContractAddress(input.contract, network);
  const mutability = getFunctionMutability(input.contract, input.functionName);

  if (mutability !== null && !isReadOnlyFunction(mutability)) {
    throw new Error(
      `${input.functionName} is not read-only in ABI. Use transaction mode for state-changing calls.`,
    );
  }

  const provider = getReadProvider(network);
  const contract = new Contract(contractAddress, CONTRACT_ABIS[input.contract], provider);
  const method = (contract as Record<string, (...args: ContractCallArg[]) => Promise<unknown>>)[
    input.functionName
  ];

  if (typeof method !== "function") {
    throw new Error(`Function ${input.functionName} not found on ${input.contract} ABI.`);
  }

  const raw = await method(...(input.args ?? []));

  return {
    raw,
    network,
    contractAddress,
  };
}

export async function writeToronetContract(
  input: ToronetContractCallInput,
): Promise<{ raw: unknown; network: NetworkEnv; contractAddress: string }> {
  return callToronetWrite(input);
}
