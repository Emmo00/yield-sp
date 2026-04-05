"use client";

import { Activity, CircleDollarSign, Landmark, RefreshCcw, Settings2, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, Button, Card, Field, MetricCard, Modal, Segmented } from "@/app/components/vault-ui";
import {
  getConfiguredNetwork,
  getContractAddress,
  type NetworkEnv,
} from "@/app/lib/constants";
import { formatDate } from "@/app/lib/format";
import { queryToronetContractApi, writeToronetContractApi } from "@/app/lib/toronet-client";
import { extractBigIntValue, extractTxHash } from "@/app/lib/toronet-common";
import { getStoredSession, type ToronetSession } from "@/app/lib/session";
import { formatBpsAsPercent, formatUnits, percentToBps, toUnits } from "@/app/lib/units";

type AdminTab = "overview" | "funding" | "parameters" | "activity";
type AdminActionKey = "depositYield" | "setBuyInFeePercentage" | "setYieldPercentage" | "setLockPeriod";

interface AdminSnapshot {
  decimals: number;
  symbol: string;
  shortfall: bigint;
  totalLiability: bigint;
  vaultBalance: bigint;
  lockPeriodSeconds: bigint;
  buyInFeeBps: bigint;
  yieldBps: bigint;
}

interface AdminActivity {
  id: string;
  title: string;
  detail: string;
  when: string;
  status: "completed" | "failed";
  txHash?: string;
}

const INITIAL_SNAPSHOT: AdminSnapshot = {
  decimals: 18,
  symbol: "ESPEES",
  shortfall: BigInt(0),
  totalLiability: BigInt(0),
  vaultBalance: BigInt(0),
  lockPeriodSeconds: BigInt(0),
  buyInFeeBps: BigInt(0),
  yieldBps: BigInt(0),
};

export default function AdminPage() {
  const network = useMemo<NetworkEnv>(() => getConfiguredNetwork(), []);
  const vaultAddress = useMemo(() => getContractAddress("loan-vault", network), [network]);

  const [session, setSession] = useState<ToronetSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [tab, setTab] = useState<AdminTab>("overview");
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(INITIAL_SNAPSHOT);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [feePercentInput, setFeePercentInput] = useState("1.25");
  const [yieldPercentInput, setYieldPercentInput] = useState("9");
  const [lockPeriodInput, setLockPeriodInput] = useState("");
  const [useCustomDepositAmount, setUseCustomDepositAmount] = useState(false);
  const [customDepositAmountInput, setCustomDepositAmountInput] = useState("");
  const [confirmAction, setConfirmAction] = useState<AdminActionKey | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const [activity, setActivity] = useState<AdminActivity[]>([]);

  const addActivity = useCallback((title: string, detail: string, status: "completed" | "failed", response?: unknown) => {
    setActivity((previous) => [
      {
        id: `AA-${Date.now()}`,
        title,
        detail,
        status,
        when: new Date().toISOString(),
        txHash: extractTxHash(response) ?? undefined,
      },
      ...previous,
    ]);
  }, []);

  const formatToken = useCallback(
    (value: bigint, precision = 2) => `${formatUnits(value, snapshot.decimals, precision)} ${snapshot.symbol}`,
    [snapshot.decimals, snapshot.symbol],
  );

  const formatLockPeriod = useCallback((seconds: bigint) => {
    const days = Number(seconds) / 86400;
    if (!Number.isFinite(days)) {
      return `${seconds.toString()} sec`;
    }

    if (days >= 1) {
      return `${Number.isInteger(days) ? days.toFixed(0) : days.toFixed(2)} days`;
    }

    return `${seconds.toString()} sec`;
  }, []);

  const validatePercentToBps = useCallback((inputValue: string, label: string) => {
    const normalized = inputValue.trim();
    if (!normalized) {
      setError(`${label} is required.`);
      return null;
    }

    try {
      const bpsValue = percentToBps(normalized);
      if (BigInt(bpsValue) > BigInt(10000)) {
        setError(`${label} cannot exceed 100%.`);
        return null;
      }

      return bpsValue;
    } catch {
      setError(`${label} must be a valid percentage with up to 2 decimal places.`);
      return null;
    }
  }, []);

  const depositAmountPreview = useMemo(() => {
    if (!useCustomDepositAmount) {
      return {
        valid: true,
        units: snapshot.shortfall,
        display: formatToken(snapshot.shortfall),
        error: "",
      };
    }

    const normalized = customDepositAmountInput.trim();
    if (!normalized) {
      return {
        valid: false,
        units: BigInt(0),
        display: "",
        error: "Enter a custom amount.",
      };
    }

    try {
      const units = BigInt(toUnits(normalized, snapshot.decimals));
      if (units < BigInt(0)) {
        return {
          valid: false,
          units: BigInt(0),
          display: "",
          error: "Amount cannot be negative.",
        };
      }

      return {
        valid: true,
        units,
        display: `${normalized} ${snapshot.symbol}`,
        error: "",
      };
    } catch {
      return {
        valid: false,
        units: BigInt(0),
        display: "",
        error: "Enter a valid positive amount.",
      };
    }
  }, [customDepositAmountInput, formatToken, snapshot.decimals, snapshot.shortfall, snapshot.symbol, useCustomDepositAmount]);

  const refreshSnapshot = useCallback(
    async (activeSession: ToronetSession) => {
      setLoadingSnapshot(true);
      setError("");

      try {
        const [decimalsRaw, symbolRaw, shortfallRaw, liabilityRaw, vaultBalanceRaw, lockPeriodRaw, feeRaw, yieldRaw] =
          await Promise.all([
            queryToronetContractApi({
              address: activeSession.address,
              password: activeSession.password,
              contract: "stablecoin",
              functionName: "decimals",
            }),
            queryToronetContractApi({
              address: activeSession.address,
              password: activeSession.password,
              contract: "stablecoin",
              functionName: "symbol",
            }),
            queryToronetContractApi({
              address: activeSession.address,
              password: activeSession.password,
              contract: "loan-vault",
              functionName: "nextYieldDepositAmount",
            }),
            queryToronetContractApi({
              address: activeSession.address,
              password: activeSession.password,
              contract: "loan-vault",
              functionName: "totalLiability",
            }),
            queryToronetContractApi({
              address: activeSession.address,
              password: activeSession.password,
              contract: "stablecoin",
              functionName: "balanceOf",
              args: [vaultAddress],
            }),
            queryToronetContractApi({
              address: activeSession.address,
              password: activeSession.password,
              contract: "loan-vault",
              functionName: "LOCK_PERIOD",
            }),
            queryToronetContractApi({
              address: activeSession.address,
              password: activeSession.password,
              contract: "loan-vault",
              functionName: "buyInFeePercentage",
            }),
            queryToronetContractApi({
              address: activeSession.address,
              password: activeSession.password,
              contract: "loan-vault",
              functionName: "yieldPercentage",
            }),
          ]);

        const decimalsParsed = extractBigIntValue(decimalsRaw);
        const decimals =
          decimalsParsed !== null &&
          decimalsParsed >= BigInt(0) &&
          decimalsParsed <= BigInt(36)
            ? Number(decimalsParsed)
            : 18;

        const symbol =
          typeof symbolRaw === "string"
            ? symbolRaw
            : typeof (symbolRaw as { result?: unknown })?.result === "string"
              ? String((symbolRaw as { result: unknown }).result)
              : "ESPEES";

        setSnapshot({
          decimals,
          symbol,
          shortfall: extractBigIntValue(shortfallRaw) ?? BigInt(0),
          totalLiability: extractBigIntValue(liabilityRaw) ?? BigInt(0),
          vaultBalance: extractBigIntValue(vaultBalanceRaw) ?? BigInt(0),
          lockPeriodSeconds: extractBigIntValue(lockPeriodRaw) ?? BigInt(0),
          buyInFeeBps: extractBigIntValue(feeRaw) ?? BigInt(0),
          yieldBps: extractBigIntValue(yieldRaw) ?? BigInt(0),
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to refresh admin snapshot.");
      } finally {
        setLoadingSnapshot(false);
      }
    },
    [vaultAddress],
  );

  useEffect(() => {
    const existingSession = getStoredSession();
    setSession(existingSession);
    setLoadingSession(false);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void refreshSnapshot(session);
  }, [session, refreshSnapshot]);

  useEffect(() => {
    if (!lockPeriodInput && snapshot.lockPeriodSeconds > BigInt(0)) {
      setLockPeriodInput(snapshot.lockPeriodSeconds.toString());
    }
  }, [lockPeriodInput, snapshot.lockPeriodSeconds]);

  async function runAction(label: string, operation: () => Promise<unknown>): Promise<boolean> {
    if (!session) {
      return false;
    }

    setActionLoading(label);
    setError("");

    try {
      const response = await operation();
      addActivity(label, `${label} submitted successfully.`, "completed", response);
      await refreshSnapshot(session);
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Action failed.";
      setError(message);
      addActivity(label, message, "failed");
      return false;
    } finally {
      setActionLoading(null);
    }
  }

  async function depositYield(): Promise<boolean> {
    if (!session) {
      return false;
    }

    if (!depositAmountPreview.valid) {
      setError(depositAmountPreview.error || "Invalid deposit amount.");
      return false;
    }

    const amountArg = depositAmountPreview.units.toString();

    return runAction("depositYield", () =>
      writeToronetContractApi({
        address: session.address,
        password: session.password,
        contract: "loan-vault",
        functionName: "depositYield",
        args: [amountArg],
      }),
    );
  }

  async function setBuyInFee(): Promise<boolean> {
    if (!session) {
      return false;
    }

    const bpsValue = validatePercentToBps(feePercentInput, "Entry fee");
    if (!bpsValue) {
      return false;
    }

    return runAction("setBuyInFeePercentage", () =>
      writeToronetContractApi({
        address: session.address,
        password: session.password,
        contract: "loan-vault",
        functionName: "setBuyInFeePercentage",
        args: [bpsValue],
      }),
    );
  }

  async function setYield(): Promise<boolean> {
    if (!session) {
      return false;
    }

    const bpsValue = validatePercentToBps(yieldPercentInput, "Yield percentage");
    if (!bpsValue) {
      return false;
    }

    return runAction("setYieldPercentage", () =>
      writeToronetContractApi({
        address: session.address,
        password: session.password,
        contract: "loan-vault",
        functionName: "setYieldPercentage",
        args: [bpsValue],
      }),
    );
  }

  async function setLockPeriod(): Promise<boolean> {
    if (!session) {
      return false;
    }

    const normalized = lockPeriodInput.trim();
    if (!/^\d+$/.test(normalized)) {
      setError("LOCK_PERIOD must be an integer number of seconds.");
      return false;
    }

    return runAction("setLockPeriod", () =>
      writeToronetContractApi({
        address: session.address,
        password: session.password,
        contract: "loan-vault",
        functionName: "setLockPeriod",
        args: [normalized],
      }),
    );
  }

  function requestActionConfirmation(action: AdminActionKey) {
    setError("");

    if (action === "depositYield" && !depositAmountPreview.valid) {
      setError(depositAmountPreview.error || "Invalid deposit amount.");
      return;
    }

    if (action === "setBuyInFeePercentage" && !validatePercentToBps(feePercentInput, "Entry fee")) {
      return;
    }

    if (action === "setYieldPercentage" && !validatePercentToBps(yieldPercentInput, "Yield percentage")) {
      return;
    }

    if (action === "setLockPeriod" && !/^\d+$/.test(lockPeriodInput.trim())) {
      setError("LOCK_PERIOD must be an integer number of seconds.");
      return;
    }

    setConfirmAction(action);
  }

  function closeConfirmationModal() {
    if (confirmSubmitting || actionLoading !== null) {
      return;
    }

    setConfirmAction(null);
  }

  const confirmContent = useMemo(() => {
    if (!confirmAction) {
      return null;
    }

    if (confirmAction === "depositYield") {
      return {
        title: "Confirm depositYield",
        subtitle: "Review funding amount before submitting transaction.",
        confirmLabel: "Confirm Deposit",
        items: [
          { label: "Mode", value: useCustomDepositAmount ? "Custom amount" : "Default shortfall" },
          { label: "Amount", value: depositAmountPreview.display || "-" },
          { label: "Shortfall", value: formatToken(snapshot.shortfall) },
        ],
      };
    }

    if (confirmAction === "setBuyInFeePercentage") {
      return {
        title: "Confirm setBuyInFeePercentage",
        subtitle: "This updates the protocol entry fee for future buy-ins.",
        confirmLabel: "Confirm Fee Update",
        items: [
          { label: "Current", value: formatBpsAsPercent(snapshot.buyInFeeBps) },
          { label: "New", value: `${feePercentInput.trim()}%` },
        ],
      };
    }

    if (confirmAction === "setYieldPercentage") {
      return {
        title: "Confirm setYieldPercentage",
        subtitle: "This updates projected payout yield for future buy-ins.",
        confirmLabel: "Confirm Yield Update",
        items: [
          { label: "Current", value: formatBpsAsPercent(snapshot.yieldBps) },
          { label: "New", value: `${yieldPercentInput.trim()}%` },
        ],
      };
    }

    return {
      title: "Confirm setLockPeriod",
      subtitle: "This changes how long positions remain locked before claim.",
      confirmLabel: "Confirm Lock Period",
      items: [
        { label: "Current", value: `${formatLockPeriod(snapshot.lockPeriodSeconds)} (${snapshot.lockPeriodSeconds.toString()} sec)` },
        { label: "New", value: `${formatLockPeriod(BigInt(lockPeriodInput.trim()))} (${lockPeriodInput.trim()} sec)` },
      ],
    };
  }, [confirmAction, depositAmountPreview.display, feePercentInput, formatLockPeriod, formatToken, lockPeriodInput, snapshot.buyInFeeBps, snapshot.lockPeriodSeconds, snapshot.shortfall, snapshot.yieldBps, useCustomDepositAmount, yieldPercentInput]);

  async function executeConfirmedAction() {
    if (!confirmAction || confirmSubmitting) {
      return;
    }

    setConfirmSubmitting(true);

    let success = false;

    if (confirmAction === "depositYield") {
      success = await depositYield();
    } else if (confirmAction === "setBuyInFeePercentage") {
      success = await setBuyInFee();
    } else if (confirmAction === "setYieldPercentage") {
      success = await setYield();
    } else {
      success = await setLockPeriod();
    }

    setConfirmSubmitting(false);

    if (success) {
      setConfirmAction(null);
    }
  }

  if (loadingSession) {
    return (
      <main className="vault-shell flex min-h-screen items-center justify-center px-5 py-12">
        <section className="vault-card w-full max-w-xl p-8 md:p-10">
          <p className="text-sm text-[var(--color-text-secondary)]">Loading admin session...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="vault-shell flex min-h-screen items-center justify-center px-5 py-12">
        <section className="vault-card w-full max-w-xl p-8 md:p-10">
          <h1 className="text-2xl font-bold">Admin session required</h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Login from the main dashboard first, then return here to call admin methods.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-12 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-sm font-semibold text-[var(--color-text-primary)]"
          >
            Go to Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="vault-shell min-h-screen pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-4 md:px-8 md:py-6">
        <header className="vault-card sticky top-3 z-30 mb-5 flex flex-wrap items-center justify-between gap-3 bg-white/90 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              BizMarket Vault
            </p>
            <h1 className="text-2xl font-bold tracking-tight">Admin Console</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{network}</Badge>
            <Link
              href="/"
              className="inline-flex h-12 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-sm font-semibold text-[var(--color-text-primary)]"
            >
              Dashboard
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                void refreshSnapshot(session);
              }}
              disabled={loadingSnapshot}
            >
              <RefreshCcw size={16} />
            </Button>
          </div>
        </header>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "funding", label: "Funding" },
            { value: "parameters", label: "Parameters" },
            { value: "activity", label: "Activity" },
          ]}
        />

        {error ? (
          <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2 text-sm text-[var(--color-error-700)]">
            {error}
          </p>
        ) : null}

        <div className="mt-4 grid gap-4">
          {tab === "overview" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <MetricCard label="Shortfall" value={formatToken(snapshot.shortfall)} />
                <MetricCard label="Vault Balance" value={formatToken(snapshot.vaultBalance)} />
                <MetricCard label="Total Liability" value={formatToken(snapshot.totalLiability)} />
                <MetricCard
                  label="LOCK_PERIOD"
                  value={formatLockPeriod(snapshot.lockPeriodSeconds)}
                  note={`${snapshot.lockPeriodSeconds.toString()} sec`}
                />
                <MetricCard
                  label="Funding Status"
                  value={
                    snapshot.shortfall > BigInt(0) ? "Needs Funding" : "Healthy"
                  }
                  tone={
                    snapshot.shortfall > BigInt(0) ? "warning" : "success"
                  }
                />
              </div>

              <Card title="Vault Funding" subtitle="Default submits current shortfall. Enable custom amount to override.">
                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Current shortfall: {formatToken(snapshot.shortfall)}
                  </p>

                  <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={useCustomDepositAmount}
                      onChange={(event) => setUseCustomDepositAmount(event.target.checked)}
                    />
                    Edit amount to deposit
                  </label>

                  {useCustomDepositAmount ? (
                    <Field label={`Custom deposit amount (${snapshot.symbol})`} hint="Enter a token amount, not base units.">
                      <input
                        value={customDepositAmountInput}
                        onChange={(event) => setCustomDepositAmountInput(event.target.value)}
                        className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                        inputMode="decimal"
                        placeholder="1000"
                      />
                    </Field>
                  ) : null}

                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Amount to submit: <strong>{depositAmountPreview.display || "-"}</strong>
                  </p>
                  {depositAmountPreview.error ? (
                    <p className="text-xs text-[var(--color-error-700)]">{depositAmountPreview.error}</p>
                  ) : null}

                  <Button
                    disabled={
                      actionLoading !== null ||
                      (!useCustomDepositAmount && snapshot.shortfall <= BigInt(0)) ||
                      (useCustomDepositAmount && !depositAmountPreview.valid)
                    }
                    onClick={() => {
                      requestActionConfirmation("depositYield");
                    }}
                  >
                    <Wallet size={16} />
                    {actionLoading === "depositYield" ? "Submitting..." : "Deposit Yield"}
                  </Button>
                </div>
              </Card>
            </>
          ) : null}

          {tab === "funding" ? (
            <Card title="Funding Details" subtitle="Live values from nextYieldDepositAmount and vault balance.">
              <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                <p>
                  <strong>LoanVault address:</strong> {vaultAddress}
                </p>
                <p>
                  <strong>Shortfall:</strong> {formatToken(snapshot.shortfall)}
                </p>
                <p>
                  <strong>Vault balance:</strong> {formatToken(snapshot.vaultBalance)}
                </p>
                <p>
                  <strong>Total liability:</strong> {formatToken(snapshot.totalLiability)}
                </p>
                <p>
                  <strong>LOCK_PERIOD:</strong> {formatLockPeriod(snapshot.lockPeriodSeconds)} ({snapshot.lockPeriodSeconds.toString()} sec)
                </p>
              </div>
            </Card>
          ) : null}

          {tab === "parameters" ? (
            <Card title="Protocol Parameters" subtitle="Update fee, yield, and lock period.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Current buyInFeePercentage: {formatBpsAsPercent(snapshot.buyInFeeBps)}
                  </p>
                  <Field label="New buyInFeePercentage (%)" hint="Up to 2 decimal places.">
                    <input
                      value={feePercentInput}
                      onChange={(event) => setFeePercentInput(event.target.value)}
                      className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                      inputMode="decimal"
                      placeholder="1.25"
                    />
                  </Field>
                  <Button
                    disabled={actionLoading !== null}
                    onClick={() => {
                      requestActionConfirmation("setBuyInFeePercentage");
                    }}
                  >
                    <CircleDollarSign size={16} />
                    {actionLoading === "setBuyInFeePercentage"
                      ? "Submitting..."
                      : "setBuyInFeePercentage"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Current yieldPercentage: {formatBpsAsPercent(snapshot.yieldBps)}
                  </p>
                  <Field label="New yieldPercentage (%)" hint="Up to 2 decimal places.">
                    <input
                      value={yieldPercentInput}
                      onChange={(event) => setYieldPercentInput(event.target.value)}
                      className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                      inputMode="decimal"
                      placeholder="9"
                    />
                  </Field>
                  <Button
                    disabled={actionLoading !== null}
                    onClick={() => {
                      requestActionConfirmation("setYieldPercentage");
                    }}
                  >
                    <Settings2 size={16} />
                    {actionLoading === "setYieldPercentage" ? "Submitting..." : "setYieldPercentage"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Current LOCK_PERIOD: {formatLockPeriod(snapshot.lockPeriodSeconds)}
                  </p>
                  <Field label="New LOCK_PERIOD (seconds)" hint="Example: 7776000 = 90 days">
                    <input
                      value={lockPeriodInput}
                      onChange={(event) => setLockPeriodInput(event.target.value)}
                      className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                      inputMode="numeric"
                    />
                  </Field>
                  <Button
                    disabled={actionLoading !== null}
                    onClick={() => {
                      requestActionConfirmation("setLockPeriod");
                    }}
                  >
                    <Settings2 size={16} />
                    {actionLoading === "setLockPeriod" ? "Submitting..." : "setLockPeriod"}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          {tab === "activity" ? (
            <Card title="Admin Activity" subtitle="Recent admin transactions from this browser session.">
              <div className="space-y-3">
                {activity.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    No admin actions yet.
                  </p>
                ) : (
                  activity.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                        <Badge tone={item.status === "completed" ? "success" : "warning"}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.detail}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                        {formatDate(item.when)}
                      </p>
                      {item.txHash ? (
                        <p className="mt-1 break-all text-xs text-[var(--color-text-tertiary)]">
                          Tx: {item.txHash}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </Card>
          ) : null}
        </div>

        <Modal
          isOpen={Boolean(confirmAction && confirmContent)}
          title={confirmContent?.title ?? "Confirm action"}
          subtitle={confirmContent?.subtitle ?? "Review details before sending transaction."}
          onClose={closeConfirmationModal}
          footer={
            <>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={closeConfirmationModal}
                disabled={confirmSubmitting || actionLoading !== null}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  void executeConfirmedAction();
                }}
                disabled={confirmSubmitting || actionLoading !== null}
              >
                {confirmSubmitting || actionLoading !== null
                  ? "Submitting..."
                  : confirmContent?.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          {confirmContent ? (
            <div className="space-y-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3">
                {confirmContent.items.map((item) => (
                  <p key={item.label} className="mt-1 text-sm text-[var(--color-text-secondary)] first:mt-0">
                    <strong className="text-[var(--color-text-primary)]">{item.label}:</strong> {item.value}
                  </p>
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                This action cannot be undone. Confirm to submit transaction.
              </p>
            </div>
          ) : null}
        </Modal>

        <nav className="fixed bottom-3 left-3 right-3 z-30 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white/95 p-2 shadow-[0_14px_28px_rgb(15_23_40_/_12%)] backdrop-blur lg:hidden">
          <ul className="grid grid-cols-4 gap-1">
            {[
              { value: "overview", label: "Overview", icon: <Landmark size={16} /> },
              { value: "funding", label: "Funding", icon: <Wallet size={16} /> },
              { value: "parameters", label: "Parameters", icon: <CircleDollarSign size={16} /> },
              { value: "activity", label: "Activity", icon: <Activity size={16} /> },
            ].map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => setTab(option.value as AdminTab)}
                  className={`flex w-full flex-col items-center gap-1 rounded-[12px] px-1 py-2 text-[11px] font-semibold ${
                    tab === option.value
                      ? "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
