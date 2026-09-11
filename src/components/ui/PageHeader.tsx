import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/layout/nav";

/**
 * iOS large title with an optional breadcrumb / back affordance and an action
 * row that stacks under the title on phones.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  backHref,
  backLabel,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-4">
      {breadcrumb && (
        <div className="flex items-center gap-1.5 mb-2">
          <Link href="/admin" className="text-[15px] text-[#0A84FF] active:opacity-60 transition-opacity">
            Admin
          </Link>
          <ChevronRightIcon className="w-3 h-3 text-[rgba(235,235,245,0.3)] shrink-0" />
          <span className="text-[15px] text-[rgba(235,235,245,0.6)] truncate">{breadcrumb}</span>
        </div>
      )}

      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[15px] text-[#0A84FF] mb-2 -ml-1 py-1 active:opacity-60 transition-opacity"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          {backLabel ?? "Back"}
        </Link>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="ios-large-title text-white break-words">{title}</h1>
          {subtitle && (
            <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}

/** iOS-style capsule action button. */
export function HeaderButton({
  onClick,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const cls =
    variant === "primary"
      ? "bg-[#0A84FF] text-white active:bg-[#0071E3]"
      : "bg-[#1C1C1E] text-[#0A84FF] active:bg-[#2C2C2E]";
  return (
    <button
      onClick={onClick}
      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-full text-[15px] font-semibold transition-colors whitespace-nowrap ${cls}`}
    >
      {children}
    </button>
  );
}

export function PlusIcon({ className = "w-[15px] h-[15px]" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} d="M12 4v16m8-8H4" />
    </svg>
  );
}
