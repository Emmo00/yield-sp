import { NextResponse } from "next/server";

import {
  callToronetContract,
  type ToronetContractCallInput,
} from "@/app/lib/toronet-contract";
import { isHexAddress } from "@/app/lib/toronet-common";

interface ContractRequestBody {
  address?: string;
  password?: string;
  contract?: ToronetContractCallInput["contract"];
  functionName?: string;
  args?: ToronetContractCallInput["args"];
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

  if (!address || !password || !functionName || !body.contract) {
    return NextResponse.json(
      {
        ok: false,
        error: "address, password, contract and functionName are required.",
      },
      { status: 400 },
    );
  }

  if (!isHexAddress(address)) {
    return NextResponse.json(
      { ok: false, error: "Address must be a valid Toronet address." },
      { status: 400 },
    );
  }

  try {
    const result = await callToronetContract({
      address,
      password,
      contract: body.contract,
      functionName,
      args: body.args ?? [],
    });

    return NextResponse.json({
      ok: true,
      network: result.network,
      contractAddress: result.contractAddress,
      response: result.raw,
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
