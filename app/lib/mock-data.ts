import type {
  AdminSnapshot,
  Investment,
  MockScenario,
  ProtocolParameters,
  VaultHealth,
} from "@/app/lib/types";
import { getProjectedPayout } from "@/app/lib/format";

const protocolParameters: ProtocolParameters = {
  lockWeeks: 12,
  entryFeeRate: 0.0125,
  projectedReturnRate: 0.09,
  minimumInvestment: 100,
};

const investments: Investment[] = [
  {
    id: "INV-2401",
    principal: 1200,
    entryFeeRate: protocolParameters.entryFeeRate,
    projectedReturnRate: protocolParameters.projectedReturnRate,
    startedAt: "2025-12-10T10:00:00.000Z",
    maturesAt: "2026-03-04T10:00:00.000Z",
    txHash: "0xa6d2f44f7b91e4d8",
  },
  {
    id: "INV-2402",
    principal: 950,
    entryFeeRate: protocolParameters.entryFeeRate,
    projectedReturnRate: protocolParameters.projectedReturnRate,
    startedAt: "2026-01-07T10:00:00.000Z",
    maturesAt: "2026-04-01T10:00:00.000Z",
    txHash: "0x22ba8e4f11d7d0b2",
  },
  {
    id: "INV-2403",
    principal: 2100,
    entryFeeRate: protocolParameters.entryFeeRate,
    projectedReturnRate: protocolParameters.projectedReturnRate,
    startedAt: "2025-11-12T10:00:00.000Z",
    maturesAt: "2026-02-04T10:00:00.000Z",
    txHash: "0x991c1a91ce447f51",
  },
  {
    id: "INV-2331",
    principal: 640,
    entryFeeRate: protocolParameters.entryFeeRate,
    projectedReturnRate: protocolParameters.projectedReturnRate,
    startedAt: "2025-09-15T10:00:00.000Z",
    maturesAt: "2025-12-08T10:00:00.000Z",
    withdrawnAt: "2026-01-06T10:00:00.000Z",
    txHash: "0x44ab6382e93f3f8c",
  },
];

const totalProjectedPayout = investments
  .filter((investment) => !investment.withdrawnAt)
  .reduce(
    (sum, investment) =>
      sum +
      getProjectedPayout(
        investment.principal,
        investment.entryFeeRate,
        investment.projectedReturnRate,
      ),
    0,
  );

const vault: VaultHealth = {
  totalInvested: investments
    .filter((investment) => !investment.withdrawnAt)
    .reduce((sum, investment) => sum + investment.principal, 0),
  projectedPayout: totalProjectedPayout,
  availableToWithdraw: 1854.58,
  outstandingPayoutObligations: totalProjectedPayout,
  vaultBalance: 5800,
  shortfall: 430,
  status: "shortfall",
  nextMaturityAt: "2026-04-01T10:00:00.000Z",
};

const admin: AdminSnapshot = {
  fundingWalletBalance: 14200,
  protocolParameters,
  transfers: [
    {
      id: "TR-101",
      from: "Ops Reserve",
      to: "Vault Contract",
      amount: 2500,
      date: "2026-03-14T12:10:00.000Z",
      status: "completed",
    },
    {
      id: "TR-102",
      from: "Yield Buffer",
      to: "Vault Contract",
      amount: 430,
      date: "2026-03-30T08:02:00.000Z",
      status: "pending",
    },
  ],
  activity: [
    {
      id: "AA-1",
      type: "vault_funding_pending",
      title: "Vault funding pending",
      description: "Shortfall detected for matured payout batch.",
      amount: 430,
      date: "2026-03-30T08:05:00.000Z",
      status: "pending",
      txHash: "0x0ff9af2b34c48d1d",
    },
    {
      id: "AA-2",
      type: "transfer",
      title: "Treasury transfer prepared",
      description: "Funding transfer staged from Yield Buffer.",
      amount: 430,
      date: "2026-03-30T08:03:00.000Z",
      status: "completed",
      txHash: "0xacc6114f5aa0dde2",
    },
  ],
};

export const scenario: MockScenario = {
  nowIso: "2026-03-30T10:00:00.000Z",
  profile: {
    id: "USR-889",
    fullName: "Avery Morgan",
    walletAddress: "0x7A0F6E3E2Db7D5b8147CC1f93AA04017C8D2D7B1",
    stablecoinSymbol: "USDC",
    stablecoinBalance: 1250,
    riskNoticeAccepted: true,
  },
  vault,
  investments,
  userActivity: [
    {
      id: "UA-1",
      type: "investment_created",
      title: "Investment created",
      description: "INV-2403 locked for 12 weeks.",
      amount: 2100,
      date: "2025-11-12T10:01:00.000Z",
      status: "completed",
      txHash: "0x991c1a91ce447f51",
    },
    {
      id: "UA-2",
      type: "approval",
      title: "Token approval completed",
      description: "USDC spending approval confirmed.",
      date: "2025-11-12T09:58:00.000Z",
      status: "completed",
      txHash: "0x4ee7f2f9454f89f0",
    },
    {
      id: "UA-3",
      type: "vault_funding_pending",
      title: "Vault funding pending",
      description:
        "Your matured investment is waiting for funding before withdrawal.",
      date: "2026-03-30T08:05:00.000Z",
      status: "pending",
    },
    {
      id: "UA-4",
      type: "withdrawal_completed",
      title: "Withdrawal completed",
      description: "Returns were sent to your wallet.",
      amount: 688.18,
      date: "2026-01-06T10:03:00.000Z",
      status: "completed",
      txHash: "0x7be44f028acafc66",
    },
  ],
  admin,
};
