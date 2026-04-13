"use client";

import { ArrowLeft, Coins, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge, Button, Card, Field, MetricCard } from "@/app/components/vault-ui";
import {
  getConfiguredNetwork,
  getContractAddress,
  type NetworkEnv,
} from "@/app/lib/constants";
import { mintOnToronetTestnet, queryToronetContractApi } from "@/app/lib/toronet-client";
import { extractBigIntValue, extractTxHash } from "@/app/lib/toronet-common";
import { formatDate, shortAddress } from "@/app/lib/format";
import { getStoredSession, type ToronetSession } from "@/app/lib/session";
import { formatUnits, toUnits } from "@/app/lib/units";

export default function MintPage() {
  const network = useMemo<NetworkEnv>(() => getConfiguredNetwork(), []);
  const stablecoinAddress = useMemo(
    () => getContractAddress("stablecoin", network),
    [network],
  );

  const [session, setSession] = useState<ToronetSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [decimals, setDecimals] = useState(18);
  const [symbol, setSymbol] = useState("xESPEES");
  const [balance, setBalance] = useState<bigint>(BigInt(0));

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("1000");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [lastTxHash, setLastTxHash] = useState("");

  const refreshBalances = useCallback(async (activeSession: ToronetSession) => {
    setLoading(true);
    setError("");

    try {
      const [decimalsRaw, symbolRaw, balanceRaw] = await Promise.all([
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
      ]);

      const parsedDecimals = extractBigIntValue(decimalsRaw);
      setDecimals(
        parsedDecimals !== null &&
        parsedDecimals >= BigInt(0) &&
        parsedDecimals <= BigInt(36)
          ? Number(parsedDecimals)
          : 18,
      );

      if (typeof symbolRaw === "string") {
        setSymbol(symbolRaw);
      } else if (typeof (symbolRaw as { result?: unknown })?.result === "string") {
        setSymbol(String((symbolRaw as { result: unknown }).result));
      }

      setBalance(extractBigIntValue(balanceRaw) ?? BigInt(0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to fetch mint data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const existingSession = getStoredSession();
    setSession(existingSession);
    setRecipient(existingSession?.address ?? "");
    setLoadingSession(false);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    void refreshBalances(session);
  }, [session, refreshBalances]);

  async function handleMint() {
    if (!session) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const amountInUnits = toUnits(amount, decimals);

      const response = await mintOnToronetTestnet({
        address: session.address,
        password: session.password,
        to: recipient,
        amount: amountInUnits,
      });

      setSuccessMessage(`Minted ${amount} ${symbol} to ${shortAddress(recipient)}.`);
      setLastTxHash(extractTxHash(response) ?? "");
      await refreshBalances(session);

      // Chain state can lag for a short period after submission, so re-check shortly after.
      window.setTimeout(() => {
        void refreshBalances(session);
      }, 1500);
      window.setTimeout(() => {
        void refreshBalances(session);
      }, 3500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mint failed.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingSession) {
    return (
      <main className="vault-shell flex min-h-screen items-center justify-center px-5 py-12">
        <section className="vault-card w-full max-w-xl p-8 md:p-10">
          <p className="text-sm text-[var(--color-text-secondary)]">Loading mint page...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="vault-shell flex min-h-screen items-center justify-center px-5 py-12">
        <section className="vault-card w-full max-w-xl p-8 md:p-10">
          <h1 className="text-2xl font-bold">Session required</h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Login on the dashboard first. Mint requests use your saved Toronet credentials.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-12 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-sm font-semibold text-[var(--color-text-primary)]"
          >
            <ArrowLeft size={16} />
            <span className="ml-2">Back to App</span>
          </Link>
        </section>
      </main>
    );
  }

  const isTestnet = network === "testnet";

  return (
    <main className="vault-shell min-h-screen pb-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-4 md:px-8 md:py-6">
        <header className="vault-card mb-5 flex flex-wrap items-center justify-between gap-3 bg-white/90 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              BizMarket Vault
            </p>
            <h1 className="text-2xl font-bold tracking-tight">Testnet Mint</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={isTestnet ? "success" : "warning"}>{network}</Badge>
            <Link
              href="/"
              className="inline-flex h-12 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-sm font-semibold text-[var(--color-text-primary)]"
            >
              <ArrowLeft size={16} />
              <span className="ml-2">Back to App</span>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                void refreshBalances(session);
              }}
              disabled={loading}
            >
              <RefreshCcw size={16} />
            </Button>
          </div>
        </header>

        {!isTestnet ? (
          <Card title="Mint Disabled" subtitle="Minting is blocked outside testnet.">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Set NEXT_PUBLIC_NETWORK_ENV=testnet to enable mint operations.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard label="My Balance" value={`${formatUnits(balance, decimals, 2)} ${symbol}`} />
              <MetricCard label="Stablecoin Contract" value={shortAddress(stablecoinAddress)} />
            </div>

            <Card className="mt-4" title="Mint Stablecoin" subtitle="Calls ERC20 mint through Toronet API.">
              <div className="space-y-4">
                <Field label="Recipient Address">
                  <input
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                    placeholder="0x..."
                  />
                </Field>

                <Field label={`Amount (${symbol})`}>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                    inputMode="decimal"
                    placeholder="1000"
                  />
                </Field>

                {error ? (
                  <p className="rounded-[var(--radius-md)] border border-[var(--color-error-100)] bg-[var(--color-error-100)] px-3 py-2 text-sm text-[var(--color-error-700)]">
                    {error}
                  </p>
                ) : null}

                {successMessage ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-success-100)] bg-[var(--color-success-100)] px-3 py-2 text-sm text-[var(--color-success-700)]">
                    <p>{successMessage}</p>
                    {lastTxHash ? <p className="mt-1 break-all text-xs">Tx: {lastTxHash}</p> : null}
                    <p className="mt-1 text-xs">Updated: {formatDate(new Date().toISOString())}</p>
                  </div>
                ) : null}

                <Button fullWidth disabled={loading || !recipient || !amount} onClick={handleMint}>
                  <Coins size={16} />
                  {loading ? "Minting..." : "Mint on Testnet"}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
