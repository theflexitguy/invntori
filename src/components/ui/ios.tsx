"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronRightIcon } from "@/components/layout/nav";

/* ──────────────────────────────────────────────────────────────────────────
   Building blocks that mirror the native app's UIKit vocabulary: large
   titles, grouped list cards with inset separators, and system switches.
   ────────────────────────────────────────────────────────────────────────── */

/** iOS large title. Pages keep this; the nav bar title fades in on scroll. */
export function LargeTitle({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h1 className="ios-large-title text-white break-words">{title}</h1>
        {subtitle && (
          <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-1">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Section header above a grouped list, styled like the native Admin tab. */
export function SectionHeader({ children }: { children: ReactNode }) {
  return <h2 className="text-[20px] font-bold text-white mb-2 px-1">{children}</h2>;
}

/** Small uppercase caption header (used above compact groups). */
export function CaptionHeader({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] font-semibold text-[rgba(235,235,245,0.6)] uppercase tracking-wide mb-2 px-1">
      {children}
    </p>
  );
}

/** Grouped card. Children are separated by inset hairlines, iOS style. */
export function Group({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1C1C1E] rounded-[14px] overflow-hidden ${className}`}>{children}</div>
  );
}

/** A tappable row inside a Group: icon, label, chevron. */
export function GroupRow({
  href,
  onClick,
  Icon,
  label,
  detail,
  destructive,
  last,
}: {
  href?: string;
  onClick?: () => void;
  Icon?: ComponentType<{ className?: string }>;
  label: ReactNode;
  detail?: ReactNode;
  destructive?: boolean;
  last?: boolean;
}) {
  const inner = (
    <>
      {Icon && (
        <span className="flex items-center pr-3 shrink-0">
          <Icon className={`w-[22px] h-[22px] ${destructive ? "text-[#FF453A]" : "text-[#0A84FF]"}`} />
        </span>
      )}
      <span
        className={`flex-1 min-w-0 flex items-center gap-3 pr-3.5 py-3 ${
          last ? "" : "border-b border-[#38383A]/70"
        }`}
      >
        <span
          className={`flex-1 min-w-0 text-[17px] leading-snug ${
            destructive ? "text-[#FF453A]" : "text-white"
          }`}
        >
          {label}
        </span>
        {detail && <span className="text-[15px] text-[rgba(235,235,245,0.6)] shrink-0">{detail}</span>}
        <ChevronRightIcon className="w-[14px] h-[14px] text-[rgba(235,235,245,0.3)] shrink-0" />
      </span>
    </>
  );

  const cls = "w-full flex items-stretch pl-4 text-left active:bg-white/[0.06] transition-colors";

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** iOS system switch. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-[46px] h-[28px] rounded-full transition-colors duration-200 ${
        checked ? "bg-[#30D158]" : "bg-[#39393D]"
      }`}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-[24px] h-[24px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
          checked ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/** Blue text button with a leading glyph, as used in the native filter bar. */
export function TextAction({
  onClick,
  children,
  icon,
  tone = "blue",
}: {
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  tone?: "blue" | "red";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[15px] font-medium active:bg-white/[0.06] transition-colors ${
        tone === "red" ? "text-[#FF453A]" : "text-[#0A84FF]"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/** iOS search field. */
export function SearchField({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-[rgba(235,235,245,0.4)] pointer-events-none"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M10.5 3a7.5 7.5 0 1 0 4.55 13.46l4.24 4.25a1.1 1.1 0 0 0 1.56-1.56l-4.25-4.24A7.5 7.5 0 0 0 10.5 3Zm0 2.2a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Z" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#1C1C1E] rounded-[12px] pl-9 pr-3 py-3 text-[17px] text-white placeholder-[rgba(235,235,245,0.4)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]/60"
      />
    </div>
  );
}

/** Circular tinted glyph badge, as on the dashboard AREAS cards. */
export const TINTS = {
  blue: { text: "text-[#0A84FF]", bg: "bg-[#0A84FF]/15" },
  green: { text: "text-[#30D158]", bg: "bg-[#30D158]/15" },
  red: { text: "text-[#FF453A]", bg: "bg-[#FF453A]/15" },
  orange: { text: "text-[#FF9F0A]", bg: "bg-[#FF9F0A]/15" },
  yellow: { text: "text-[#FFD60A]", bg: "bg-[#FFD60A]/15" },
  teal: { text: "text-[#64D2FF]", bg: "bg-[#64D2FF]/15" },
  purple: { text: "text-[#BF5AF2]", bg: "bg-[#BF5AF2]/15" },
  indigo: { text: "text-[#5E5CE6]", bg: "bg-[#5E5CE6]/15" },
  gray: { text: "text-[rgba(235,235,245,0.6)]", bg: "bg-white/10" },
} as const;

export type Tint = keyof typeof TINTS;

export function IconBadge({ Icon, tint }: { Icon: ComponentType<{ className?: string }>; tint: Tint }) {
  const t = TINTS[tint];
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${t.bg}`}>
      <Icon className={`w-[19px] h-[19px] ${t.text}`} />
    </div>
  );
}

/** Status pill (Low stock, Needs Attention, …). */
export function Pill({
  children,
  tint = "gray",
}: {
  children: ReactNode;
  tint?: Tint;
}) {
  const t = TINTS[tint];
  return (
    <span
      className={`inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-semibold whitespace-nowrap ${t.bg} ${t.text}`}
    >
      {children}
    </span>
  );
}
