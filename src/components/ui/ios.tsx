"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronRightIcon, ChevronDownIcon, UpDownChevronIcon } from "@/components/layout/nav";

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

/**
 * Section header above a grouped list. The Admin tab prints these in white;
 * the detail screens (Actions, Driver History, …) print them in the
 * secondary label colour.
 */
export function SectionHeader({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "secondary";
}) {
  return (
    <h2
      className={`text-[20px] font-bold mb-2 px-1 ${
        tone === "secondary" ? "text-[rgba(235,235,245,0.6)]" : "text-white"
      }`}
    >
      {children}
    </h2>
  );
}

/** Small caption header above a compact group. */
export function CaptionHeader({
  children,
  uppercase = true,
}: {
  children: ReactNode;
  uppercase?: boolean;
}) {
  return (
    <p
      className={`text-[15px] text-[rgba(235,235,245,0.6)] mb-2 px-1 ${
        uppercase ? "text-[13px] font-semibold uppercase tracking-wide" : ""
      }`}
    >
      {children}
    </p>
  );
}

/**
 * Grouped card. Children are separated by inset hairlines, iOS style.
 *
 * `tone="elevated"` is for cards sitting inside a sheet, whose own background
 * is already #1C1C1E — without it the card would be invisible.
 */
export function Group({
  children,
  className = "",
  tone = "base",
}: {
  children: ReactNode;
  className?: string;
  tone?: "base" | "elevated";
}) {
  return (
    <div
      className={`${tone === "elevated" ? "bg-[#2C2C2E]" : "bg-[#1C1C1E]"} rounded-[14px] overflow-hidden ${className}`}
    >
      {children}
    </div>
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
  shape = "rounded",
  tone = "base",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  shape?: "rounded" | "pill";
  /** Use inside a sheet or an elevated card, where #1C1C1E would disappear. */
  tone?: "base" | "elevated";
}) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[rgba(235,235,245,0.4)] pointer-events-none"
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
        className={`w-full ${
          tone === "elevated" ? "bg-[#3A3A3C]" : "bg-[#1C1C1E]"
        } pl-10 pr-3 py-3 text-[17px] text-white placeholder-[rgba(235,235,245,0.4)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]/60 ${
          shape === "pill" ? "rounded-full" : "rounded-[12px]"
        }`}
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


/** Circular nav-bar button, as used for filter / add / avatar in the native app. */
export function NavCircleButton({
  onClick,
  href,
  label,
  tint = "white",
  children,
}: {
  onClick?: () => void;
  href?: string;
  label: string;
  tint?: "white" | "blue";
  children: ReactNode;
}) {
  const cls = `flex items-center justify-center w-9 h-9 rounded-full bg-[#1C1C1E] active:bg-[#2C2C2E] transition-colors ${
    tint === "blue" ? "text-[#0A84FF]" : "text-white"
  }`;
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} aria-label={label} className={cls}>
      {children}
    </button>
  );
}

/**
 * Card with a tinted header row — the native app's section card
 * ("Employee Info", "Office Assignment", …).
 */
export function CardSection({
  Icon,
  title,
  children,
  action,
  tone = "base",
}: {
  Icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** Use inside a sheet, whose own background is already #1C1C1E. */
  tone?: "base" | "elevated";
}) {
  return (
    <div className={`${tone === "elevated" ? "bg-[#2C2C2E]" : "bg-[#1C1C1E]"} rounded-[14px] p-4`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-[19px] h-[19px] text-[#0A84FF] shrink-0" />}
        <h3 className="text-[17px] font-semibold text-[#0A84FF] flex-1 min-w-0">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Full-width dropdown row rendered as a card, as on the native filter panel. */
export function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative bg-[#1C1C1E] rounded-[12px]">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full appearance-none bg-transparent px-4 py-3.5 pr-10 text-[17px] font-medium text-[#0A84FF] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-[#0A84FF]" />
      <span className="sr-only">{current?.label}</span>
    </div>
  );
}

/** Full-width primary capsule action, e.g. "Add New Employee". */
export function BigButton({
  onClick,
  href,
  children,
  tone = "blue",
}: {
  onClick?: () => void;
  href?: string;
  children: ReactNode;
  tone?: "blue" | "red";
}) {
  const cls = `w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-[14px] text-[17px] font-semibold transition-colors ${
    tone === "red"
      ? "bg-[#FF453A]/15 text-[#FF453A] active:bg-[#FF453A]/25"
      : "bg-[#0A84FF] text-white active:bg-[#0071E3]"
  }`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** Label + value row inside a CardSection. */
export function InfoRow({
  Icon,
  iconClass = "text-white",
  label,
  value,
  trailing,
}: {
  Icon?: ComponentType<{ className?: string }>;
  iconClass?: string;
  label: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      {Icon && <Icon className={`w-[19px] h-[19px] shrink-0 ${iconClass}`} />}
      <span className="text-[17px] text-white min-w-0 flex-1 break-words">{label}</span>
      {value && <span className="text-[15px] text-[rgba(235,235,245,0.6)] shrink-0">{value}</span>}
      {trailing}
    </div>
  );
}


/** Bold form label sitting above a field, as on the native Edit Warehouse sheet. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-[17px] font-semibold text-white mb-2">{children}</label>;
}

/** Inset form field fill, for a field sitting directly on a sheet. */
export const fieldCls =
  "w-full bg-[#2C2C2E] rounded-[10px] px-4 py-3 text-[17px] text-white placeholder-[rgba(235,235,245,0.3)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]";

/** Same fill one step up, for a field inside an elevated (#2C2C2E) card. */
export const fieldElevatedCls =
  "w-full bg-[#3A3A3C] rounded-[10px] px-4 py-3 text-[17px] text-white placeholder-[rgba(235,235,245,0.3)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]";

/** Compact gray label + field, as inside the native Edit Product cards. */
export function Field({
  label,
  children,
  hint,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div>
      <label className="block text-[15px] text-[rgba(235,235,245,0.6)] mb-1.5">{label}</label>
      {children}
      {hint && (
        <p className="text-[13px] text-[rgba(235,235,245,0.6)] mt-1.5 leading-snug">{hint}</p>
      )}
    </div>
  );
}

/** Single-select chip row — the native office assignment picker. */
export function ChipSelect({
  value,
  onChange,
  options,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string | null; label: string; dot?: string }[];
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value ?? "__none"}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[17px] transition-colors ${
              on
                ? "bg-[#0A84FF]/15 text-[#0A84FF] ring-1 ring-[#0A84FF]"
                : "text-white active:bg-white/5"
            }`}
          >
            {o.dot && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.dot }} />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Card of label + switch rows, as on the native product areas / pests lists. */
export function ToggleListGroup({
  items,
  selected,
  onToggle,
  tone = "base",
}: {
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  /** Use inside a sheet or an elevated card. */
  tone?: "base" | "elevated";
}) {
  return (
    <div className={`${tone === "elevated" ? "bg-[#3A3A3C]" : "bg-[#1C1C1E]"} rounded-[14px] px-4 py-1`}>
      {items.map((item, i) => (
        <div
          key={item}
          className={`flex items-center justify-between gap-3 py-2.5 ${
            i === items.length - 1 ? "" : "border-b border-[#38383A]/70"
          }`}
        >
          <span className="text-[17px] text-white min-w-0 flex-1 break-words">{item}</span>
          <Switch
            checked={selected.includes(item)}
            onChange={() => onToggle(item)}
            label={item}
          />
        </div>
      ))}
    </div>
  );
}

/** Explanatory card with an info glyph, as at the foot of the native Offices screen. */
export function InfoCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-[#1C1C1E] rounded-[14px] p-4 flex gap-3">
      <InfoGlyph />
      <div className="min-w-0">
        <h3 className="text-[17px] font-semibold text-white mb-1">{title}</h3>
        <p className="text-[15px] text-[rgba(235,235,245,0.6)] leading-snug">{children}</p>
      </div>
    </div>
  );
}

function InfoGlyph() {
  return (
    <svg
      className="w-[22px] h-[22px] text-[#0A84FF] shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.3" strokeWidth={1.7} />
      <path strokeLinecap="round" strokeWidth={1.9} d="M12 10.8v5.4" />
      <circle cx="12" cy="7.9" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Segmented control, picker rows and nav-bar pills — the vocabulary the
   native Bulk Edit, Purchase Orders and Log Purchase Order screens use.
   ────────────────────────────────────────────────────────────────────────── */

/** UISegmentedControl: a filled selected segment on a recessed track. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={`flex w-full bg-[#1C1C1E] rounded-[9px] p-[2px] ${size === "sm" ? "gap-[2px]" : "gap-[2px]"}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`flex-1 min-w-0 rounded-[7px] transition-colors truncate ${
              size === "sm" ? "py-1.5 text-[13px]" : "py-2 text-[15px]"
            } ${
              on
                ? "bg-[#636366] text-white font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                : "text-[rgba(235,235,245,0.6)] font-medium active:bg-white/[0.04]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Inline picker row: white label, blue value, up/down chevron — the native
 * wheel picker collapsed into a list row. A transparent native <select> sits
 * on top so the platform's own picker opens on tap.
 */
export function PickerRow({
  label,
  value,
  onChange,
  options,
  placeholder,
  last,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  last?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative pl-4">
      <div
        className={`flex items-center gap-3 pr-4 py-3.5 ${
          last ? "" : "border-b border-[#38383A]/70"
        }`}
      >
        <span className="text-[17px] text-white flex-1 min-w-0 truncate">{label}</span>
        <span className="text-[17px] text-[#0A84FF] truncate max-w-[55%]">
          {current?.label ?? placeholder ?? "Select"}
        </span>
        <UpDownChevronIcon className="w-[15px] h-[15px] text-[#0A84FF] shrink-0" />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={typeof label === "string" ? label : undefined}
        className="absolute inset-0 w-full h-full opacity-0 appearance-none cursor-pointer"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Capsule button that lives in the nav bar (Apply, Save, Logout). */
export function NavPillButton({
  onClick,
  children,
  disabled,
  tone = "blue",
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: "blue" | "white" | "red";
}) {
  const toneCls =
    tone === "white" ? "text-white font-semibold" : tone === "red" ? "text-[#FF453A]" : "text-[#0A84FF]";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-[#1C1C1E] rounded-full px-4 py-2 text-[15px] font-medium active:bg-[#2C2C2E] transition-colors disabled:opacity-40 ${toneCls}`}
    >
      {children}
    </button>
  );
}

/**
 * Plain-background list row with an inset hairline — the native pattern for
 * Bulk Edit items, the request queue and the purchase-order list, where rows
 * sit directly on the black background rather than inside a grouped card.
 */
export function PlainRow({
  children,
  onClick,
  href,
  last,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  last?: boolean;
}) {
  const cls = `w-full text-left py-3.5 ${
    last ? "" : "border-b border-[#38383A]/70"
  } ${onClick || href ? "active:bg-white/[0.04] transition-colors" : ""}`;
  if (href) {
    return (
      <Link href={href} className={`block ${cls}`}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} className={cls}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}

/**
 * Action row inside a grouped card: tinted glyph, coloured label, no chevron —
 * the native "Reassign Driver" / "Approve Request" shape. The glyph and the
 * label are tinted independently because the native app does exactly that
 * (blue archivebox next to a red "Retire Vehicle").
 */
export function ActionRow({
  Icon,
  label,
  onClick,
  iconTint = "blue",
  labelTint = "blue",
  disabled,
  last,
}: {
  Icon?: ComponentType<{ className?: string }>;
  label: ReactNode;
  onClick?: () => void;
  iconTint?: Tint;
  labelTint?: Tint | "white";
  disabled?: boolean;
  last?: boolean;
}) {
  const labelCls = labelTint === "white" ? "text-white" : TINTS[labelTint].text;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-stretch pl-4 text-left active:bg-white/[0.06] transition-colors disabled:opacity-40"
    >
      {Icon && (
        <span className="flex items-center pr-3 shrink-0">
          <Icon className={`w-[22px] h-[22px] ${TINTS[iconTint].text}`} />
        </span>
      )}
      <span
        className={`flex-1 min-w-0 flex items-center pr-4 py-3.5 ${
          last ? "" : "border-b border-[#38383A]/70"
        }`}
      >
        <span className={`flex-1 min-w-0 text-[17px] leading-snug ${labelCls}`}>{label}</span>
      </span>
    </button>
  );
}

/** Static label / value row inside a grouped card. */
export function DetailRow({
  label,
  value,
  last,
  nowrap,
}: {
  label: ReactNode;
  value: ReactNode;
  last?: boolean;
  /** Keep the value on one line — timestamps read badly broken across two. */
  nowrap?: boolean;
}) {
  return (
    <div className="pl-4">
      <div
        className={`flex items-baseline gap-3 pr-4 py-3.5 ${
          last ? "" : "border-b border-[#38383A]/70"
        }`}
      >
        <span className="text-[17px] text-white shrink-0">{label}</span>
        <span
          className={`flex-1 min-w-0 text-[17px] text-[rgba(235,235,245,0.6)] text-right ${
            nowrap ? "whitespace-nowrap truncate" : "break-words"
          }`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

/** Stacked caption + value block inside a grouped card (the "Problem" row). */
export function StackedRow({
  label,
  value,
  last,
}: {
  label: ReactNode;
  value: ReactNode;
  last?: boolean;
}) {
  return (
    <div className="pl-4">
      <div className={`pr-4 py-3 ${last ? "" : "border-b border-[#38383A]/70"}`}>
        <p className="text-[13px] text-[rgba(235,235,245,0.6)] mb-1">{label}</p>
        <p className="text-[17px] text-white leading-snug break-words">{value}</p>
      </div>
    </div>
  );
}
