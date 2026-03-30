export type Role = "user" | "admin";

export type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export type InvestmentStatus =
  | "locked"
  | "matured"
  | "ready"
  | "awaiting_funding"
  | "withdrawn";

export interface UserProfile {
  id: string;
  fullName: string;
  walletAddress: string;
  stablecoinSymbol: "USDC";
  stablecoinBalance: number;
  riskNoticeAccepted: boolean;
}

export interface VaultHealth {
  totalInvested: number;
  projectedPayout: number;
  availableToWithdraw: number;
  outstandingPayoutObligations: number;
  vaultBalance: number;
  shortfall: number;
  status: "healthy" | "shortfall";
  nextMaturityAt: string;
}

export interface Investment {
  id: string;
  principal: number;
  entryFeeRate: number;
  projectedReturnRate: number;
  startedAt: string;
  maturesAt: string;
  withdrawnAt?: string;
  txHash: string;
}

export interface ActivityItem {
  id: string;
  type:
    | "approval"
    | "investment_created"
    | "withdrawal_completed"
    | "vault_funding_pending"
    | "vault_funded"
    | "transfer";
  title: string;
  description: string;
  amount?: number;
  date: string;
  txHash?: string;
  status: "completed" | "pending" | "failed";
}

export interface ProtocolParameters {
  lockWeeks: number;
  entryFeeRate: number;
  projectedReturnRate: number;
  minimumInvestment: number;
}

export interface AdminTransfer {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  status: "completed" | "pending";
}

export interface AdminSnapshot {
  fundingWalletBalance: number;
  protocolParameters: ProtocolParameters;
  transfers: AdminTransfer[];
  activity: ActivityItem[];
}

export interface MockScenario {
  nowIso: string;
  profile: UserProfile;
  vault: VaultHealth;
  investments: Investment[];
  userActivity: ActivityItem[];
  admin: AdminSnapshot;
}
