import { NextResponse } from "next/server";
import { getAddr, verifyWalletPassword } from "torosdk";

import { getConfiguredNetwork } from "@/app/lib/constants";
import { extractAddress, isHexAddress } from "@/app/lib/toronet-common";
import { ensureToronetSDK } from "@/app/lib/toronet-sdk";

interface LoginRequestBody {
  identifier?: string;
  password?: string;
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

async function resolveAddress(identifier: string): Promise<string | null> {
  if (isHexAddress(identifier)) {
    return identifier;
  }

  const lookup = await getAddr({ name: identifier });
  return extractAddress(lookup);
}

export async function POST(request: Request) {
  let body: LoginRequestBody;

  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const identifier = body.identifier?.trim() ?? "";
  const password = body.password ?? "";

  if (!identifier || !password) {
    return NextResponse.json(
      { ok: false, error: "Identifier and password are required." },
      { status: 400 },
    );
  }

  try {
    const network = getConfiguredNetwork();
    ensureToronetSDK(network);

    const resolvedAddress = await resolveAddress(identifier);
    if (!resolvedAddress) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials." },
        { status: 401 },
      );
    }

    const isValid = await verifyWalletPassword({
      address: resolvedAddress,
      password,
    });

    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      network,
      address: resolvedAddress,
      identifier,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid credentials.",
        details: getErrorMessage(error),
      },
      { status: 401 },
    );
  }
}
