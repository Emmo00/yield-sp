"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  className,
  fullWidth,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "h-12 px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-500)] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "vault-btn-primary",
        variant === "secondary" && "vault-btn-secondary",
        variant === "ghost" &&
          "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white font-semibold text-[var(--color-text-secondary)]",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  soft?: boolean;
}

export function Card({ title, subtitle, children, className, soft = false }: CardProps) {
  return (
    <section
      className={clsx(soft ? "vault-card-soft" : "vault-card", "p-5", className)}
      aria-label={title}
    >
      {title ? (
        <header className="mb-4">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

interface BadgeProps {
  tone: "success" | "warning" | "info" | "neutral";
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={clsx(
        "vault-chip",
        tone === "success" && "vault-chip-success",
        tone === "warning" && "vault-chip-warning",
        tone === "info" && "vault-chip-info",
        tone === "neutral" && "vault-chip-neutral",
      )}
    >
      {children}
    </span>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            "h-9 flex-1 rounded-[10px] text-xs font-semibold transition",
            value === option.value
              ? "bg-white text-[var(--color-primary-700)] shadow-[0_4px_10px_rgb(15_23_40_/_8%)]"
              : "text-[var(--color-text-secondary)]",
          )}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "success" | "warning";
}

export function MetricCard({ label, value, note, tone = "default" }: MetricCardProps) {
  return (
    <Card
      className={clsx(
        "vault-rise",
        tone === "success" && "border-[var(--color-success-100)] bg-[var(--color-success-100)]",
        tone === "warning" && "border-[var(--color-warning-100)] bg-[var(--color-warning-100)]",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      {note ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{note}</p> : null}
    </Card>
  );
}

interface ModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[rgb(14_26_43_/_52%)] px-4 pb-4 pt-16 md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[0_20px_50px_rgb(15_23_40_/_18%)]">
        <header className="flex items-start justify-between border-b border-[var(--color-border)] p-5">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            className="h-9 w-9 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]"
            onClick={onClose}
            type="button"
            aria-label="Close dialog"
          >
            x
          </button>
        </header>
        <div className="max-h-[68vh] overflow-auto p-5">{children}</div>
        {footer ? (
          <footer className="flex gap-3 border-t border-[var(--color-border)] p-5">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-2 text-xs text-[var(--color-error-700)]">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{hint}</p>
      ) : null}
    </label>
  );
}
