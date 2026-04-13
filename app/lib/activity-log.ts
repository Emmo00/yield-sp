export const ACTIVITY_LOG_ACTIONS = [
  "buyInSubmitted",
  "claimPayoutSubmitted",
  "buyInFailed",
  "claimPayoutFailed",
] as const;

export type ActivityLogAction = (typeof ACTIVITY_LOG_ACTIONS)[number];

export const ACTIVITY_LOG_STATUSES = ["completed", "failed"] as const;

export type ActivityLogStatus = (typeof ACTIVITY_LOG_STATUSES)[number];

export interface ActivityLogWriteInput {
  userAddress: string;
  action: ActivityLogAction;
  status: ActivityLogStatus;
  detail: string;
  txHash?: string;
  amountUnits?: string;
  symbol?: string;
  decimals?: number;
  clientTimestamp?: string;
}

export interface ActivityLogRecord extends ActivityLogWriteInput {
  id: string;
  createdAt: string;
}

export function isActivityLogAction(value: string): value is ActivityLogAction {
  return (ACTIVITY_LOG_ACTIONS as readonly string[]).includes(value);
}

export function isActivityLogStatus(value: string): value is ActivityLogStatus {
  return (ACTIVITY_LOG_STATUSES as readonly string[]).includes(value);
}

export function activityActionToTitle(action: ActivityLogAction): string {
  switch (action) {
    case "buyInSubmitted":
      return "Buy-in submitted";
    case "claimPayoutSubmitted":
      return "Payout claimed";
    case "buyInFailed":
      return "Buy-in";
    case "claimPayoutFailed":
      return "claimPayout";
    default:
      return "Activity";
  }
}
