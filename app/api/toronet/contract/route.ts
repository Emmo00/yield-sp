import { NextResponse } from "next/server";

import {
  queryToronetContract,
  type ToronetContractCallInput,
  writeToronetContract,
} from "@/app/lib/toronet-contract";
import { isHexAddress } from "@/app/lib/toronet-common";

type ContractMode = "query" | "transaction";

interface ContractRequestBody {
  address?: string;
  password?: string;
  contract?: ToronetContractCallInput["contract"];
  functionName?: string;
  args?: ToronetContractCallInput["args"];
  mode?: ContractMode | "write";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function toJsonSafe(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonSafe(entry, depth + 1));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = toJsonSafe(entry, depth + 1);
  }

  return output;
}

export async function POST(request: Request) {
  let body: ContractRequestBody;

  try {
    body = (await request.json()) as ContractRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const address = body.address?.trim() ?? "";
  const password = body.password ?? "";
  const functionName = body.functionName?.trim() ?? "";
  const requestedMode = body.mode ?? "query";
  const mode: ContractMode = requestedMode === "write" ? "transaction" : requestedMode;

  if (!functionName || !body.contract) {
    return NextResponse.json(
      {
        ok: false,
        error: "contract and functionName are required.",
      },
      { status: 400 },
    );
  }

  if (mode !== "query" && mode !== "transaction") {
    return NextResponse.json(
      { ok: false, error: "mode must be one of: query, transaction." },
      { status: 400 },
    );
  }

  if (mode === "transaction") {
    if (!address || !password) {
      return NextResponse.json(
        { ok: false, error: "address and password are required for transactions." },
        { status: 400 },
      );
    }

    if (!isHexAddress(address)) {
      return NextResponse.json(
        { ok: false, error: "Address must be a valid Toronet address." },
        { status: 400 },
      );
    }
  }

  try {
    const callInput: ToronetContractCallInput = {
      address,
      password,
      contract: body.contract,
      functionName,
      args: body.args ?? [],
    };

    const result =
      mode === "query"
        ? await queryToronetContract(callInput)
        : await writeToronetContract(callInput);

    return NextResponse.json({
      ok: true,
      mode,
      network: result.network,
      contractAddress: result.contractAddress,
      response: toJsonSafe(result.raw),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: 400 },
    );
  }
}
