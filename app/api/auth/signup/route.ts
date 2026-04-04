import { NextResponse } from "next/server";
import { createWallet } from "torosdk";

import { getConfiguredNetwork } from "@/app/lib/constants";
import { ensureToronetSDK } from "@/app/lib/toronet-sdk";

interface SignupRequestBody {
  username?: string;
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

export async function POST(request: Request) {
  let body: SignupRequestBody;

  try {
    body = (await request.json()) as SignupRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { ok: false, error: "Username and password are required." },
      { status: 400 },
    );
  }

  try {
    const network = getConfiguredNetwork();
    ensureToronetSDK(network);

    const address = await createWallet({
      username,
      password,
    });

    return NextResponse.json({
      ok: true,
      network,
      username,
      address,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not create account.",
        details: getErrorMessage(error),
      },
      { status: 400 },
    );
  }
}
