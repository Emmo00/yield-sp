import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import {
  isActivityLogAction,
  isActivityLogStatus,
  type ActivityLogRecord,
  type ActivityLogWriteInput,
} from "@/app/lib/activity-log";
import { getMongoCollection } from "@/app/lib/db";
import { isHexAddress } from "@/app/lib/toronet-common";

export const runtime = "nodejs";

interface ActivityLogDocument {
  _id?: ObjectId;
  userAddress: string;
  action: ActivityLogWriteInput["action"];
  status: ActivityLogWriteInput["status"];
  detail: string;
  txHash?: string;
  amountUnits?: string;
  symbol?: string;
  decimals?: number;
  clientTimestamp?: string;
  createdAt: Date;
}

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
let indexesReady: Promise<void> | null = null;

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function toActivityLogRecord(item: ActivityLogDocument): ActivityLogRecord {
  return {
    id: item._id?.toHexString() ?? "",
    userAddress: item.userAddress,
    action: item.action,
    status: item.status,
    detail: item.detail,
    txHash: item.txHash,
    amountUnits: item.amountUnits,
    symbol: item.symbol,
    decimals: item.decimals,
    clientTimestamp: item.clientTimestamp,
    createdAt: item.createdAt.toISOString(),
  };
}

async function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = (async () => {
      const collection = await getMongoCollection<ActivityLogDocument>("activity_logs");
      await collection.createIndex({ userAddress: 1, createdAt: -1 });
      await collection.createIndex({ txHash: 1 }, { sparse: true });
    })();
  }

  await indexesReady;
}

function parseLimit(rawValue: string | null): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(Math.floor(parsed), 50);
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

function validatePayload(payload: unknown): { value?: ActivityLogWriteInput; error?: string } {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid request body." };
  }

  const record = payload as Record<string, unknown>;

  const rawAddress = sanitizeOptionalString(record.userAddress, 128);
  if (!rawAddress || !isHexAddress(rawAddress)) {
    return { error: "A valid userAddress is required." };
  }

  const rawAction = sanitizeOptionalString(record.action, 64);
  if (!rawAction || !isActivityLogAction(rawAction)) {
    return { error: "Invalid action." };
  }

  const rawStatus = sanitizeOptionalString(record.status, 32);
  if (!rawStatus || !isActivityLogStatus(rawStatus)) {
    return { error: "Invalid status." };
  }

  const detail = sanitizeOptionalString(record.detail, 500);
  if (!detail) {
    return { error: "detail is required." };
  }

  const txHash = sanitizeOptionalString(record.txHash, 80);
  if (txHash && !TX_HASH_REGEX.test(txHash)) {
    return { error: "Invalid txHash." };
  }

  const amountUnits = sanitizeOptionalString(record.amountUnits, 100);
  if (amountUnits && !/^\d+$/.test(amountUnits)) {
    return { error: "amountUnits must be an integer string." };
  }

  const symbol = sanitizeOptionalString(record.symbol, 32);

  let decimals: number | undefined;
  if (record.decimals !== undefined) {
    if (typeof record.decimals !== "number" || !Number.isInteger(record.decimals) || record.decimals < 0 || record.decimals > 36) {
      return { error: "decimals must be an integer between 0 and 36." };
    }

    decimals = record.decimals;
  }

  const clientTimestamp = sanitizeOptionalString(record.clientTimestamp, 64);

  if ("password" in record || "raw" in record || "request" in record || "response" in record || "payload" in record) {
    return { error: "Sensitive payload fields are not allowed." };
  }

  return {
    value: {
      userAddress: normalizeAddress(rawAddress),
      action: rawAction,
      status: rawStatus,
      detail,
      txHash,
      amountUnits,
      symbol,
      decimals,
      clientTimestamp,
    },
  };
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  if (!address || !isHexAddress(address)) {
    return NextResponse.json({ error: "A valid address query parameter is required." }, { status: 400 });
  }

  try {
    await ensureIndexes();
    const collection = await getMongoCollection<ActivityLogDocument>("activity_logs");
    const items = await collection
      .find({ userAddress: normalizeAddress(address) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      items: items.map(toActivityLogRecord),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not fetch activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
    const collection = await getMongoCollection<ActivityLogDocument>("activity_logs");

    const document: ActivityLogDocument = {
      ...validated.value,
      createdAt: new Date(),
    };

    const insert = await collection.insertOne(document);

    return NextResponse.json({
      id: insert.insertedId.toHexString(),
      ok: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not store activity.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
