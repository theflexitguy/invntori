import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Consistent page top: breadcrumb, title, subtitle, and an action row that
 * stacks under the title on phones instead of squeezing beside it.
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
    <div className="mb-5 sm:mb-6">
      {breadcrumb && (
        <div className="flex items-center gap-2 mb-3">
          <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm">
            Admin
          </Link>
          <svg className="w-3 h-3 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm text-white truncate">{breadcrumb}</span>
        </div>
      )}

      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors mb-3 -ml-1 py-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel ?? "Back"}
        </Link>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight break-words">{title}</h2>
          {subtitle && <p className="text-gray-400 mt-1 text-sm">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}

/** Header action button — full-width-ish on phones, natural width on desktop. */
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
      ? "bg-[#35B2FF]/15 text-[#35B2FF] border-[#35B2FF]/20 hover:bg-[#35B2FF]/25"
      : "bg-white/5 text-gray-300 border-[#2a2f3e] hover:text-white hover:border-white/20";
  return (
    <button
      onClick={onClick}
      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${cls}`}
    >
      {children}
    </button>
  );
}

export function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
