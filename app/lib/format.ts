import type { Investment, InvestmentStatus, VaultHealth } from "@/app/lib/types";

export function formatMoney(value: number, symbol = "USDC") {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${symbol}`;
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function daysUntil(iso: string, nowIso: string) {
  const diffMs = new Date(iso).getTime() - new Date(nowIso).getTime();
  const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return days;
}

export function getNetInvestment(principal: number, entryFeeRate: number) {
  return principal * (1 - entryFeeRate);
}

export function getProjectedPayout(
  principal: number,
  entryFeeRate: number,
  projectedReturnRate: number,
) {
  const net = getNetInvestment(principal, entryFeeRate);
  return net * (1 + projectedReturnRate);
}

export function getInvestmentStatus(
  investment: Investment,
  nowIso: string,
  vault: VaultHealth,
): InvestmentStatus {
  if (investment.withdrawnAt) {
    return "withdrawn";
  }

  const now = new Date(nowIso).getTime();
  const maturesAt = new Date(investment.maturesAt).getTime();

  if (maturesAt > now) {
    return "locked";
  }

  if (vault.availableToWithdraw > 0 && vault.status === "healthy") {
    return "ready";
  }

  return "awaiting_funding";
}
