const HEX_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function isHexAddress(value: string): boolean {
  return HEX_ADDRESS_REGEX.test(value.trim());
}

export function extractAddress(payload: unknown, depth = 0): string | null {
  if (depth > 5) {
    return null;
  }

  if (typeof payload === "string") {
    if (isHexAddress(payload)) {
      return payload;
    }

    const match = payload.match(/0x[a-fA-F0-9]{40}/);
    return match ? match[0] : null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const match = extractAddress(item, depth + 1);
      if (match) {
        return match;
      }
    }

    return null;
  }

  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const preferredKeys = ["address", "addr", "result", "data", "value", "wallet"];
  for (const key of preferredKeys) {
    if (key in record) {
      const match = extractAddress(record[key], depth + 1);
      if (match) {
        return match;
      }
    }
  }

  for (const value of Object.values(record)) {
    const match = extractAddress(value, depth + 1);
    if (match) {
      return match;
    }
  }

  return null;
}

export function extractResultValue(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) {
    return payload;
  }

  for (const key of ["result", "output", "value", "returnValue", "data"]) {
    if (key in record && record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return payload;
}

export function extractBigIntValue(payload: unknown, depth = 0): bigint | null {
  if (depth > 6) {
    return null;
  }

  const candidate = depth === 0 ? extractResultValue(payload) : payload;

  if (typeof candidate === "bigint") {
    return candidate;
  }

  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return BigInt(Math.trunc(candidate));
  }

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();

    if (/^-?\d+$/.test(trimmed)) {
      return BigInt(trimmed);
    }

    const embedded = trimmed.match(/-?\d+/);
    if (embedded) {
      return BigInt(embedded[0]);
    }

    return null;
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const parsed = extractBigIntValue(item, depth + 1);
      if (parsed !== null) {
        return parsed;
      }
    }

    return null;
  }

  const record = asRecord(candidate);
  if (!record) {
    return null;
  }

  for (const key of [
    "amount",
    "value",
    "payoutAmount",
    "principal",
    "total",
    "result",
  ]) {
    if (key in record) {
      const parsed = extractBigIntValue(record[key], depth + 1);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  for (const value of Object.values(record)) {
    const parsed = extractBigIntValue(value, depth + 1);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

export function extractBooleanValue(payload: unknown): boolean | null {
  const candidate = extractResultValue(payload);

  if (typeof candidate === "boolean") {
    return candidate;
  }

  if (typeof candidate === "number") {
    return candidate !== 0;
  }

  if (typeof candidate === "string") {
    const normalized = candidate.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return null;
}

export function extractTxHash(payload: unknown, depth = 0): string | null {
  if (depth > 5) {
    return null;
  }

  if (typeof payload === "string") {
    if (TX_HASH_REGEX.test(payload)) {
      return payload;
    }

    const match = payload.match(/0x[a-fA-F0-9]{64}/);
    return match ? match[0] : null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractTxHash(item, depth + 1);
      if (found) {
        return found;
      }
    }

    return null;
  }

  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  for (const key of ["tx", "txHash", "transactionHash", "hash", "result", "data"]) {
    if (key in record) {
      const found = extractTxHash(record[key], depth + 1);
      if (found) {
        return found;
      }
    }
  }

  for (const value of Object.values(record)) {
    const found = extractTxHash(value, depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}
