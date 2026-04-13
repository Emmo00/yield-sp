import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { getMongoCollection } from "@/app/lib/db";

export const runtime = "nodejs";

interface SignupEmailDocument {
  _id?: ObjectId;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  signupCount: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let indexesReady: Promise<void> | null = null;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validatePayload(payload: unknown): { value?: { email: string }; error?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Invalid request body." };
  }

  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== "email") {
    return { error: "Only email can be submitted." };
  }

  if (typeof record.email !== "string") {
    return { error: "email must be a string." };
  }

  const email = normalizeEmail(record.email);
  if (!email) {
    return { error: "email is required." };
  }

  if (email.length > 320 || !EMAIL_REGEX.test(email)) {
    return { error: "Invalid email format." };
  }

  return {
    value: {
      email,
    },
  };
}

async function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = (async () => {
      const collection = await getMongoCollection<SignupEmailDocument>("signup_emails");
      await collection.createIndex({ email: 1 }, { unique: true });
      await collection.createIndex({ updatedAt: -1 });
    })();
  }

  await indexesReady;
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validatePayload(payload);
  if (!validated.value) {
    return NextResponse.json({ error: validated.error ?? "Invalid request body." }, { status: 400 });
  }

  try {
    await ensureIndexes();

    const collection = await getMongoCollection<SignupEmailDocument>("signup_emails");
    const now = new Date();

    await collection.updateOne(
      { email: validated.value.email },
      {
        $setOnInsert: {
          email: validated.value.email,
          createdAt: now,
          signupCount: 0,
        },
        $set: {
          updatedAt: now,
        },
        $inc: {
          signupCount: 1,
        },
      },
      { upsert: true },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not store signup email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
