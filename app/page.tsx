"use client";

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  HandCoins,
  Landmark,
  RefreshCcw,
  ShieldCheck,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge, Button, Card, Field, MetricCard, Modal, Segmented } from "@/app/components/vault-ui";
import {
  daysUntil,
  formatDate,
  formatMoney,
  getInvestmentStatus,
  getProjectedPayout,
  shortAddress,
} from "@/app/lib/format";
import { scenario } from "@/app/lib/mock-data";
import type {
  ActivityItem,
  Investment,
  InvestmentStatus,
  MockScenario,
  WalletStatus,
} from "@/app/lib/types";

type UserTab = "home" | "investments" | "withdraw" | "activity" | "profile";
type AdminTab = "overview" | "funding" | "parameters" | "transfers" | "activity";
type InvestStep = "amount" | "review" | "approve" | "confirm" | "success";
type WithdrawStep = "review" | "confirm" | "success";
type FundingStep = "review" | "approve" | "confirm" | "success";

export default function Home() {
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("disconnected");
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const [userTab, setUserTab] = useState<UserTab>("home");
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");

  const [data, setData] = useState<MockScenario>(scenario);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(null);

  const [investModalOpen, setInvestModalOpen] = useState(false);
  const [investStep, setInvestStep] = useState<InvestStep>("amount");
  const [investAmount, setInvestAmount] = useState("500");
  const [needsApproval, setNeedsApproval] = useState(true);

  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>("review");

  const [fundingModalOpen, setFundingModalOpen] = useState(false);
  const [fundingStep, setFundingStep] = useState<FundingStep>("review");
  const showLegacyAdminPanel = false;

  const derivedInvestments = useMemo(
    () =>
      data.investments.map((investment) => ({
        ...investment,
        status: getInvestmentStatus(investment, data.nowIso, data.vault),
        projectedPayout: getProjectedPayout(
          investment.principal,
          investment.entryFeeRate,
          investment.projectedReturnRate,
        ),
      })),
    [data],
  );

  const readyInvestments = derivedInvestments.filter((investment) => investment.status === "ready");
  const activeInvestments = derivedInvestments.filter(
    (investment) => investment.status === "locked" || investment.status === "awaiting_funding",
  );
  const withdrawnInvestments = derivedInvestments.filter(
    (investment) => investment.status === "withdrawn",
  );

  const selectedInvestment = derivedInvestments.find(
    (investment) => investment.id === selectedInvestmentId,
  );

  const investNumeric = Number(investAmount);
  const isInvestAmountValid =
    Number.isFinite(investNumeric) &&
    investNumeric > 0 &&
    investNumeric >= data.admin.protocolParameters.minimumInvestment &&
    investNumeric <= data.profile.stablecoinBalance;

  const investFee = isInvestAmountValid
    ? investNumeric * data.admin.protocolParameters.entryFeeRate
    : 0;
  const investNet = Math.max(0, investNumeric - investFee);
  const investProjected = isInvestAmountValid
    ? getProjectedPayout(
        investNumeric,
        data.admin.protocolParameters.entryFeeRate,
        data.admin.protocolParameters.projectedReturnRate,
      )
    : 0;

  const totalReadyAmount = readyInvestments.reduce(
    (sum, investment) => sum + investment.projectedPayout,
    0,
  );

  const statusBanner =
    data.vault.status === "healthy"
      ? {
          tone: "success" as const,
          title: "Vault funded and operating normally",
          body: "Matured investments can be withdrawn as soon as they become eligible.",
        }
      : {
          tone: "warning" as const,
          title: "Some matured withdrawals may be delayed until the vault is funded",
          body: "Maturity date is reached, but liquidity is being replenished.",
        };

  function openInvest() {
    setInvestStep("amount");
    setInvestModalOpen(true);
  }

  function connectWallet() {
    setWalletStatus("connecting");
    window.setTimeout(() => {
      setWalletStatus("connected");
      setWalletModalOpen(false);
      setUserTab("home");
    }, 700);
  }

  function submitInvestment() {
    const newInvestment: Investment = {
      id: `INV-${Math.floor(3000 + Math.random() * 3000)}`,
      principal: investNumeric,
      entryFeeRate: data.admin.protocolParameters.entryFeeRate,
      projectedReturnRate: data.admin.protocolParameters.projectedReturnRate,
      startedAt: data.nowIso,
      maturesAt: new Date(
        new Date(data.nowIso).getTime() +
          data.admin.protocolParameters.lockWeeks * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      txHash: `0x${Math.random().toString(16).slice(2, 18)}`,
    };

    setData((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        stablecoinBalance: prev.profile.stablecoinBalance - investNumeric,
      },
      investments: [newInvestment, ...prev.investments],
      userActivity: [
        {
          id: `UA-${prev.userActivity.length + 1}`,
          type: "investment_created",
          title: "Investment created",
          description: `${newInvestment.id} locked for ${prev.admin.protocolParameters.lockWeeks} weeks.`,
          amount: investNumeric,
          date: prev.nowIso,
          status: "completed",
          txHash: newInvestment.txHash,
        },
        ...prev.userActivity,
      ],
    }));

    setInvestStep("success");
  }

  function submitWithdraw() {
    const now = data.nowIso;
    const ids = new Set(readyInvestments.map((investment) => investment.id));

    setData((prev) => ({
      ...prev,
      investments: prev.investments.map((investment) =>
        ids.has(investment.id) ? { ...investment, withdrawnAt: now } : investment,
      ),
      profile: {
        ...prev.profile,
        stablecoinBalance: prev.profile.stablecoinBalance + totalReadyAmount,
      },
      userActivity: [
        {
          id: `UA-${prev.userActivity.length + 1}`,
          type: "withdrawal_completed",
          title: "Withdrawal completed",
          description: "Returns sent to destination wallet.",
          amount: totalReadyAmount,
          date: now,
          status: "completed",
          txHash: `0x${Math.random().toString(16).slice(2, 18)}`,
        },
        ...prev.userActivity,
      ],
      vault: {
        ...prev.vault,
        availableToWithdraw: 0,
      },
    }));

    setWithdrawStep("success");
  }

  function submitFundVault() {
    setData((prev) => ({
      ...prev,
      vault: {
        ...prev.vault,
        shortfall: 0,
        status: "healthy",
        availableToWithdraw: prev.vault.availableToWithdraw + prev.vault.shortfall,
      },
      admin: {
        ...prev.admin,
        fundingWalletBalance: prev.admin.fundingWalletBalance - prev.vault.shortfall,
        activity: [
          {
            id: `AA-${prev.admin.activity.length + 1}`,
            type: "vault_funded",
            title: "Vault funded",
            description: "Outstanding payout obligations covered.",
            amount: prev.vault.shortfall,
            date: prev.nowIso,
            status: "completed",
            txHash: `0x${Math.random().toString(16).slice(2, 18)}`,
          },
          ...prev.admin.activity,
        ],
      },
    }));

    setFundingStep("success");
  }

  if (walletStatus !== "connected") {
    return (
      <main className="vault-shell flex min-h-screen items-center justify-center px-5 py-12">
        <section className="vault-card w-full max-w-xl p-8 md:p-10">
          <div className="inline-flex rounded-full bg-[var(--color-primary-100)] p-3 text-[var(--color-primary-700)]">
            <Landmark size={22} />
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight">
            Welcome to BizMarket Vault
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
            Grow stablecoin deposits with fixed-term vault investments. Invest once,
            track your maturity date, and withdraw returns when your investment becomes
            available.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              "Fixed 12-week lock",
              "Clear projected returns",
              "Simple withdrawal flow",
            ].map((item) => (
              <div key={item} className="vault-card-soft rounded-[var(--radius-md)] p-3 text-sm font-medium">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-warning-100)] bg-[var(--color-warning-100)] px-4 py-3 text-sm text-[var(--color-warning-700)]">
            Withdrawals become available after maturity and depend on vault funding status.
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button fullWidth onClick={() => setWalletModalOpen(true)}>
              Connect Wallet
            </Button>
            <Button fullWidth variant="secondary">
              Learn how it works
            </Button>
          </div>
        </section>

        <Modal
          isOpen={walletModalOpen}
          title="Connect Wallet"
          subtitle="Connect a wallet to view your vault, invest, and withdraw returns."
          onClose={() => setWalletModalOpen(false)}
          footer={
            <>
              <Button variant="ghost" fullWidth onClick={() => setWalletModalOpen(false)}>
                Cancel
              </Button>
              <Button
                fullWidth
                onClick={connectWallet}
                disabled={walletStatus === "connecting"}
              >
                {walletStatus === "connecting" ? "Connecting..." : "Connect"}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
            <p>We will never access your funds without your approval.</p>
            <Card soft>
              <p className="font-semibold text-[var(--color-text-primary)]">Supported token</p>
              <p className="mt-1">USDC balance will load after connection.</p>
            </Card>
          </div>
        </Modal>
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
            <h1 className="text-2xl font-bold tracking-tight">Your Vault Portfolio</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] sm:block">
              {shortAddress(data.profile.walletAddress)}
            </div>
          </div>
        </header>

        <UserView
          tab={userTab}
          setTab={setUserTab}
          data={data}
          openInvest={openInvest}
          openWithdraw={() => {
            setWithdrawStep("review");
            setWithdrawModalOpen(true);
          }}
          openDetails={setSelectedInvestmentId}
          activeInvestments={activeInvestments}
          readyInvestments={readyInvestments}
          withdrawnInvestments={withdrawnInvestments}
          statusBanner={statusBanner}
        />
        {showLegacyAdminPanel ? (
          <AdminView
            tab={adminTab}
            setTab={setAdminTab}
            data={data}
            openFundVault={() => {
              setFundingStep("review");
              setFundingModalOpen(true);
            }}
          />
        ) : null}
      </div>

      <Modal
        isOpen={Boolean(selectedInvestment)}
        title="Investment Detail"
        subtitle={selectedInvestment ? selectedInvestment.id : undefined}
        onClose={() => setSelectedInvestmentId(null)}
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setSelectedInvestmentId(null)}>
              Close
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setSelectedInvestmentId(null);
                setInvestModalOpen(true);
                setInvestStep("amount");
              }}
            >
              Invest Again
            </Button>
          </>
        }
      >
        {selectedInvestment ? (
          <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
            <StatusBadge status={selectedInvestment.status} />
            <DetailRow label="Investment amount" value={formatMoney(selectedInvestment.principal)} />
            <DetailRow label="Projected payout" value={formatMoney(selectedInvestment.projectedPayout)} />
            <DetailRow label="Started on" value={formatDate(selectedInvestment.startedAt)} />
            <DetailRow label="Matures on" value={formatDate(selectedInvestment.maturesAt)} />
            <DetailRow
              label="Countdown"
              value={`${daysUntil(selectedInvestment.maturesAt, data.nowIso)} days`}
            />
            <p className="rounded-[var(--radius-md)] border border-[var(--color-info-100)] bg-[var(--color-info-100)] px-3 py-2 text-[var(--color-info-700)]">
              {statusExplanation(selectedInvestment.status)}
            </p>
            <a className="text-[var(--color-primary-500)] underline" href="#">
              View transaction: {selectedInvestment.txHash}
            </a>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={investModalOpen}
        title={investTitles[investStep].title}
        subtitle={investTitles[investStep].subtitle}
        onClose={() => setInvestModalOpen(false)}
        footer={
          <>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                if (investStep === "amount") {
                  setInvestModalOpen(false);
                  return;
                }

                if (investStep === "success") {
                  setInvestModalOpen(false);
                  setUserTab("investments");
                  return;
                }

                const previousStep: Record<Exclude<InvestStep, "amount">, InvestStep> = {
                  review: "amount",
                  approve: "review",
                  confirm: needsApproval ? "approve" : "review",
                  success: "confirm",
                };

                setInvestStep(previousStep[investStep as Exclude<InvestStep, "amount">]);
              }}
            >
              {investStep === "amount" ? "Cancel" : investStep === "success" ? "Go to Home" : "Back"}
            </Button>
            <Button
              fullWidth
              onClick={() => {
                if (investStep === "amount") {
                  setInvestStep("review");
                  return;
                }

                if (investStep === "review") {
                  setInvestStep(needsApproval ? "approve" : "confirm");
                  return;
                }

                if (investStep === "approve") {
                  setNeedsApproval(false);
                  setInvestStep("confirm");
                  return;
                }

                if (investStep === "confirm") {
                  submitInvestment();
                  return;
                }

                setInvestModalOpen(false);
                setUserTab("investments");
              }}
              disabled={(investStep === "amount" && !isInvestAmountValid) || investStep === "success"}
            >
              {investStep === "amount" && "Continue"}
              {investStep === "review" && "Approve & Continue"}
              {investStep === "approve" && "Approve in Wallet"}
              {investStep === "confirm" && "Confirm in Wallet"}
              {investStep === "success" && "Done"}
            </Button>
          </>
        }
      >
        {investStep === "amount" ? (
          <div className="space-y-4">
            <Field
              label="Investment Amount"
              hint={`Available balance: ${formatMoney(data.profile.stablecoinBalance)}`}
              error={
                investAmount.length > 0 && !isInvestAmountValid
                  ? "Enter a valid amount above the minimum and within your balance"
                  : undefined
              }
            >
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <input
                  value={investAmount}
                  onChange={(event) => setInvestAmount(event.target.value)}
                  className="w-full bg-transparent text-2xl font-semibold outline-none"
                  inputMode="decimal"
                />
                <span className="text-sm font-semibold text-[var(--color-text-secondary)]">USDC</span>
              </div>
            </Field>
            <div className="grid grid-cols-4 gap-2">
              {[0.25, 0.5, 0.75, 1].map((ratio) => (
                <Button
                  key={ratio}
                  variant="secondary"
                  onClick={() => setInvestAmount((data.profile.stablecoinBalance * ratio).toFixed(2))}
                >
                  {ratio === 1 ? "MAX" : `${ratio * 100}%`}
                </Button>
              ))}
            </div>
            <Card soft>
              <p className="text-sm text-[var(--color-text-secondary)]">Projected payout preview</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(investProjected)}</p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Your funds will be locked for {data.admin.protocolParameters.lockWeeks} weeks.
              </p>
            </Card>
          </div>
        ) : null}

        {investStep === "review" ? (
          <div className="space-y-3">
            <DetailRow label="Amount" value={formatMoney(investNumeric)} />
            <DetailRow label="Entry Fee" value={formatMoney(investFee)} />
            <DetailRow label="Net Investment" value={formatMoney(investNet)} />
            <DetailRow label="Projected Payout" value={formatMoney(investProjected)} />
            <DetailRow
              label="Maturity Date"
              value={formatDate(
                new Date(
                  new Date(data.nowIso).getTime() +
                    data.admin.protocolParameters.lockWeeks * 7 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              )}
            />
            <p className="rounded-[var(--radius-md)] border border-[var(--color-warning-100)] bg-[var(--color-warning-100)] px-3 py-2 text-sm text-[var(--color-warning-700)]">
              Withdrawals are only available after maturity and when vault liquidity is available.
            </p>
          </div>
        ) : null}

        {investStep === "approve" ? (
          <Card soft>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Before investing, you need to approve token access once. You stay in control and
              can review this permission in your wallet.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-primary-700)]">
              <ShieldCheck size={16} />
              Secure wallet confirmation required
            </div>
          </Card>
        ) : null}

        {investStep === "confirm" ? (
          <Card>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Confirm your investment to create a new locked investment.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>1. Awaiting signature in wallet</li>
              <li>2. Transaction pending confirmation</li>
              <li>3. Investment becomes visible in portfolio</li>
            </ul>
          </Card>
        ) : null}

        {investStep === "success" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto inline-flex rounded-full bg-[var(--color-success-100)] p-3 text-[var(--color-success-700)]">
              <CheckCircle2 size={22} />
            </div>
            <p className="text-xl font-bold">Investment confirmed</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Your funds are now locked until maturity. We added this investment to your
              portfolio immediately.
            </p>
            <div className="grid gap-2 text-left text-sm">
              <DetailRow label="Invested" value={formatMoney(investNumeric)} />
              <DetailRow label="Projected payout" value={formatMoney(investProjected)} />
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={withdrawModalOpen}
        title="Withdraw Returns"
        subtitle="Withdraw returns from all eligible matured investments"
        onClose={() => setWithdrawModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setWithdrawModalOpen(false)}>
              Back
            </Button>
            <Button
              fullWidth
              disabled={readyInvestments.length === 0 || withdrawStep === "success"}
              onClick={() => {
                if (withdrawStep === "review") {
                  setWithdrawStep("confirm");
                  return;
                }

                if (withdrawStep === "confirm") {
                  submitWithdraw();
                }
              }}
            >
              {withdrawStep === "review" ? "Withdraw Now" : withdrawStep === "confirm" ? "Confirm in Wallet" : "Done"}
            </Button>
          </>
        }
      >
        {withdrawStep === "review" ? (
          <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
            <Card soft>
              <p>Total available now</p>
              <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
                {formatMoney(totalReadyAmount)}
              </p>
            </Card>
            <p>
              You can withdraw returns from all eligible matured investments in one transaction.
            </p>
            {readyInvestments.length > 0 ? (
              <ul className="space-y-2">
                {readyInvestments.map((investment) => (
                  <li
                    key={investment.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2"
                  >
                    {investment.id} - {formatMoney(investment.projectedPayout)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-[var(--radius-md)] border border-[var(--color-warning-100)] bg-[var(--color-warning-100)] px-3 py-2 text-[var(--color-warning-700)]">
                No returns are available to withdraw right now.
              </p>
            )}
          </div>
        ) : null}

        {withdrawStep === "confirm" ? (
          <Card>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Destination wallet: {shortAddress(data.profile.walletAddress)}
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Not all matured investments may be available if the vault is not fully funded.
            </p>
          </Card>
        ) : null}

        {withdrawStep === "success" ? (
          <div className="space-y-3 text-center">
            <div className="mx-auto inline-flex rounded-full bg-[var(--color-success-100)] p-3 text-[var(--color-success-700)]">
              <CheckCircle2 size={22} />
            </div>
            <p className="text-xl font-bold">Withdrawal successful</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Your returns were sent to {shortAddress(data.profile.walletAddress)}.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={fundingModalOpen}
        title="Fund Vault"
        subtitle="Cover shortfall so matured withdrawals become available"
        onClose={() => setFundingModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setFundingModalOpen(false)}>
              Cancel
            </Button>
            <Button
              fullWidth
              disabled={data.vault.shortfall <= 0 || fundingStep === "success"}
              onClick={() => {
                if (fundingStep === "review") {
                  setFundingStep("approve");
                  return;
                }

                if (fundingStep === "approve") {
                  setFundingStep("confirm");
                  return;
                }

                if (fundingStep === "confirm") {
                  submitFundVault();
                }
              }}
            >
              {fundingStep === "review"
                ? "Continue"
                : fundingStep === "approve"
                  ? "Approve in Wallet"
                  : fundingStep === "confirm"
                    ? "Confirm Funding"
                    : "Done"}
            </Button>
          </>
        }
      >
        {fundingStep === "review" ? (
          <div className="space-y-3">
            <DetailRow label="Outstanding payout obligations" value={formatMoney(data.vault.outstandingPayoutObligations)} />
            <DetailRow label="Vault balance" value={formatMoney(data.vault.vaultBalance)} />
            <DetailRow label="Shortfall" value={formatMoney(data.vault.shortfall)} />
          </div>
        ) : null}

        {fundingStep === "approve" ? (
          <Card soft>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Approve stablecoin access so operations can fund the vault and unlock pending
              withdrawals.
            </p>
          </Card>
        ) : null}

        {fundingStep === "confirm" ? (
          <Card>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Confirm transfer of {formatMoney(data.vault.shortfall)} from funding wallet.
            </p>
          </Card>
        ) : null}

        {fundingStep === "success" ? (
          <div className="space-y-3 text-center">
            <div className="mx-auto inline-flex rounded-full bg-[var(--color-success-100)] p-3 text-[var(--color-success-700)]">
              <CheckCircle2 size={22} />
            </div>
            <p className="text-xl font-bold">Vault funding completed</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Shortfall reduced to zero and user withdrawals can proceed.
            </p>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}

function UserView({
  tab,
  setTab,
  data,
  openInvest,
  openWithdraw,
  openDetails,
  activeInvestments,
  readyInvestments,
  withdrawnInvestments,
  statusBanner,
}: {
  tab: UserTab;
  setTab: (value: UserTab) => void;
  data: MockScenario;
  openInvest: () => void;
  openWithdraw: () => void;
  openDetails: (id: string) => void;
  activeInvestments: Array<Investment & { status: InvestmentStatus; projectedPayout: number }>;
  readyInvestments: Array<Investment & { status: InvestmentStatus; projectedPayout: number }>;
  withdrawnInvestments: Array<Investment & { status: InvestmentStatus; projectedPayout: number }>;
  statusBanner: { tone: "success" | "warning"; title: string; body: string };
}) {
  const [listFilter, setListFilter] = useState<"active" | "ready" | "withdrawn">("active");

  const listData =
    listFilter === "active"
      ? activeInvestments
      : listFilter === "ready"
        ? readyInvestments
        : withdrawnInvestments;

  return (
    <div className="grid gap-4">
      {tab === "home" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Available to Withdraw"
              value={formatMoney(data.vault.availableToWithdraw)}
              tone={statusBanner.tone === "success" ? "success" : "warning"}
            />
            <MetricCard label="Total Invested" value={formatMoney(data.vault.totalInvested)} />
            <MetricCard label="Projected Payout" value={formatMoney(data.vault.projectedPayout)} />
            <MetricCard
              label="Next Maturity"
              value={formatDate(data.vault.nextMaturityAt)}
              note={`${daysUntil(data.vault.nextMaturityAt, data.nowIso)} days`}
            />
          </div>

          <Card
            className={
              statusBanner.tone === "success"
                ? "border-[var(--color-success-100)] bg-[var(--color-success-100)]"
                : "border-[var(--color-warning-100)] bg-[var(--color-warning-100)]"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{statusBanner.title}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{statusBanner.body}</p>
              </div>
              <ShieldCheck className="shrink-0" size={18} />
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button onClick={openInvest}>Invest</Button>
            <Button variant="secondary" onClick={openWithdraw}>
              Withdraw Returns
            </Button>
            <Button variant="ghost" onClick={() => setTab("investments")}>
              View Investments
            </Button>
          </div>

          <Card title="Active Investments" subtitle="Your latest locked or pending positions">
            {activeInvestments.length > 0 ? (
              <div className="space-y-3">
                {activeInvestments.slice(0, 3).map((investment) => (
                  <InvestmentRow key={investment.id} investment={investment} onOpen={openDetails} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                You haven&apos;t created any investments yet.
              </p>
            )}
          </Card>
        </>
      ) : null}

      {tab === "investments" ? (
        <>
          <Card title="My Investments" subtitle="Track active, ready, and withdrawn positions">
            <Segmented
              value={listFilter}
              onChange={setListFilter}
              options={[
                { value: "active", label: "Active" },
                { value: "ready", label: "Ready" },
                { value: "withdrawn", label: "Withdrawn" },
              ]}
            />
            <div className="mt-4 space-y-3">
              {listData.length > 0 ? (
                listData.map((investment) => (
                  <InvestmentRow key={investment.id} investment={investment} onOpen={openDetails} />
                ))
              ) : (
                <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
                  {listFilter === "active" && "No active investments right now."}
                  {listFilter === "ready" && "No returns are available to withdraw right now."}
                  {listFilter === "withdrawn" && "No withdrawn investments yet."}
                </p>
              )}
            </div>
          </Card>
          <Button onClick={openInvest}>Invest</Button>
        </>
      ) : null}

      {tab === "withdraw" ? (
        <Card title="Withdraw Returns" subtitle="Withdraw returns from all eligible matured investments">
          <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
            <p>Total available now</p>
            <p className="text-3xl font-bold text-[var(--color-text-primary)]">
              {formatMoney(readyInvestments.reduce((sum, item) => sum + item.projectedPayout, 0))}
            </p>
            <p>
              Not all matured investments may be available if the vault is not fully funded.
            </p>
            <Button onClick={openWithdraw} disabled={readyInvestments.length === 0}>
              Withdraw Now
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === "activity" ? (
        <Card title="Activity" subtitle="Transaction timeline and auditability">
          <ActivityList items={data.userActivity} />
        </Card>
      ) : null}

      {tab === "profile" ? (
        <Card title="Profile, Help, and Legal" subtitle="Support and disclosures">
          <div className="space-y-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-sm">
              <p className="font-semibold text-[var(--color-text-primary)]">Wallet</p>
              <p className="mt-1 text-[var(--color-text-secondary)]">
                {shortAddress(data.profile.walletAddress)}
              </p>
            </div>
            <FaqRow title="How vault withdrawals work" />
            <FaqRow title="Understanding lock periods" />
            <FaqRow title="Why a matured investment may still be pending" />
            <FaqRow title="Contact support" />
          </div>
        </Card>
      ) : null}

      <MobileNav
        options={[
          { value: "home", label: "Home", icon: <Landmark size={16} /> },
          { value: "investments", label: "Investments", icon: <Coins size={16} /> },
          { value: "withdraw", label: "Withdraw", icon: <HandCoins size={16} /> },
          { value: "activity", label: "Activity", icon: <Activity size={16} /> },
          { value: "profile", label: "Profile", icon: <UserCircle2 size={16} /> },
        ]}
        value={tab}
        onChange={setTab}
      />
    </div>
  );
}

function AdminView({
  tab,
  setTab,
  data,
  openFundVault,
}: {
  tab: AdminTab;
  setTab: (value: AdminTab) => void;
  data: MockScenario;
  openFundVault: () => void;
}) {
  return (
    <div className="grid gap-4">
      {tab === "overview" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Outstanding Payout Obligations"
              value={formatMoney(data.vault.outstandingPayoutObligations)}
            />
            <MetricCard label="Vault Balance" value={formatMoney(data.vault.vaultBalance)} />
            <MetricCard
              label="Shortfall"
              value={formatMoney(data.vault.shortfall)}
              tone={data.vault.shortfall > 0 ? "warning" : "success"}
            />
            <MetricCard
              label="Funding Wallet"
              value={formatMoney(data.admin.fundingWalletBalance)}
            />
          </div>
          <Card>
            <Button onClick={openFundVault} disabled={data.vault.shortfall <= 0}>
              Fund Vault
            </Button>
          </Card>
        </>
      ) : null}

      {tab === "funding" ? (
        <Card title="Vault Funding" subtitle="Monitor liabilities and liquidity">
          <div className="space-y-3">
            <DetailRow label="Outstanding payout obligations" value={formatMoney(data.vault.outstandingPayoutObligations)} />
            <DetailRow label="Vault balance" value={formatMoney(data.vault.vaultBalance)} />
            <DetailRow label="Shortfall" value={formatMoney(data.vault.shortfall)} />
            <Button onClick={openFundVault} disabled={data.vault.shortfall <= 0}>
              Fund Vault
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === "parameters" ? (
        <Card title="Protocol Parameters" subtitle="Plain language settings">
          <div className="space-y-3">
            <DetailRow
              label="Entry Fee"
              value={`${(data.admin.protocolParameters.entryFeeRate * 100).toFixed(2)}%`}
            />
            <DetailRow
              label="Projected Return Rate"
              value={`${(data.admin.protocolParameters.projectedReturnRate * 100).toFixed(2)}%`}
            />
            <DetailRow
              label="Lock Period"
              value={`${data.admin.protocolParameters.lockWeeks} weeks`}
            />
            <DetailRow
              label="Minimum Investment"
              value={formatMoney(data.admin.protocolParameters.minimumInvestment)}
            />
          </div>
        </Card>
      ) : null}

      {tab === "transfers" ? (
        <Card title="Transfers" subtitle="Operational transfer records">
          <div className="space-y-3">
            {data.admin.transfers.map((transfer) => (
              <div
                key={transfer.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm"
              >
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {transfer.from} <ArrowRight className="inline" size={14} /> {transfer.to}
                </p>
                <p className="mt-1 text-[var(--color-text-secondary)]">
                  {formatMoney(transfer.amount)} - {formatDate(transfer.date)}
                </p>
                <span className="mt-2 inline-flex rounded-full bg-[var(--color-surface-alt)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {transfer.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "activity" ? (
        <Card title="Admin Activity" subtitle="Auditable operations timeline">
          <ActivityList items={data.admin.activity} />
        </Card>
      ) : null}

      <MobileNav
        options={[
          { value: "overview", label: "Overview", icon: <Landmark size={16} /> },
          { value: "funding", label: "Funding", icon: <Wallet size={16} /> },
          { value: "parameters", label: "Parameters", icon: <CircleDollarSign size={16} /> },
          { value: "transfers", label: "Transfers", icon: <RefreshCcw size={16} /> },
          { value: "activity", label: "Activity", icon: <Activity size={16} /> },
        ]}
        value={tab}
        onChange={setTab}
      />
    </div>
  );
}

function InvestmentRow({
  investment,
  onOpen,
}: {
  investment: Investment & { status: InvestmentStatus; projectedPayout: number };
  onOpen: (id: string) => void;
}) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{investment.id}</p>
        <StatusBadge status={investment.status} />
      </div>
      <div className="mt-2 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
        <span>Principal: {formatMoney(investment.principal)}</span>
        <span>Projected payout: {formatMoney(investment.projectedPayout)}</span>
        <span>Started: {formatDate(investment.startedAt)}</span>
        <span>Matures: {formatDate(investment.maturesAt)}</span>
      </div>
      <button
        className="mt-3 text-sm font-semibold text-[var(--color-primary-500)]"
        type="button"
        onClick={() => onOpen(investment.id)}
      >
        View Details
      </button>
    </article>
  );
}

function statusExplanation(status: InvestmentStatus) {
  if (status === "locked") {
    return "This investment is currently locked.";
  }

  if (status === "ready") {
    return "This investment is matured and ready to withdraw.";
  }

  if (status === "awaiting_funding") {
    return "This investment has matured and is waiting for vault funding before withdrawal.";
  }

  if (status === "matured") {
    return "This investment has matured.";
  }

  return "This investment has been withdrawn.";
}

function StatusBadge({ status }: { status: InvestmentStatus }) {
  if (status === "ready") {
    return <Badge tone="success">Ready to Withdraw</Badge>;
  }

  if (status === "awaiting_funding") {
    return <Badge tone="warning">Awaiting Vault Funding</Badge>;
  }

  if (status === "matured") {
    return <Badge tone="info">Matured</Badge>;
  }

  if (status === "locked") {
    return <Badge tone="neutral">Locked</Badge>;
  }

  return <Badge tone="neutral">Withdrawn</Badge>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className="font-semibold text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
        >
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{formatDate(item.date)}</p>
          </div>
          <div className="text-right text-sm">
            {item.amount ? (
              <p className="font-semibold text-[var(--color-text-primary)]">{formatMoney(item.amount)}</p>
            ) : null}
            <span className="mt-1 inline-flex rounded-full bg-[var(--color-surface-alt)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              {item.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FaqRow({ title }: { title: string }) {
  return (
    <button
      className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-left text-sm font-semibold text-[var(--color-text-primary)]"
      type="button"
    >
      {title}
      <ArrowRight size={16} />
    </button>
  );
}

function MobileNav<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon: React.ReactNode }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <nav className="fixed bottom-3 left-3 right-3 z-30 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white/95 p-2 shadow-[0_14px_28px_rgb(15_23_40_/_12%)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5 gap-1">
        {options.map((option) => (
          <li key={option.value}>
            <button
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex w-full flex-col items-center gap-1 rounded-[12px] px-1 py-2 text-[11px] font-semibold ${
                value === option.value
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
  );
}

const investTitles: Record<InvestStep, { title: string; subtitle: string }> = {
  amount: {
    title: "Start Investment",
    subtitle: "Choose how much stablecoin you want to lock",
  },
  review: {
    title: "Review Investment",
    subtitle: "Review your investment before continuing",
  },
  approve: {
    title: "Approve Token Access",
    subtitle: "Approve this token once so the vault can process your investment",
  },
  confirm: {
    title: "Confirm Investment",
    subtitle: "This will create a new locked investment",
  },
  success: {
    title: "Investment Success",
    subtitle: "Your vault position is now active",
  },
};
