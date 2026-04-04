export function toUnits(amount: string, decimals: number): string {
  const trimmed = amount.trim();
  if (!trimmed) {
    throw new Error("Amount is required.");
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Amount must be a valid positive number.");
  }

  const [wholePart, fractionalPart = ""] = trimmed.split(".");
  const paddedFractional = `${fractionalPart}${"0".repeat(decimals)}`.slice(0, decimals);

  const base = BigInt(10) ** BigInt(decimals);
  const whole = BigInt(wholePart || "0") * base;
  const fraction = BigInt(paddedFractional || "0");

  return (whole + fraction).toString();
}

export function formatUnits(
  value: string | number | bigint,
  decimals: number,
  precision = 2,
): string {
  const asBigInt = typeof value === "bigint" ? value : BigInt(String(value));
  const sign = asBigInt < BigInt(0) ? "-" : "";
  const absolute = asBigInt < BigInt(0) ? -asBigInt : asBigInt;

  const base = BigInt(10) ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = absolute % base;

  if (precision <= 0) {
    return `${sign}${whole.toString()}`;
  }

  const normalizedFraction = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, precision)
    .replace(/0+$/, "");

  if (!normalizedFraction) {
    return `${sign}${whole.toString()}`;
  }

  return `${sign}${whole.toString()}.${normalizedFraction}`;
}
