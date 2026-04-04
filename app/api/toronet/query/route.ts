import { NextResponse } from "next/server";

import {
  queryToronetContract,
  type ToronetContractCallInput,
} from "@/app/lib/toronet-contract";
import {
  type NetworkEnv,
} from "@/app/lib/constants";

type QueryBody = {
  contract?: ToronetContractCallInput["contract"];
  functionName?: string;
  args?: ToronetContractCallInput["args"];
  network?: NetworkEnv;
};

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
  let body: QueryBody;

  try {
    body = (await request.json()) as QueryBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const functionName = body.functionName?.trim() ?? "";

  if (!body.contract || !functionName) {
    return NextResponse.json(
      { ok: false, error: "contract and functionName are required." },
      { status: 400 },
    );
  }

  try {
    const result = await queryToronetContract({
      contract: body.contract,
      functionName,
      args: body.args ?? [],
      network: body.network,
    });

    return NextResponse.json({
      ok: true,
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
