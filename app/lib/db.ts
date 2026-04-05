import "server-only";

import { MongoClient, type Collection, type Db, type Document } from "mongodb";

declare global {
  var __yieldSpMongoClientPromise: Promise<MongoClient> | undefined;
}

function inferDbNameFromUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    const fromPath = parsed.pathname.replace(/^\//, "").trim();
    if (fromPath.length > 0) {
      return fromPath;
    }
  } catch {
    // Ignore parse errors and fall back to default.
  }

  return "yield_sp";
}

function getMongoUri(): string {
  const value = process.env.MONGODB_URI?.trim();
  if (!value) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return value;
}

function getMongoDbName(uri: string): string {
  const explicit = process.env.MONGODB_DB?.trim();
  if (explicit) {
    return explicit;
  }

  return inferDbNameFromUri(uri);
}

export async function getMongoClient(): Promise<MongoClient> {
  if (globalThis.__yieldSpMongoClientPromise) {
    return globalThis.__yieldSpMongoClientPromise;
  }

  const uri = getMongoUri();
  const client = new MongoClient(uri);
  globalThis.__yieldSpMongoClientPromise = client.connect();
  return globalThis.__yieldSpMongoClientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const uri = getMongoUri();
  const dbName = getMongoDbName(uri);
  const client = await getMongoClient();
  return client.db(dbName);
}

export async function getMongoCollection<TSchema extends Document>(name: string): Promise<Collection<TSchema>> {
  const db = await getMongoDb();
  return db.collection<TSchema>(name);
}
