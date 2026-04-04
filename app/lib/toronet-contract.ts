import ERC20_ABI from "@/app/abis/ERC20.json";
import LOAN_VAULT_ABI from "@/app/abis/LoanVault.json";
import {
  getConfiguredNetwork,
  getContractAddress,
  getToronetBaseUrl,
  type ContractKey,
  type NetworkEnv,
} from "@/app/lib/constants";

type ContractCallArg = string | number | boolean | bigint;

export interface ToronetContractCallInput {
  address: string;
  password: string;
  contract: ContractKey;
  functionName: string;
  args?: ContractCallArg[];
  network?: NetworkEnv;
}

const CONTRACT_ABIS: Record<ContractKey, unknown> = {
  "loan-vault": LOAN_VAULT_ABI,
  stablecoin: ERC20_ABI,
};

function toApiValue(value: ContractCallArg): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return String(value);
}

export async function callToronetContract(
  input: ToronetContractCallInput,
): Promise<{ raw: unknown; network: NetworkEnv; contractAddress: string }> {
  const network = input.network ?? getConfiguredNetwork();
  const contractAddress = getContractAddress(input.contract, network);
  const baseUrl = getToronetBaseUrl(network);

  const encodedArguments = (input.args ?? [])
    .map((arg) => encodeURIComponent(toApiValue(arg)))
    .join("|");

  const payload = {
    op: "callContractFunction",
    params: [
      { name: "addr", value: input.address },
      { name: "pwd", value: input.password },
      { name: "contractaddress", value: contractAddress },
      { name: "functionname", value: input.functionName },
      { name: "functionarguments", value: encodedArguments },
      { name: "abi", value: encodeURIComponent(JSON.stringify(CONTRACT_ABIS[input.contract])) },
    ],
  };

  const response = await fetch(`${baseUrl}/api/keystore/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  const responseJson = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof responseJson === "object" && responseJson !== null && "error" in responseJson
        ? String((responseJson as { error?: unknown }).error ?? "Contract call failed")
        : `Contract call failed with status ${response.status}`;

    throw new Error(message);
  }

  if (
    typeof responseJson === "object" &&
    responseJson !== null &&
    "error" in responseJson &&
    (responseJson as { error?: unknown }).error
  ) {
    throw new Error(String((responseJson as { error?: unknown }).error));
  }

  return {
    raw: responseJson,
    network,
    contractAddress,
  };
}
