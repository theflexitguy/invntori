"use client";

import { useEffect, type ReactNode } from "react";

type Size = "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
};

/**
 * One dialog for both form factors: a bottom sheet on phones (thumb-reachable,
 * safe-area aware, never taller than the visible viewport) and a centered
 * dialog from `sm` up.
 *
 * `footer` stays pinned below the scrolling body so primary actions are always
 * reachable — critical when the on-screen keyboard eats half the screen.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
  zIndex = 50,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: Size;
  zIndex?: number;
}) {
  // Lock the page behind the sheet and close on Escape.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-sheet w-full ${sizes[size]} bg-[#1a1f2e] border border-[#2a2f3e] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh] sm:m-4 overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle — phones only */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="h-1 w-10 rounded-full bg-white/15" />
        </div>

        {title !== undefined && (
          <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-3 sm:pt-6 pb-4 shrink-0">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-white leading-tight break-words">
                {title}
              </h3>
              {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 -mr-2 -mt-1 p-2 rounded-lg text-gray-500 hover:text-white active:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto scroll-touch px-5 sm:px-6 pb-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-[#2a2f3e] px-5 sm:px-6 py-4 pb-[calc(1rem+var(--safe-bottom))] sm:pb-4 bg-[#1a1f2e]">
            {footer}
          </div>
        )}
        {!footer && <div className="shrink-0 pb-[var(--safe-bottom)] sm:pb-0" />}
      </div>
    </div>
  );
}

/** Cancel / confirm pair sized for thumbs. */
export function SheetActions({
  onCancel,
  cancelLabel = "Cancel",
  children,
}: {
  onCancel: () => void;
  cancelLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onCancel}
        className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium border border-[#2a2f3e] text-gray-400 hover:text-white active:bg-white/5 transition-colors"
      >
        {cancelLabel}
      </button>
      {children}
    </div>
  );
}

/** Primary action button styled to match the app's accent treatment. */
export function PrimaryButton({
  onClick,
  disabled,
  tone = "blue",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone?: "blue" | "green" | "red" | "amber";
  children: ReactNode;
}) {
  const tones = {
    blue: "bg-[#35B2FF]/15 text-[#35B2FF] border-[#35B2FF]/20 hover:bg-[#35B2FF]/25",
    green: "bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25",
    red: "bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/25",
    amber: "bg-amber-400/15 text-amber-400 border-amber-400/20 hover:bg-amber-400/25",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
