"use client";

import {
  Activity,
  ArrowRight,
  Check,
  CircleCheckBig,
  CircleHelp,
  Copy,
  Coins,
  HandCoins,
  Landmark,
  LoaderCircle,
  LogOut,
  MessageSquare,
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
  activityActionToTitle,
  type ActivityLogRecord,
  type ActivityLogWriteInput,
} from "@/app/lib/activity-log";
import {
  fetchActivityHistoryApi,
  getToronetUsernameByAddress,
  loginWithToronet,
  logActivityEventApi,
  queryToronetContractApi,
  submitFeedbackApi,
  submitSignupEmailApi,
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
import { formatBpsAsPercent, formatUnits, toUnits } from "@/app/lib/units";

type AuthMode = "login" | "signup";
type UserTab = "home" | "positions" | "activity" | "profile" | "faq" | "feedback";
type ActivityStatus = "completed" | "pending" | "failed";
type BuyInFlowStep = "amount" | "review" | "processing" | "success";
type BuyInProgress = "idle" | "approving" | "buying";
type ClaimFlowStep = "review" | "processing" | "success";

interface PositionRecord {
  id: string;
  key: string;
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
  totalChargedAmount: bigint;
  principalAmount: bigint;
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

const FAQ_ITEMS = [
  {
    question: "What credentials do I need to use the dashboard?",
    answer:
      "Use your Toronet username or address and password. Your session is stored in this browser so you can continue without signing in again each action.",
  },
  {
    question: "What happens during the Buy-In?",
    answer:
      "You enter an amount, review details, and confirm once. The app then runs approve and buyIn automatically and shows progress in the modal.",
  },
  {
    question: "Why can my balances update a few seconds after submit?",
    answer:
      "On-chain updates can settle with a short delay. The dashboard refreshes immediately and then retries to sync final values.",
  },
  {
    question: "How are fee and projected payout calculated?",
    answer:
      "Fee and yield rates are read from LoanVault contract parameters. The review step shows amount, fee, total charged, and projected payout.",
  },
  {
    question: "When can I claim payout?",
    answer:
      "You can claim when positions mature and your claimable amount is above zero. Claim is sent to your current wallet address.",
  },
  {
    question: "How do I switch between testnet and mainnet?",
    answer:
      "Set NEXT_PUBLIC_NETWORK_ENV to testnet or mainnet. The network badge confirms the active environment.",
  },
] as const;

function formatCountdownDHMS(totalSeconds: bigint): string {
  const dayInSeconds = BigInt(86400);
  const hourInSeconds = BigInt(3600);
  const minuteInSeconds = BigInt(60);

  const normalized = totalSeconds > BigInt(0) ? totalSeconds : BigInt(0);
  const days = normalized / dayInSeconds;
  const hours = (normalized % dayInSeconds) / hourInSeconds;
  const minutes = (normalized % hourInSeconds) / minuteInSeconds;
  const seconds = normalized % minuteInSeconds;

  const pad2 = (value: bigint) => value.toString().padStart(2, "0");
  return `${days.toString()}:${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function buildPositionKey(principal: bigint, startTime: bigint, payoutAmount: bigint): string {
  return `${startTime.toString()}-${principal.toString()}-${payoutAmount.toString()}`;
}

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
          key: buildPositionKey(principal, startTime, payoutAmount),
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
        key: buildPositionKey(principal, startTime, payoutAmount),
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
  const isTestnet = network === "testnet";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState<UserTab>("home");
  const [portfolio, setPortfolio] = useState<PortfolioState>(INITIAL_PORTFOLIO);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [countdownNow, setCountdownNow] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));

  const [buyInModalOpen, setBuyInModalOpen] = useState(false);
  const [buyInStep, setBuyInStep] = useState<BuyInFlowStep>("amount");
  const [buyInProgress, setBuyInProgress] = useState<BuyInProgress>("idle");
  const [buyInAmountInput, setBuyInAmountInput] = useState("100");
  const [buyInDraft, setBuyInDraft] = useState<BuyInDraft | null>(null);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpAddressCopied, setTopUpAddressCopied] = useState(false);
  const [buyInFlowError, setBuyInFlowError] = useState("");
  const [buyInApproveTxHash, setBuyInApproveTxHash] = useState("");
  const [buyInTxHash, setBuyInTxHash] = useState("");
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimStep, setClaimStep] = useState<ClaimFlowStep>("review");
  const [claimFlowError, setClaimFlowError] = useState("");
  const [claimTxHash, setClaimTxHash] = useState("");

  const [actionError, setActionError] = useState("");
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [positionNames, setPositionNames] = useState<Record<string, string>>({});
  const [positionNamesLoaded, setPositionNamesLoaded] = useState(false);

  const positionNamesStorageKey = useMemo(
    () =>
      session
        ? `toronet.position-names.v1.${network}.${session.address.toLowerCase()}`
        : "",
    [network, session],
  );

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

  const mapPersistedActivity = useCallback((item: ActivityLogRecord): ActivityRecord => {
    const when = item.createdAt || item.clientTimestamp || new Date().toISOString();

    return {
      id: item.id,
      title: activityActionToTitle(item.action),
      detail: item.detail,
      when,
      status: item.status,
      txHash: item.txHash,
    };
  }, []);

  const refreshActivityHistory = useCallback(
    async (activeSession: ToronetSession) => {
      try {
        const items = await fetchActivityHistoryApi(activeSession.address, 50);
        setActivity(items.map(mapPersistedActivity));
      } catch {
        // Keep local activity entries if persistence is unavailable.
      }
    },
    [mapPersistedActivity],
  );

  const persistActivity = useCallback(
    async (
      activeSession: ToronetSession,
      payload: Omit<ActivityLogWriteInput, "userAddress">,
    ) => {
      try {
        await logActivityEventApi({
          userAddress: activeSession.address,
          clientTimestamp: payload.clientTimestamp ?? new Date().toISOString(),
          ...payload,
        });

        await refreshActivityHistory(activeSession);
      } catch {
        // Do not block transaction UX on activity persistence issues.
      }
    },
    [refreshActivityHistory],
  );

  const formatToken = useCallback(
    (value: bigint, precision = 2) => `${formatUnits(value, portfolio.decimals, precision)} ${portfolio.symbol}`,
    [portfolio.decimals, portfolio.symbol],
  );

  const nextPayoutCountdown = useMemo(() => {
    if (portfolio.positions.length === 0) {
      return {
        value: "--:--:--:--",
        note: "No active positions",
      };
    }

    let nextMaturity: bigint | null = null;
    for (const position of portfolio.positions) {
      if (position.maturityTime <= countdownNow) {
        return {
          value: "00:00:00:00",
          note: "Payout can be claimed now",
        };
      }

      if (nextMaturity === null || position.maturityTime < nextMaturity) {
        nextMaturity = position.maturityTime;
      }
    }

    if (nextMaturity === null) {
      return {
        value: "--:--:--:--",
        note: "No active positions",
      };
    }

    return {
      value: formatCountdownDHMS(nextMaturity - countdownNow),
      note: "Day:Hour:Minute:Second",
    };
  }, [countdownNow, portfolio.positions]);

  const hasReadyPosition = useMemo(
    () => portfolio.positions.some((position) => position.maturityTime <= countdownNow),
    [countdownNow, portfolio.positions],
  );

  const canStartClaimFlow = useMemo(
    () => activeAction === null && (hasReadyPosition || portfolio.availablePayout > BigInt(0)),
    [activeAction, hasReadyPosition, portfolio.availablePayout],
  );

  const buyInAmountPreview = useMemo(() => {
    const normalized = buyInAmountInput.trim();
    if (!normalized) {
      return {
        units: null as bigint | null,
        totalChargedAmount: null as bigint | null,
        isValid: false,
      };
    }

    try {
      const units = BigInt(toUnits(normalized, portfolio.decimals));
      if (units <= BigInt(0)) {
        return {
          units: null as bigint | null,
          totalChargedAmount: null as bigint | null,
          isValid: false,
        };
      }

      const feeAmount = (units * portfolio.buyInFeeBps) / BigInt(10000);
      const totalChargedAmount = units + feeAmount;

      return {
        units,
        totalChargedAmount,
        isValid: true,
      };
    } catch {
      return {
        units: null as bigint | null,
        totalChargedAmount: null as bigint | null,
        isValid: false,
      };
    }
  }, [buyInAmountInput, portfolio.buyInFeeBps, portfolio.decimals]);

  const buyInHasInsufficientBalance = useMemo(() => {
    if (!buyInAmountPreview.totalChargedAmount) {
      return false;
    }

    return buyInAmountPreview.totalChargedAmount > portfolio.stablecoinBalance;
  }, [buyInAmountPreview.totalChargedAmount, portfolio.stablecoinBalance]);

  const buyInModalError = useMemo(() => {
    if (!buyInModalOpen) {
      return "";
    }

    return buyInFlowError || actionError;
  }, [actionError, buyInFlowError, buyInModalOpen]);

  const claimModalError = useMemo(() => {
    if (!claimModalOpen) {
      return "";
    }

    return claimFlowError || actionError;
  }, [actionError, claimFlowError, claimModalOpen]);

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
    const timer = window.setInterval(() => {
      setCountdownNow(BigInt(Math.floor(Date.now() / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void refreshPortfolio(session);
    void refreshActivityHistory(session);
  }, [session, refreshActivityHistory, refreshPortfolio]);

  useEffect(() => {
    if (!session || typeof window === "undefined" || !positionNamesStorageKey) {
      setPositionNames({});
      setPositionNamesLoaded(false);
      return;
    }

    const serialized = window.localStorage.getItem(positionNamesStorageKey);
    if (!serialized) {
      setPositionNames({});
      setPositionNamesLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(serialized) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setPositionNames({});
        setPositionNamesLoaded(true);
        return;
      }

      const normalizedEntries = Object.entries(parsed as Record<string, unknown>)
        .filter((entry): entry is [string, string] => {
          const [key, value] = entry;
          return key.trim().length > 0 && typeof value === "string";
        })
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value.length > 0);

      setPositionNames(Object.fromEntries(normalizedEntries));
    } catch {
      setPositionNames({});
    } finally {
      setPositionNamesLoaded(true);
    }
  }, [positionNamesStorageKey, session]);

  useEffect(() => {
    if (!session || !positionNamesLoaded || typeof window === "undefined" || !positionNamesStorageKey) {
      return;
    }

    window.localStorage.setItem(positionNamesStorageKey, JSON.stringify(positionNames));
  }, [positionNames, positionNamesLoaded, positionNamesStorageKey, session]);

  function updatePositionName(positionKey: string, nextName: string) {
    setPositionNames((previous) => {
      const normalized = nextName.trim();
      if (!normalized) {
        if (!(positionKey in previous)) {
          return previous;
        }

        const rest = { ...previous };
        delete rest[positionKey];
        return rest;
      }

      if (previous[positionKey] === normalized) {
        return previous;
      }

      return {
        ...previous,
        [positionKey]: normalized,
      };
    });
  }

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
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new Error("Enter a valid email address.");
      }

      await submitSignupEmailApi(normalizedEmail);

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
      setEmail("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign-up failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function submitFeedback() {
    if (!session) {
      return;
    }

    const normalizedMessage = feedbackMessage.trim();
    if (!normalizedMessage) {
      setFeedbackError("Please enter your feedback before submitting.");
      setFeedbackSuccess("");
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackError("");
    setFeedbackSuccess("");

    try {
      const fallbackUsername =
        session.username?.trim() ||
        (session.identifier.trim() && !isHexAddress(session.identifier) ? session.identifier.trim() : "");

      await submitFeedbackApi({
        message: normalizedMessage,
        userAddress: session.address,
        username: displayUsername || fallbackUsername || undefined,
      });

      setFeedbackMessage("");
      setFeedbackSuccess("Thanks! Your feedback has been sent to our admin team.");
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Could not submit feedback.");
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  function logout() {
    clearStoredSession();
    setSession(null);
    setBuyInModalOpen(false);
    setTopUpModalOpen(false);
    setClaimModalOpen(false);
    setClaimStep("review");
    setClaimFlowError("");
    setClaimTxHash("");
    setDisplayUsername("");
    setCopiedAddress(false);
    setPortfolio(INITIAL_PORTFOLIO);
    setPositionNames({});
    setPositionNamesLoaded(false);
    setActivity([]);
    setFeedbackMessage("");
    setFeedbackSubmitting(false);
    setFeedbackError("");
    setFeedbackSuccess("");
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
    setTopUpModalOpen(false);
    setTopUpAddressCopied(false);
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

    setTopUpModalOpen(false);
    setBuyInModalOpen(false);
    resetBuyInFlow();
  }

  function openTopUpModal() {
    setTopUpAddressCopied(false);
    setTopUpModalOpen(true);
  }

  function closeTopUpModal() {
    setTopUpModalOpen(false);
    setTopUpAddressCopied(false);
  }

  async function copyTopUpAddressToClipboard() {
    if (!session || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(session.address);
      setTopUpAddressCopied(true);
      window.setTimeout(() => setTopUpAddressCopied(false), 1800);
    } catch {
      setTopUpAddressCopied(false);
    }
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
    const totalChargedAmount = amountUnits + feeAmount;

    if (totalChargedAmount > portfolio.stablecoinBalance) {
      throw new Error("Insufficient wallet balance for amount + fee. Use top up to fund your wallet.");
    }

    const principalAmount = amountUnits;
    const projectedPayout =
      principalAmount + (principalAmount * portfolio.yieldBps) / BigInt(10000);

    return {
      amountInput: normalized,
      amountUnits,
      feeAmount,
      totalChargedAmount,
      principalAmount,
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
        args: [vaultAddress, buyInDraft.totalChargedAmount],
      });

      const approveTxHash = extractTxHash(approveResponse) ?? "";
      setBuyInApproveTxHash(approveTxHash);
      addActivity(
        "Approval confirmed",
        `Approved ${formatToken(buyInDraft.totalChargedAmount)} (amount + fee) for vault usage.`,
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
      void persistActivity(session, {
        action: "buyInSubmitted",
        status: "completed",
        detail: `Submitted buyIn(${buyInDraft.amountInput} ${portfolio.symbol}).`,
        txHash: submittedTxHash || undefined,
        amountUnits: buyInDraft.amountUnits.toString(),
        symbol: portfolio.symbol,
        decimals: portfolio.decimals,
      });

      // Apply an immediate optimistic update so dashboard metrics react instantly.
      setPortfolio((previous) => ({
        ...previous,
        stablecoinBalance:
          previous.stablecoinBalance > buyInDraft.totalChargedAmount
            ? previous.stablecoinBalance - buyInDraft.totalChargedAmount
            : BigInt(0),
        totalInvested: previous.totalInvested + buyInDraft.principalAmount,
        projectedPayout: previous.projectedPayout + buyInDraft.projectedPayout,
      }));

      await refreshPortfolio(session);

      // Chain state may lag briefly after submit, so re-sync metrics shortly after.
      window.setTimeout(() => {
        void refreshPortfolio(session);
      }, 1500);
      window.setTimeout(() => {
        void refreshPortfolio(session);
      }, 3500);

      setBuyInStep("success");
      setBuyInProgress("idle");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Buy-in failed.";
      setBuyInProgress("idle");
      setBuyInStep("review");
      setBuyInFlowError(message);
      addActivity("Buy-in", message, "failed");
      void persistActivity(session, {
        action: "buyInFailed",
        status: "failed",
        detail: message,
        amountUnits: buyInDraft.amountUnits.toString(),
        symbol: portfolio.symbol,
        decimals: portfolio.decimals,
      });
    } finally {
      setActiveAction(null);
    }
  }

  function openClaimModal() {
    setClaimStep("review");
    setClaimFlowError("");
    setClaimTxHash("");
    setClaimModalOpen(true);
  }

  function closeClaimModal() {
    if (activeAction === "claimPayout") {
      return;
    }

    setClaimModalOpen(false);
    setClaimStep("review");
    setClaimFlowError("");
  }

  async function executeClaimPayout() {
    if (!session) {
      return;
    }

    setActionError("");
    setClaimFlowError("");
    setClaimStep("processing");
    setActiveAction("claimPayout");

    try {
      const response = await writeToronetContractApi({
        address: session.address,
        password: session.password,
        contract: "loan-vault",
        functionName: "claimPayout",
        args: [session.address],
      });

      const claimTxHashValue = extractTxHash(response) ?? "";
      setClaimTxHash(claimTxHashValue);
      addActivity(
        "Payout claimed",
        "Submitted claimPayout for matured positions.",
        "completed",
        response,
      );
      void persistActivity(session, {
        action: "claimPayoutSubmitted",
        status: "completed",
        detail: "Submitted claimPayout for matured positions.",
        txHash: claimTxHashValue || undefined,
        amountUnits: portfolio.availablePayout.toString(),
        symbol: portfolio.symbol,
        decimals: portfolio.decimals,
      });

      // Show immediate feedback while we synchronize exact values from chain.
      setPortfolio((previous) => ({
        ...previous,
        availablePayout: BigInt(0),
      }));

      await refreshPortfolio(session);

      // Claim updates can settle with slight delay, so re-check shortly after.
      window.setTimeout(() => {
        void refreshPortfolio(session);
      }, 1500);
      window.setTimeout(() => {
        void refreshPortfolio(session);
      }, 3500);

      setClaimStep("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Claim payout failed.";
      setClaimStep("review");
      setClaimFlowError(message);
      setActionError(message);
      addActivity("claimPayout", message, "failed");
      void persistActivity(session, {
        action: "claimPayoutFailed",
        status: "failed",
        detail: message,
        amountUnits: portfolio.availablePayout.toString(),
        symbol: portfolio.symbol,
        decimals: portfolio.decimals,
      });
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
            Sign in with Toronet credentials to use LoanVault.
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
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {authMode === "login"
                ? "Step 1: Enter your username or address and password."
                : "Step 1: Enter email, username, and password to create a wallet."}
            </p>
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
              <>
                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Username">
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                    placeholder="Choose a username"
                  />
                </Field>
              </>
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
                  ? "Sign In"
                  : "Create Account"}
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
            {isTestnet ? (
              <Link
                href="/mint"
                className="inline-flex h-12 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-sm font-semibold text-[var(--color-text-primary)]"
              >
                <Coins size={16} />
                <span className="ml-2">Mint</span>
              </Link>
            ) : null}
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
            { value: "faq", label: "FAQ" },
            { value: "feedback", label: "Feedback" },
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <MetricCard
                  label="Wallet Balance"
                  value={formatToken(portfolio.stablecoinBalance)}
                  note={portfolioLoading ? "Refreshing..." : undefined}
                />
                <MetricCard label="Available Payout" value={formatToken(portfolio.availablePayout)} />
                <MetricCard label="Total Invested" value={formatToken(portfolio.totalInvested)} />
                <MetricCard label="Projected Payout" value={formatToken(portfolio.projectedPayout)} />
                <MetricCard
                  label="Next Payout"
                  value={nextPayoutCountdown.value}
                  note={nextPayoutCountdown.note}
                  tone={nextPayoutCountdown.value === "00:00:00:00" ? "success" : "default"}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card title="Buy In">
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Enter amount, review totals, then confirm once to submit approve.
                    </p>
                    <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-3">
                      <span>
                        Fee: <strong>{formatBpsAsPercent(portfolio.buyInFeeBps)}</strong>
                      </span>
                      <span>
                        Yield: <strong>{formatBpsAsPercent(portfolio.yieldBps)}</strong>
                      </span>
                      <span>
                        Currency: <strong>{portfolio.symbol}</strong>
                      </span>
                    </div>
                    <Button
                      fullWidth
                      disabled={activeAction !== null || portfolioLoading}
                      onClick={openBuyInModal}
                    >
                      <Coins size={16} />
                      Earn Interest
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </Card>

                <Card title="Claim Payout">
                  <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                    <p>
                      Claimable now: <strong>{formatToken(portfolio.availablePayout)}</strong>
                    </p>
                    <p>
                      Next payout countdown: <strong>{nextPayoutCountdown.value}</strong>
                    </p>
                    {hasReadyPosition && portfolio.availablePayout <= BigInt(0) ? (
                      <p className="rounded-[var(--radius-md)] border border-[var(--color-warning-100)] bg-[var(--color-warning-100)] px-3 py-2 text-xs text-[var(--color-warning-700)]">
                        A position is mature, but claimable amount is zero. Vault funding may still be pending.
                      </p>
                    ) : null}
                    <Button
                      disabled={!canStartClaimFlow}
                      onClick={openClaimModal}
                    >
                      <HandCoins size={16} />
                      {activeAction === "claimPayout" ? "Claiming..." : "Start Claim"}
                    </Button>
                  </div>
                </Card>
              </div>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setTab("feedback")}
                  className="text-xs text-[var(--color-text-tertiary)] underline-offset-2 hover:underline"
                >
                  Have feedback? Share it with us.
                </button>
              </div>
            </>
          ) : null}

          {tab === "positions" ? (
            <Card title="Positions" subtitle="Direct output from getPositions">
              <div className="space-y-3">
                {portfolio.positions.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">No positions found.</p>
                ) : (
                  portfolio.positions.map((position) => {
                    const isReady = position.maturityTime <= countdownNow;
                    const positionName = positionNames[position.key] ?? "";
                    return (
                    <article
                      key={position.key}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {positionName || position.id}
                        </p>
                        {isReady ? (
                          <Badge tone="success">Ready</Badge>
                        ) : (
                          <Badge tone="neutral">Locked</Badge>
                        )}
                      </div>
                      <div className="mt-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                          Position Name
                        </label>
                        <input
                          value={positionName}
                          onChange={(event) => updatePositionName(position.key, event.target.value)}
                          className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                          placeholder={`Name ${position.id}`}
                          maxLength={48}
                        />
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
                        <span>Position ID: {position.id}</span>
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
                    );
                  })
                )}
              </div>
            </Card>
          ) : null}

          {tab === "activity" ? (
            <Card title="Activity" subtitle="Recent actions submitted from this session">
              <div className="space-y-3">
                {activity.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    No transactions yet. Start with Buy In or Claim Payout.
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
            <Card title="Profile" subtitle="Session and network details">
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

          {tab === "faq" ? (
            <Card title="FAQ" subtitle="Quick answers before you transact">
              <div className="space-y-3">
                {FAQ_ITEMS.map((item) => (
                  <details
                    key={item.question}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3"
                  >
                    <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--color-text-primary)]">
                      <span className="inline-flex items-center gap-2">
                        <CircleHelp size={15} />
                        {item.question}
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.answer}</p>
                  </details>
                ))}
              </div>
            </Card>
          ) : null}

          {tab === "feedback" ? (
            <Card title="Feedback" subtitle="Tell us what is confusing, broken, or missing.">
              <div className="space-y-4">
                <Field
                  label="Your feedback"
                  hint="Include what happened, where it happened, and what you expected."
                >
                  <textarea
                    value={feedbackMessage}
                    onChange={(event) => setFeedbackMessage(event.target.value)}
                    className="min-h-32 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none"
                    placeholder="Example: Buy-in review step should show expected maturity date before confirmation."
                    maxLength={1500}
                  />
                </Field>

                {feedbackError ? (
                  <p className="rounded-[var(--radius-md)] border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2 text-sm text-[var(--color-error-700)]">
                    {feedbackError}
                  </p>
                ) : null}

                {feedbackSuccess ? (
                  <p className="rounded-[var(--radius-md)] border border-[var(--color-success-100)] bg-[var(--color-success-100)] px-3 py-2 text-sm text-[var(--color-success-700)]">
                    {feedbackSuccess}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    disabled={feedbackSubmitting}
                    onClick={() => {
                      void submitFeedback();
                    }}
                  >
                    <MessageSquare size={16} />
                    {feedbackSubmitting ? "Sending..." : "Send Feedback"}
                  </Button>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Sent from: {shortAddress(session.address)}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <Modal
          isOpen={buyInModalOpen}
          title="Buy In"
          subtitle={
            buyInStep === "amount"
              ? "Step 1 of 3: Enter amount"
              : buyInStep === "review"
                ? "Step 2 of 3: Review details"
                : buyInStep === "processing"
                  ? "Step 3 of 3: Submitting transactions"
                  : "Completed"
          }
          onClose={closeBuyInModal}
          footer={
            buyInStep === "amount" ? (
              <>
                <Button variant="ghost" className="flex-1" onClick={closeBuyInModal}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={proceedBuyInReview}
                  disabled={!buyInAmountPreview.isValid || buyInHasInsufficientBalance}
                >
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
                <Field label={`Amount (${portfolio.symbol})`} hint="Your wallet must cover amount + fee. The app approves total charged, then calls buyIn(amount).">
                  <input
                    value={buyInAmountInput}
                    onChange={(event) => setBuyInAmountInput(event.target.value)}
                    className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                    inputMode="decimal"
                    placeholder="100"
                  />
                </Field>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                  Wallet balance: <strong>{formatToken(portfolio.stablecoinBalance)}</strong>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Step 1 help: enter the amount you want to invest.
                </p>
                {buyInHasInsufficientBalance ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-warning-100)] bg-[var(--color-warning-100)] px-3 py-2 text-sm text-[var(--color-warning-700)]">
                    <p className="font-semibold">Balance is not enough for amount + fee.</p>
                    <button
                      type="button"
                      onClick={openTopUpModal}
                      className="mt-1 font-semibold underline"
                    >
                      Not enough cash? Top up
                    </button>
                  </div>
                ) : null}
                <div className="rounded-[var(--radius-md)] border border-[var(--color-info-100)] bg-[var(--color-info-100)] px-3 py-2 text-sm text-[var(--color-info-700)]">
                  You confirm once. The app submits approve, then buyIn.
                </div>
              </>
            ) : null}

            {buyInStep === "review" && buyInDraft ? (
              <>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Step 2 help: verify these values before confirming.
                </p>
                <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)]">
                  <p>
                    Amount: <strong>{buyInDraft.amountInput} {portfolio.symbol}</strong>
                  </p>
                  <p>
                    Buy-in fee ({formatBpsAsPercent(portfolio.buyInFeeBps)}): <strong>{formatToken(buyInDraft.feeAmount)}</strong>
                  </p>
                  <p>
                    Total needed for transaction: <strong>{formatToken(buyInDraft.totalChargedAmount)}</strong>
                  </p>
                  <p>
                    Projected payout ({formatBpsAsPercent(portfolio.yieldBps)}): <strong>{formatToken(buyInDraft.projectedPayout)}</strong>
                  </p>
                  <p>
                    Wallet after buy-in:
                    <strong>
                      {" "}
                      {formatToken(
                        portfolio.stablecoinBalance > buyInDraft.totalChargedAmount
                          ? portfolio.stablecoinBalance - buyInDraft.totalChargedAmount
                          : BigInt(0),
                      )}
                    </strong>
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                  <p className="font-semibold text-[var(--color-text-primary)]">Transaction sequence</p>
                  <p className="mt-1">1. approve(vault, amount + fee)</p>
                  <p>2. buyIn(amount)</p>
                </div>
              </>
            ) : null}

            {buyInStep === "processing" ? (
              <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-sm">
                <p className="text-[var(--color-text-secondary)]">
                  Step 3 help: please wait while both transactions are submitted.
                </p>
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
                <p className="font-semibold">Buy-in completed successfully.</p>
                <p className="text-xs">You can close this modal and review updated dashboard metrics.</p>
                {buyInApproveTxHash ? <p className="break-all">Approve Tx: {buyInApproveTxHash}</p> : null}
                {buyInTxHash ? <p className="break-all">BuyIn Tx: {buyInTxHash}</p> : null}
              </div>
            ) : null}

            {buyInModalError ? (
              <p className="rounded-[var(--radius-md)] border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2 text-sm text-[var(--color-error-700)]">
                {buyInModalError}
              </p>
            ) : null}
          </div>
        </Modal>

        <Modal
          isOpen={topUpModalOpen}
          title="Top Up Wallet"
          subtitle="Send funds to this wallet, then refresh and continue buy-in."
          onClose={closeTopUpModal}
          footer={
            <>
              <Button variant="ghost" className="flex-1" onClick={closeTopUpModal}>
                Close
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  void copyTopUpAddressToClipboard();
                }}
              >
                {topUpAddressCopied ? "Address Copied" : "Copy Wallet Address"}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="text-[var(--color-text-secondary)]">
              Transfer <strong>{portfolio.symbol}</strong> to your wallet address below.
            </p>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Wallet Address
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--color-text-primary)]">{session.address}</p>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Network: {network}. After funding, refresh dashboard balances and continue the buy-in.
            </p>
          </div>
        </Modal>

        <Modal
          isOpen={claimModalOpen}
          title="Claim Payout"
          subtitle={
            claimStep === "review"
              ? "Step 1 of 3: Review claim"
              : claimStep === "processing"
                ? "Step 2 of 3: Submitting claim"
                : "Step 3 of 3: Completed"
          }
          onClose={closeClaimModal}
          footer={
            claimStep === "success" ? (
              <Button fullWidth onClick={closeClaimModal}>
                <CircleCheckBig size={16} />
                Done
              </Button>
            ) : claimStep === "processing" ? (
              <Button fullWidth disabled>
                <LoaderCircle className="animate-spin" size={16} />
                Processing...
              </Button>
            ) : (
              <>
                <Button variant="ghost" className="flex-1" onClick={closeClaimModal}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={activeAction === "claimPayout" || !canStartClaimFlow}
                  onClick={() => {
                    void executeClaimPayout();
                  }}
                >
                  Confirm Claim
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

            {claimStep === "review" ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-3 text-[var(--color-text-secondary)]">
                <p className="font-semibold text-[var(--color-text-primary)]">Step 1 help</p>
                <p className="mt-1">
                  Confirm the payout amount and destination address, then submit claimPayout.
                </p>
              </div>
            ) : null}

            {claimStep === "processing" ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-[var(--color-text-secondary)]">
                <p className="font-semibold text-[var(--color-text-primary)]">Step 2 help</p>
                <p className="mt-1">Submitting claim transaction and syncing balances.</p>
              </div>
            ) : null}

            {claimTxHash ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-success-100)] bg-[var(--color-success-100)] p-3 text-[var(--color-success-700)]">
                <p className="font-semibold">Claim transaction submitted.</p>
                <p className="text-xs">Step 3 complete. Close this modal to continue.</p>
                <p className="mt-1 break-all text-xs">Tx: {claimTxHash}</p>
              </div>
            ) : null}
            {claimModalError ? (
              <p className="rounded-[var(--radius-md)] border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2 text-sm text-[var(--color-error-700)]">
                {claimModalError}
              </p>
            ) : null}
          </div>
        </Modal>

        <nav className="fixed bottom-3 left-3 right-3 z-30 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white/95 p-2 shadow-[0_14px_28px_rgb(15_23_40_/_12%)] backdrop-blur lg:hidden">
          <ul className="grid grid-cols-6 gap-1">
            {[
              { value: "home", label: "Home", icon: <Landmark size={16} /> },
              { value: "positions", label: "Positions", icon: <Coins size={16} /> },
              { value: "activity", label: "Activity", icon: <Activity size={16} /> },
              { value: "profile", label: "Profile", icon: <UserCircle2 size={16} /> },
              { value: "faq", label: "FAQ", icon: <CircleHelp size={16} /> },
              { value: "feedback", label: "Feedback", icon: <MessageSquare size={16} /> },
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
