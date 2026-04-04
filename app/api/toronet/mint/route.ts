import { NextResponse } from "next/server";

import { callToronetContract } from "@/app/lib/toronet-contract";
import { getConfiguredNetwork } from "@/app/lib/constants";
import { isHexAddress } from "@/app/lib/toronet-common";

interface MintRequestBody {
  address?: string;
  password?: string;
  to?: string;
  amount?: string;
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
  let body: MintRequestBody;

  try {
    body = (await request.json()) as MintRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const network = getConfiguredNetwork();
  if (network !== "testnet") {
    return NextResponse.json(
      { ok: false, error: "Minting is only enabled on testnet." },
      { status: 400 },
    );
  }

  const address = body.address?.trim() ?? "";
  const password = body.password ?? "";
  const recipient = (body.to ?? address).trim();
  const amount = body.amount?.trim() ?? "";

  if (!address || !password || !recipient || !amount) {
    return NextResponse.json(
      { ok: false, error: "address, password, to and amount are required." },
      { status: 400 },
    );
  }

  if (!isHexAddress(address) || !isHexAddress(recipient)) {
    return NextResponse.json(
      { ok: false, error: "Address and recipient must be valid Toronet addresses." },
      { status: 400 },
    );
  }

  if (!/^\d+$/.test(amount)) {
    return NextResponse.json(
      { ok: false, error: "Amount must be a base-unit integer string." },
      { status: 400 },
    );
  }

  try {
    const result = await callToronetContract({
      address,
      password,
      contract: "stablecoin",
      functionName: "mint",
      args: [recipient, amount],
      network,
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
