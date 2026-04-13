import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";

import { getMongoCollection } from "@/app/lib/db";
import { isHexAddress } from "@/app/lib/toronet-common";

export const runtime = "nodejs";

type FeedbackStatus = "new" | "in_review" | "resolved";

interface FeedbackDocument {
  _id?: ObjectId;
  message: string;
  status: FeedbackStatus;
  userAddress?: string;
  username?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

interface FeedbackRecord {
  id: string;
  message: string;
  status: FeedbackStatus;
  userAddress?: string;
  username?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

const VALID_STATUSES: FeedbackStatus[] = ["new", "in_review", "resolved"];
const USERNAME_REGEX = /^[a-zA-Z0-9_\-.]{2,50}$/;
let indexesReady: Promise<void> | null = null;

function toFeedbackRecord(item: FeedbackDocument): FeedbackRecord {
  return {
    id: item._id?.toHexString() ?? "",
    message: item.message,
    status: item.status,
    userAddress: item.userAddress,
    username: item.username,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    resolvedAt: item.resolvedAt?.toISOString(),
  };
}

function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && VALID_STATUSES.includes(value as FeedbackStatus);
}

function sanitizeOptionalString(input: unknown, maxLength: number): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function parseLimit(rawValue: string | null): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }

  return Math.min(Math.floor(parsed), 250);
}

function getConfiguredAdminPassword(): string {
  const value = process.env.ADMIN_UI_PASSWORD?.trim();
  if (!value) {
    throw new Error("ADMIN_UI_PASSWORD is not configured.");
  }

  return value;
}

function equalsSecret(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function assertAdminAccess(request: NextRequest): { ok: true } | { ok: false; response: NextResponse } {
  let expected: string;

  try {
    expected = getConfiguredAdminPassword();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin password is not configured.";
    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 500 }),
    };
  }

  const provided = request.headers.get("x-admin-password")?.trim();
  if (!provided || !equalsSecret(provided, expected)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  return { ok: true };
}

function validateCreatePayload(payload: unknown): { value?: Omit<FeedbackDocument, "_id" | "createdAt" | "updatedAt" | "status">; error?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Invalid request body." };
  }

  const record = payload as Record<string, unknown>;

  if ("password" in record || "pwd" in record) {
    return { error: "Sensitive fields are not allowed." };
  }

  const message = sanitizeOptionalString(record.message, 1500);
  if (!message) {
    return { error: "message is required." };
  }

  const userAddressRaw = sanitizeOptionalString(record.userAddress, 128);
  const userAddress = userAddressRaw ? userAddressRaw.toLowerCase() : undefined;
  if (userAddress && !isHexAddress(userAddress)) {
    return { error: "userAddress must be a valid address." };
  }

  const username = sanitizeOptionalString(record.username, 60);
  if (username && !USERNAME_REGEX.test(username)) {
    return { error: "username format is invalid." };
  }

  return {
    value: {
      message,
      userAddress,
      username,
    },
  };
}

function validateUpdatePayload(payload: unknown): { value?: { id: string; status: FeedbackStatus }; error?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Invalid request body." };
  }

  const record = payload as Record<string, unknown>;
  const id = sanitizeOptionalString(record.id, 64);
  if (!id || !ObjectId.isValid(id)) {
    return { error: "A valid feedback id is required." };
  }

  if (!isFeedbackStatus(record.status)) {
    return { error: "status must be one of: new, in_review, resolved." };
  }

  return {
    value: {
      id,
      status: record.status,
    },
  };
}

async function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = (async () => {
      const collection = await getMongoCollection<FeedbackDocument>("user_feedback");
      await collection.createIndex({ status: 1, createdAt: -1 });
      await collection.createIndex({ userAddress: 1, createdAt: -1 }, { sparse: true });
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

  const validated = validateCreatePayload(payload);
  if (!validated.value) {
    return NextResponse.json({ error: validated.error ?? "Invalid request body." }, { status: 400 });
  }

  try {
    await ensureIndexes();

    const now = new Date();
    const collection = await getMongoCollection<FeedbackDocument>("user_feedback");

    await collection.insertOne({
      ...validated.value,
      status: "new",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit feedback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const access = assertAdminAccess(request);
  if (!access.ok) {
    return access.response;
  }

  const rawStatus = request.nextUrl.searchParams.get("status");
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  if (rawStatus && !isFeedbackStatus(rawStatus)) {
    return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
  }

  try {
    await ensureIndexes();

    const collection = await getMongoCollection<FeedbackDocument>("user_feedback");
    const statusFilter: FeedbackStatus | undefined =
      rawStatus && isFeedbackStatus(rawStatus) ? rawStatus : undefined;
    const query: { status?: FeedbackStatus } = statusFilter
      ? { status: statusFilter }
      : {};

    const items = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      items: items.map(toFeedbackRecord),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not fetch feedback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = assertAdminAccess(request);
  if (!access.ok) {
    return access.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateUpdatePayload(payload);
  if (!validated.value) {
    return NextResponse.json({ error: validated.error ?? "Invalid request body." }, { status: 400 });
  }

  try {
    await ensureIndexes();

    const collection = await getMongoCollection<FeedbackDocument>("user_feedback");
    const now = new Date();

    const filter = { _id: new ObjectId(validated.value.id) };
    const updateResult =
      validated.value.status === "resolved"
        ? await collection.updateOne(filter, {
            $set: {
              status: validated.value.status,
              updatedAt: now,
              resolvedAt: now,
            },
          })
        : await collection.updateOne(filter, {
            $set: {
              status: validated.value.status,
              updatedAt: now,
            },
            $unset: {
              resolvedAt: true,
            },
          });

    if (!updateResult.matchedCount) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update feedback.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
