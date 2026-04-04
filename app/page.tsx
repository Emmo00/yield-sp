"use client";

import {
  Activity,
  ArrowRight,
  Check,
  CircleCheckBig,
  Copy,
  Coins,
  HandCoins,
  Landmark,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  UserCircle2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, Button, Card, Field, MetricCard, Modal, Segmented } from "@/app/components/vault-ui";
import {
  getConfiguredNetwork,
  getContractAddress,
  type NetworkEnv,
} from "@/app/lib/constants";
import { formatDate, shortAddress } from "@/app/lib/format";
import {
  getToronetUsernameByAddress,
  loginWithToronet,
  queryToronetContractApi,
  signupWithToronet,
  writeToronetContractApi,
} from "@/app/lib/toronet-client";
import {
  extractBigIntValue,
  isHexAddress,
  extractResultValue,
  extractTxHash,
} from "@/app/lib/toronet-common";
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
  type ToronetSession,
} from "@/app/lib/session";
import { formatUnits, toUnits } from "@/app/lib/units";

type AuthMode = "login" | "signup";
type UserTab = "home" | "positions" | "activity" | "profile";
type ActivityStatus = "completed" | "pending" | "failed";
type BuyInFlowStep = "amount" | "review" | "processing" | "success";
type BuyInProgress = "idle" | "approving" | "buying";

interface PositionRecord {
  id: string;
  principal: bigint;
  payoutAmount: bigint;
  startTime: bigint;
  maturityTime: bigint;
  status: "locked" | "ready";
}

interface ActivityRecord {
  id: string;
  title: string;
  detail: string;
  when: string;
  status: ActivityStatus;
  txHash?: string;
}

interface PortfolioState {
  decimals: number;
  symbol: string;
  stablecoinBalance: bigint;
  availablePayout: bigint;
  totalInvested: bigint;
  projectedPayout: bigint;
  lockPeriodSeconds: bigint;
  buyInFeeBps: bigint;
  yieldBps: bigint;
  positions: PositionRecord[];
}

interface BuyInDraft {
  amountInput: string;
  amountUnits: bigint;
  feeAmount: bigint;
  netPrincipal: bigint;
  projectedPayout: bigint;
}

const INITIAL_PORTFOLIO: PortfolioState = {
  decimals: 18,
  symbol: "ESPEES",
  stablecoinBalance: BigInt(0),
  availablePayout: BigInt(0),
  totalInvested: BigInt(0),
  projectedPayout: BigInt(0),
  lockPeriodSeconds: BigInt(0),
  buyInFeeBps: BigInt(0),
  yieldBps: BigInt(0),
  positions: [],
};

function parsePositions(value: unknown, lockPeriodSeconds: bigint): PositionRecord[] {
  const extracted = extractResultValue(value);
  let candidates: unknown[] = [];

  if (Array.isArray(extracted)) {
    candidates = extracted;
  } else if (typeof extracted === "string") {
    try {
      const parsed = JSON.parse(extracted) as unknown;
      if (Array.isArray(parsed)) {
        candidates = parsed;
      }
    } catch {
      candidates = [];
    }
  } else if (extracted && typeof extracted === "object") {
    const objectValues = Object.values(extracted as Record<string, unknown>);
    const arrayValue = objectValues.find((entry) => Array.isArray(entry));
    if (Array.isArray(arrayValue)) {
      candidates = arrayValue;
    }
  }

  const now = BigInt(Math.floor(Date.now() / 1000));

  return candidates
    .map((candidate, index) => {
      if (Array.isArray(candidate)) {
        const principal = extractBigIntValue(candidate[0]) ?? BigInt(0);
        const startTime = extractBigIntValue(candidate[1]) ?? BigInt(0);
        const payoutAmount = extractBigIntValue(candidate[2]) ?? BigInt(0);
        const maturityTime = startTime + lockPeriodSeconds;

        return {
          id: `POS-${index + 1}`,
          principal,
          payoutAmount,
          startTime,
          maturityTime,
          status: maturityTime <= now ? "ready" : "locked",
        } satisfies PositionRecord;
      }

      if (!candidate || typeof candidate !== "object") {
        return null;
      }

      const record = candidate as Record<string, unknown>;
      const principal = extractBigIntValue(record.principal) ?? BigInt(0);
      const startTime = extractBigIntValue(record.startTime) ?? BigInt(0);
      const payoutAmount = extractBigIntValue(record.payoutAmount) ?? BigInt(0);
      const maturityTime = startTime + lockPeriodSeconds;

      return {
        id: `POS-${index + 1}`,
        principal,
        payoutAmount,
        startTime,
        maturityTime,
        status: maturityTime <= now ? "ready" : "locked",
      } satisfies PositionRecord;
    })
    .filter((item): item is PositionRecord => Boolean(item));
}

export default function Home() {
  const network = useMemo<NetworkEnv>(() => getConfiguredNetwork(), []);
  const vaultAddress = useMemo(() => getContractAddress("loan-vault", network), [network]);
  const stablecoinAddress = useMemo(
    () => getContractAddress("stablecoin", network),
    [network],
  );

  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<ToronetSession | null>(null);
  const [displayUsername, setDisplayUsername] = useState<string>("");
  const [copiedAddress, setCopiedAddress] = useState(false);

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState<UserTab>("home");
  const [portfolio, setPortfolio] = useState<PortfolioState>(INITIAL_PORTFOLIO);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const [buyInModalOpen, setBuyInModalOpen] = useState(false);
  const [buyInStep, setBuyInStep] = useState<BuyInFlowStep>("amount");
  const [buyInProgress, setBuyInProgress] = useState<BuyInProgress>("idle");
  const [buyInAmountInput, setBuyInAmountInput] = useState("100");
  const [buyInDraft, setBuyInDraft] = useState<BuyInDraft | null>(null);
  const [buyInFlowError, setBuyInFlowError] = useState("");
  const [buyInApproveTxHash, setBuyInApproveTxHash] = useState("");
  const [buyInTxHash, setBuyInTxHash] = useState("");
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimFlowError, setClaimFlowError] = useState("");
  const [claimTxHash, setClaimTxHash] = useState("");

  const [actionError, setActionError] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const [activity, setActivity] = useState<ActivityRecord[]>([]);

  const addActivity = useCallback(
    (title: string, detail: string, status: ActivityStatus, response?: unknown) => {
      setActivity((previous) => [
        {
          id: `ACT-${Date.now()}`,
          title,
          detail,
          status,
          when: new Date().toISOString(),
          txHash: extractTxHash(response) ?? undefined,
        },
        ...previous,
      ]);
    },
    [],
  );

  const formatToken = useCallback(
    (value: bigint, precision = 2) => `${formatUnits(value, portfolio.decimals, precision)} ${portfolio.symbol}`,
    [portfolio.decimals, portfolio.symbol],
  );

  const refreshPortfolio = useCallback(
    async (activeSession: ToronetSession) => {
      setPortfolioLoading(true);
      setActionError("");

      try {
        const [
          decimalsRaw,
          symbolRaw,
          balanceRaw,
          availableRaw,
          investedRaw,
          projectedRaw,
          lockPeriodRaw,
          buyInFeeRaw,
          yieldRaw,
          positionsRaw,
        ] = await Promise.all([
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
            contract: "stablecoin",
            functionName: "balanceOf",
            args: [activeSession.address],
          }),
          queryToronetContractApi({
            address: activeSession.address,
            password: activeSession.password,
            contract: "loan-vault",
            functionName: "availablePayout",
            args: [activeSession.address],
          }),
          queryToronetContractApi({
            address: activeSession.address,
            password: activeSession.password,
            contract: "loan-vault",
            functionName: "totalInvested",
            args: [activeSession.address],
          }),
          queryToronetContractApi({
            address: activeSession.address,
            password: activeSession.password,
            contract: "loan-vault",
            functionName: "projectedPayout",
            args: [activeSession.address],
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
          queryToronetContractApi({
            address: activeSession.address,
            password: activeSession.password,
            contract: "loan-vault",
            functionName: "getPositions",
            args: [activeSession.address],
          }),
        ]);

        const parsedDecimals = extractBigIntValue(decimalsRaw);
        const decimals =
          parsedDecimals !== null &&
          parsedDecimals >= BigInt(0) &&
          parsedDecimals <= BigInt(36)
            ? Number(parsedDecimals)
            : 18;

        const symbolResult = extractResultValue(symbolRaw);
        const symbol =
          typeof symbolResult === "string" && symbolResult.trim().length > 0
            ? symbolResult.trim()
            : "ESPEES";

        const lockPeriodSeconds = extractBigIntValue(lockPeriodRaw) ?? BigInt(0);

        setPortfolio({
          decimals,
          symbol,
          stablecoinBalance: extractBigIntValue(balanceRaw) ?? BigInt(0),
          availablePayout: extractBigIntValue(availableRaw) ?? BigInt(0),
          totalInvested: extractBigIntValue(investedRaw) ?? BigInt(0),
          projectedPayout: extractBigIntValue(projectedRaw) ?? BigInt(0),
          lockPeriodSeconds,
          buyInFeeBps: extractBigIntValue(buyInFeeRaw) ?? BigInt(0),
          yieldBps: extractBigIntValue(yieldRaw) ?? BigInt(0),
          positions: parsePositions(positionsRaw, lockPeriodSeconds),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to refresh portfolio.";
        setActionError(message);
      } finally {
        setPortfolioLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const existingSession = getStoredSession();
    setSession(existingSession);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void refreshPortfolio(session);
  }, [session, refreshPortfolio]);

  useEffect(() => {
    let cancelled = false;

    async function resolveUsername() {
      if (!session) {
        setDisplayUsername("");
        return;
      }

      const fromSession = session.username?.trim();
      if (fromSession) {
        setDisplayUsername(fromSession);
        return;
      }

      const identifier = session.identifier.trim();
      if (identifier && !isHexAddress(identifier)) {
        setDisplayUsername(identifier);
        return;
      }

      try {
        const found = await getToronetUsernameByAddress(session.address);
        if (!cancelled) {
          setDisplayUsername(found ?? "");
        }
      } catch {
        if (!cancelled) {
          setDisplayUsername("");
        }
      }
    }

    void resolveUsername();

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleLogin() {
    setAuthError("");
    setAuthLoading(true);

    try {
      const response = await loginWithToronet(identifier, password);
      const newSession: ToronetSession = {
        identifier,
        address: response.address,
        password,
        loggedInAt: new Date().toISOString(),
      };

      saveStoredSession(newSession);
      setSession(newSession);
      setPassword("");
      setIdentifier("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignup() {
    setAuthError("");
    setAuthLoading(true);

    try {
      const response = await signupWithToronet(username, password);
      const newSession: ToronetSession = {
        identifier: username,
        username,
        address: response.address,
        password,
        loggedInAt: new Date().toISOString(),
      };

      saveStoredSession(newSession);
      setSession(newSession);
      setPassword("");
      setUsername("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign-up failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    clearStoredSession();
    setSession(null);
    setBuyInModalOpen(false);
    setClaimModalOpen(false);
    setClaimFlowError("");
    setClaimTxHash("");
    setDisplayUsername("");
    setCopiedAddress(false);
    setPortfolio(INITIAL_PORTFOLIO);
    setActivity([]);
    setTab("home");
  }

  async function copyAddressToClipboard() {
    if (!session || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(session.address);
      setCopiedAddress(true);
      window.setTimeout(() => setCopiedAddress(false), 1800);
    } catch {
      setCopiedAddress(false);
    }
  }

  function resetBuyInFlow() {
    setBuyInStep("amount");
    setBuyInProgress("idle");
    setBuyInFlowError("");
    setBuyInDraft(null);
    setBuyInApproveTxHash("");
    setBuyInTxHash("");
  }

  function openBuyInModal() {
    resetBuyInFlow();
    setBuyInAmountInput("100");
    setBuyInModalOpen(true);
  }

  function closeBuyInModal() {
    if (buyInStep === "processing") {
      return;
    }

    setBuyInModalOpen(false);
    resetBuyInFlow();
  }

  function buildBuyInDraft(amountValue: string): BuyInDraft {
    const normalized = amountValue.trim();
    if (!normalized) {
      throw new Error("Enter an amount to continue.");
    }

    const amountUnits = BigInt(toUnits(normalized, portfolio.decimals));
    if (amountUnits <= BigInt(0)) {
      throw new Error("Amount must be greater than zero.");
    }

    const feeAmount = (amountUnits * portfolio.buyInFeeBps) / BigInt(10000);
    const netPrincipal = amountUnits - feeAmount;
    const projectedPayout =
      netPrincipal + (netPrincipal * portfolio.yieldBps) / BigInt(10000);

    return {
      amountInput: normalized,
      amountUnits,
      feeAmount,
      netPrincipal,
      projectedPayout,
    };
  }

  function proceedBuyInReview() {
    try {
      const draft = buildBuyInDraft(buyInAmountInput);
      setBuyInDraft(draft);
      setBuyInFlowError("");
      setBuyInStep("review");
    } catch (error) {
      setBuyInFlowError(error instanceof Error ? error.message : "Invalid amount.");
    }
  }

  async function executeBuyInFlow() {
    if (!session || !buyInDraft) {
      return;
    }

    setActiveAction("buyIn-flow");
    setBuyInFlowError("");
    setBuyInStep("processing");
    setBuyInProgress("approving");

    try {
      const approveResponse = await writeToronetContractApi({
        address: session.address,
        password: session.password,
        contract: "stablecoin",
        functionName: "approve",
        args: [vaultAddress, buyInDraft.amountUnits],
      });

      const approveTxHash = extractTxHash(approveResponse) ?? "";
      setBuyInApproveTxHash(approveTxHash);
      addActivity(
        "Approval confirmed",
        `Approved ${buyInDraft.amountInput} ${portfolio.symbol} for vault usage.`,
        "completed",
        approveResponse,
      );

      setBuyInProgress("buying");

      const buyInResponse = await writeToronetContractApi({
        address: session.address,
        password: session.password,
        contract: "loan-vault",
        functionName: "buyIn",
        args: [buyInDraft.amountUnits],
      });

      const submittedTxHash = extractTxHash(buyInResponse) ?? "";
      setBuyInTxHash(submittedTxHash);
      addActivity(
        "Buy-in submitted",
        `Submitted buyIn(${buyInDraft.amountInput} ${portfolio.symbol}).`,
        "completed",
        buyInResponse,
      );

      await refreshPortfolio(session);
      setBuyInStep("success");
      setBuyInProgress("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Buy-in flow failed.";
      setBuyInProgress("idle");
      setBuyInStep("review");
      setBuyInFlowError(message);
      addActivity("Buy-in flow", message, "failed");
    } finally {
      setActiveAction(null);
    }
  }

  function openClaimModal() {
    setClaimFlowError("");
    setClaimTxHash("");
    setClaimModalOpen(true);
  }

  function closeClaimModal() {
    if (activeAction === "claimPayout") {
      return;
    }

    setClaimModalOpen(false);
    setClaimFlowError("");
  }

  async function executeClaimPayout() {
    if (!session) {
      return;
    }

    setActionError("");
    setClaimFlowError("");
    setActiveAction("claimPayout");

    try {
      const response = await writeToronetContractApi({
        address: session.address,
        password: session.password,
        contract: "loan-vault",
        functionName: "claimPayout",
        args: [session.address],
      });

      setClaimTxHash(extractTxHash(response) ?? "");
      addActivity(
        "Payout claimed",
        "Submitted claimPayout for matured positions.",
        "completed",
        response,
      );
      await refreshPortfolio(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Claim payout failed.";
      setClaimFlowError(message);
      setActionError(message);
      addActivity("claimPayout", message, "failed");
    } finally {
      setActiveAction(null);
    }
  }

  if (!hydrated) {
    return (
      <main className="vault-shell flex min-h-screen items-center justify-center px-5 py-12">
        <section className="vault-card w-full max-w-xl p-8 md:p-10">
          <p className="text-sm text-[var(--color-text-secondary)]">Loading session...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="vault-shell flex min-h-screen items-center justify-center px-5 py-12">
        <section className="vault-card w-full max-w-xl border border-[var(--color-border)] bg-white/92 p-8 shadow-[0_24px_56px_rgb(16_36_58_/_16%)] backdrop-blur md:p-10">
          <div className="inline-flex rounded-full bg-[linear-gradient(135deg,rgb(223_237_248),rgb(205_229_247))] p-3 text-[var(--color-primary-700)]">
            <Landmark size={22} />
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">BizMarket Vault</h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
            Authenticate with Toronet credentials to interact with LoanVault directly via the
            Toronet API.
          </p>

          <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-info-100)] bg-[var(--color-info-100)] px-4 py-3 text-sm text-[var(--color-info-700)]">
            Network: <strong>{network}</strong>
          </div>

          <div className="mt-6">
            <Segmented
              value={authMode}
              onChange={setAuthMode}
              options={[
                { value: "login", label: "Login" },
                { value: "signup", label: "Sign Up" },
              ]}
            />
          </div>

          <div className="mt-5 space-y-4">
            {authMode === "login" ? (
              <Field label="Username or Address">
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                  placeholder="jane_user or 0x..."
                />
              </Field>
            ) : (
              <Field label="Username">
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                  placeholder="Choose a username"
                />
              </Field>
            )}

            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 pr-16 text-sm outline-none"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>

            {authError ? (
              <p className="rounded-[var(--radius-md)] border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2 text-sm text-[var(--color-error-700)]">
                {authError}
              </p>
            ) : null}

            <Button
              fullWidth
              disabled={authLoading}
              onClick={() => (authMode === "login" ? handleLogin() : handleSignup())}
            >
              {authLoading
                ? "Processing..."
                : authMode === "login"
                  ? "Login with Toronet"
                  : "Create Toronet Account"}
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="vault-shell min-h-screen pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-4 md:px-8 md:py-6">
        <header className="vault-card sticky top-3 z-30 mb-5 flex flex-wrap items-center justify-between gap-3 border border-[var(--color-border)] bg-white/86 px-5 py-4 shadow-[0_14px_28px_rgb(16_36_58_/_10%)] backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              BizMarket Vault
            </p>
            <h1 className="text-2xl font-bold tracking-tight">LoanVault Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{network}</Badge>
            {displayUsername ? <Badge tone="neutral">@{displayUsername}</Badge> : null}
            <button
              type="button"
              onClick={() => {
                void copyAddressToClipboard();
              }}
              className="inline-flex h-12 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-sm font-semibold text-[var(--color-text-primary)]"
              title={session.address}
              aria-label={copiedAddress ? "Address copied" : "Copy wallet address"}
            >
              {copiedAddress ? <Check size={16} /> : <Copy size={16} />}
              <span className="ml-2">{shortAddress(session.address)}</span>
            </button>
            <Button
              variant="secondary"
              onClick={() => {
                void refreshPortfolio(session);
              }}
              disabled={portfolioLoading}
            >
              <RefreshCcw size={16} />
            </Button>
            <Button variant="ghost" onClick={logout}>
              <LogOut size={16} />
            </Button>
          </div>
        </header>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "home", label: "Home" },
            { value: "positions", label: "Positions" },
            { value: "activity", label: "Activity" },
            { value: "profile", label: "Profile" },
          ]}
        />

        {actionError ? (
          <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2 text-sm text-[var(--color-error-700)]">
            {actionError}
          </p>
        ) : null}

        <div className="mt-4 grid gap-4">
          {tab === "home" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Wallet Balance"
                  value={formatToken(portfolio.stablecoinBalance)}
                  note={portfolioLoading ? "Refreshing..." : undefined}
                />
                <MetricCard label="Available Payout" value={formatToken(portfolio.availablePayout)} />
                <MetricCard label="Total Invested" value={formatToken(portfolio.totalInvested)} />
                <MetricCard label="Projected Payout" value={formatToken(portfolio.projectedPayout)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card title="Buy In" subtitle="Approve stablecoin and call buyIn">
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Start a guided flow to enter amount, review fee/yield breakdown, and submit
                      approve + buyIn automatically after one final confirmation.
                    </p>
                    <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-3">
                      <span>
                        Fee: <strong>{portfolio.buyInFeeBps.toString()} bps</strong>
                      </span>
                      <span>
                        Yield: <strong>{portfolio.yieldBps.toString()} bps</strong>
                      </span>
                      <span>
                        Symbol: <strong>{portfolio.symbol}</strong>
                      </span>
                    </div>
                    <Button
                      fullWidth
                      disabled={activeAction !== null || portfolioLoading}
                      onClick={openBuyInModal}
                    >
                      <Coins size={16} />
                      Start Buy-In Flow
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </Card>

                <Card title="Claim Payout" subtitle="Call claimPayout to receive matured returns">
                  <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                    <p>
                      Claimable now: <strong>{formatToken(portfolio.availablePayout)}</strong>
                    </p>
                    <Button
                      disabled={
                        activeAction !== null ||
                        portfolio.availablePayout <= BigInt(0)
                      }
                      onClick={openClaimModal}
                    >
                      <HandCoins size={16} />
                      {activeAction === "claimPayout" ? "Claiming..." : "claimPayout"}
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          ) : null}

          {tab === "positions" ? (
            <Card title="Positions" subtitle="Direct output from getPositions">
              <div className="space-y-3">
                {portfolio.positions.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">No positions found.</p>
                ) : (
                  portfolio.positions.map((position) => (
                    <article
                      key={position.id}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {position.id}
                        </p>
                        {position.status === "ready" ? (
                          <Badge tone="success">Ready</Badge>
                        ) : (
                          <Badge tone="neutral">Locked</Badge>
                        )}
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
                        <span>Principal: {formatToken(position.principal)}</span>
                        <span>Payout: {formatToken(position.payoutAmount)}</span>
                        <span>
                          Started: {formatDate(new Date(Number(position.startTime) * 1000).toISOString())}
                        </span>
                        <span>
                          Matures: {formatDate(new Date(Number(position.maturityTime) * 1000).toISOString())}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </Card>
          ) : null}

          {tab === "activity" ? (
            <Card title="Activity" subtitle="Recent actions submitted from this session">
              <div className="space-y-3">
                {activity.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    No actions yet. Start with approve, buyIn, or claimPayout.
                  </p>
                ) : (
                  activity.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                        <Badge
                          tone={
                            item.status === "completed"
                              ? "success"
                              : item.status === "failed"
                                ? "warning"
                                : "info"
                          }
                        >
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

          {tab === "profile" ? (
            <Card title="Profile" subtitle="Current session and contract endpoints">
              <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                <p>
                  <strong>Address:</strong> {session.address}
                </p>
                <p>
                  <strong>Identifier:</strong> {session.identifier}
                </p>
                <p>
                  <strong>Network:</strong> {network}
                </p>
                <p>
                  <strong>LoanVault:</strong> {vaultAddress}
                </p>
                <p>
                  <strong>Stablecoin:</strong> {stablecoinAddress}
                </p>
                <p>
                  <strong>Session saved:</strong> {formatDate(session.loggedInAt)}
                </p>
              </div>
            </Card>
          ) : null}
        </div>

        <Modal
          isOpen={buyInModalOpen}
          title="Buy In Flow"
          subtitle={
            buyInStep === "amount"
              ? "Step 1/3: Enter amount"
              : buyInStep === "review"
                ? "Step 2/3: Review transaction details"
                : buyInStep === "processing"
                  ? "Step 3/3: Submitting approve + buyIn"
                  : "Completed"
          }
          onClose={closeBuyInModal}
          footer={
            buyInStep === "amount" ? (
              <>
                <Button variant="ghost" className="flex-1" onClick={closeBuyInModal}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={proceedBuyInReview}>
                  Continue
                  <ArrowRight size={16} />
                </Button>
              </>
            ) : buyInStep === "review" ? (
              <>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setBuyInStep("amount");
                    setBuyInFlowError("");
                  }}
                >
                  Back
                </Button>
                <Button className="flex-1" disabled={activeAction !== null} onClick={() => {
                  void executeBuyInFlow();
                }}>
                  Confirm and Execute
                </Button>
              </>
            ) : buyInStep === "processing" ? (
              <Button fullWidth disabled>
                <LoaderCircle className="animate-spin" size={16} />
                Processing...
              </Button>
            ) : (
              <Button fullWidth onClick={closeBuyInModal}>
                <CircleCheckBig size={16} />
                Done
              </Button>
            )
          }
        >
          <div className="space-y-4">
            {buyInStep === "amount" ? (
              <>
                <Field label={`Amount (${portfolio.symbol})`} hint="This amount will be approved and then supplied to buyIn.">
                  <input
                    value={buyInAmountInput}
                    onChange={(event) => setBuyInAmountInput(event.target.value)}
                    className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                    inputMode="decimal"
                    placeholder="100"
                  />
                </Field>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-info-100)] bg-[var(--color-info-100)] px-3 py-2 text-sm text-[var(--color-info-700)]">
                  Only one final confirmation is required. After you confirm, the app submits
                  approve and buyIn back-to-back.
                </div>
              </>
            ) : null}

            {buyInStep === "review" && buyInDraft ? (
              <>
                <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)]">
                  <p>
                    Gross amount: <strong>{buyInDraft.amountInput} {portfolio.symbol}</strong>
                  </p>
                  <p>
                    Buy-in fee ({portfolio.buyInFeeBps.toString()} bps): <strong>{formatToken(buyInDraft.feeAmount)}</strong>
                  </p>
                  <p>
                    Net principal: <strong>{formatToken(buyInDraft.netPrincipal)}</strong>
                  </p>
                  <p>
                    Projected payout ({portfolio.yieldBps.toString()} bps): <strong>{formatToken(buyInDraft.projectedPayout)}</strong>
                  </p>
                  <p>
                    Wallet after buy-in:
                    <strong>
                      {" "}
                      {formatToken(
                        portfolio.stablecoinBalance > buyInDraft.amountUnits
                          ? portfolio.stablecoinBalance - buyInDraft.amountUnits
                          : BigInt(0),
                      )}
                    </strong>
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                  <p className="font-semibold text-[var(--color-text-primary)]">Transaction sequence</p>
                  <p className="mt-1">1. approve(vault, amount)</p>
                  <p>2. buyIn(amount)</p>
                </div>
              </>
            ) : null}

            {buyInStep === "processing" ? (
              <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[var(--color-text-primary)]">Approve transaction</span>
                  <span className="text-[var(--color-text-secondary)]">
                    {buyInProgress === "approving"
                      ? "Submitting..."
                      : buyInApproveTxHash
                        ? "Completed"
                        : "Pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[var(--color-text-primary)]">buyIn transaction</span>
                  <span className="text-[var(--color-text-secondary)]">
                    {buyInProgress === "buying"
                      ? "Submitting..."
                      : buyInTxHash
                        ? "Completed"
                        : "Pending"}
                  </span>
                </div>
              </div>
            ) : null}

            {buyInStep === "success" ? (
              <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-success-100)] bg-[var(--color-success-100)] px-3 py-3 text-sm text-[var(--color-success-700)]">
                <p className="font-semibold">Buy-in flow completed successfully.</p>
                {buyInApproveTxHash ? <p className="break-all">Approve Tx: {buyInApproveTxHash}</p> : null}
                {buyInTxHash ? <p className="break-all">BuyIn Tx: {buyInTxHash}</p> : null}
              </div>
            ) : null}

            {buyInFlowError ? (
              <p className="rounded-[var(--radius-md)] border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2 text-sm text-[var(--color-error-700)]">
                {buyInFlowError}
              </p>
            ) : null}
          </div>
        </Modal>

        <Modal
          isOpen={claimModalOpen}
          title="Claim Payout"
          subtitle="Confirm payout destination and submit transaction"
          onClose={closeClaimModal}
          footer={
            claimTxHash ? (
              <Button fullWidth onClick={closeClaimModal}>
                <CircleCheckBig size={16} />
                Done
              </Button>
            ) : (
              <>
                <Button variant="ghost" className="flex-1" onClick={closeClaimModal}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={activeAction === "claimPayout" || portfolio.availablePayout <= BigInt(0)}
                  onClick={() => {
                    void executeClaimPayout();
                  }}
                >
                  {activeAction === "claimPayout" ? (
                    <>
                      <LoaderCircle className="animate-spin" size={16} />
                      Processing...
                    </>
                  ) : (
                    "Confirm Claim"
                  )}
                </Button>
              </>
            )
          }
        >
          <div className="space-y-3 text-sm">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-[var(--color-text-secondary)]">
              <p>
                Claimable amount: <strong>{formatToken(portfolio.availablePayout)}</strong>
              </p>
              <p className="mt-1">
                Receiver address: <strong>{shortAddress(session.address)}</strong>
              </p>
            </div>
            {claimTxHash ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-success-100)] bg-[var(--color-success-100)] p-3 text-[var(--color-success-700)]">
                <p className="font-semibold">Claim transaction submitted.</p>
                <p className="mt-1 break-all text-xs">Tx: {claimTxHash}</p>
              </div>
            ) : null}
            {claimFlowError ? (
              <p className="rounded-[var(--radius-md)] border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2 text-sm text-[var(--color-error-700)]">
                {claimFlowError}
              </p>
            ) : null}
          </div>
        </Modal>

        <nav className="fixed bottom-3 left-3 right-3 z-30 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white/95 p-2 shadow-[0_14px_28px_rgb(15_23_40_/_12%)] backdrop-blur lg:hidden">
          <ul className="grid grid-cols-4 gap-1">
            {[
              { value: "home", label: "Home", icon: <Landmark size={16} /> },
              { value: "positions", label: "Positions", icon: <Coins size={16} /> },
              { value: "activity", label: "Activity", icon: <Activity size={16} /> },
              { value: "profile", label: "Profile", icon: <UserCircle2 size={16} /> },
            ].map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => setTab(option.value as UserTab)}
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
