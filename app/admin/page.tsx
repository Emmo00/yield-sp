"use client";

import {
  Activity,
  CheckCircle2,
  CircleDollarSign,
  Landmark,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { Button, Card, MetricCard, Modal } from "@/app/components/vault-ui";
import { formatDate, formatMoney } from "@/app/lib/format";
import { scenario } from "@/app/lib/mock-data";
import type { ActivityItem, MockScenario } from "@/app/lib/types";

type AdminTab = "overview" | "funding" | "parameters" | "transfers" | "activity";
type FundingStep = "review" | "approve" | "confirm" | "success";

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [data, setData] = useState<MockScenario>(scenario);
  const [fundingModalOpen, setFundingModalOpen] = useState(false);
  const [fundingStep, setFundingStep] = useState<FundingStep>("review");

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
          <div className="hidden rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] sm:block">
            Operations
          </div>
        </header>

        <AdminView
          tab={tab}
          setTab={setTab}
          data={data}
          openFundVault={() => {
            setFundingStep("review");
            setFundingModalOpen(true);
          }}
        />
      </div>

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
            <DetailRow
              label="Outstanding payout obligations"
              value={formatMoney(data.vault.outstandingPayoutObligations)}
            />
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
            <MetricCard label="Funding Wallet" value={formatMoney(data.admin.fundingWalletBalance)} />
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
            <DetailRow
              label="Outstanding payout obligations"
              value={formatMoney(data.vault.outstandingPayoutObligations)}
            />
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
            <DetailRow label="Lock Period" value={`${data.admin.protocolParameters.lockWeeks} weeks`} />
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
                  {transfer.from} to {transfer.to}
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
