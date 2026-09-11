"use client";

import type { ReactNode } from "react";
import { Sheet } from "./Sheet";

/**
 * Modal editor with the native app's Cancel / Save header and a large title —
 * the shape used by Edit Warehouse, Edit Product and Edit Employee.
 *
 * The header sticks, so Save stays reachable once the form scrolls; the title
 * shrinks into the bar the same way it does on device.
 */
export function FormSheet({
  title,
  onCancel,
  onSave,
  saveLabel = "Save",
  saveDisabled,
  saving,
  children,
  size = "lg",
  scrolled,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  saving?: boolean;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** When true the title collapses into the header bar. */
  scrolled?: boolean;
}) {
  return (
    <Sheet size={size} onClose={onCancel}>
      <div className="sticky top-0 z-10 -mx-5 sm:-mx-6 px-5 sm:px-6 pt-1 pb-3 bg-[#1C1C1E] flex items-center gap-3">
        <button
          onClick={onCancel}
          className="bg-[#2C2C2E] rounded-full px-4 py-2 text-[15px] font-medium text-[#FF453A] active:opacity-70 transition-opacity shrink-0"
        >
          Cancel
        </button>
        <span
          className={`flex-1 min-w-0 text-center text-[17px] font-semibold text-white truncate transition-opacity ${
            scrolled ? "opacity-100" : "opacity-0"
          }`}
        >
          {title}
        </span>
        <button
          onClick={onSave}
          disabled={saveDisabled || saving}
          className="bg-[#2C2C2E] rounded-full px-4 py-2 text-[15px] font-semibold text-white active:opacity-70 transition-opacity disabled:opacity-40 shrink-0"
        >
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>

      <h2 className="ios-large-title text-white mb-4">{title}</h2>
      {children}
    </Sheet>
  );
}


/**
 * Read-and-act modal with the native "Close" header — the shape used by the
 * Repair Request review sheet. Unlike FormSheet the title never collapses,
 * because there is no Save button competing with it.
 */
export function DetailSheet({
  title,
  onClose,
  closeLabel = "Close",
  children,
  size = "lg",
}: {
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <Sheet size={size} onClose={onClose}>
      <div className="sticky top-0 z-10 -mx-5 sm:-mx-6 px-5 sm:px-6 pt-1 pb-3 bg-[#1C1C1E] flex items-center gap-3">
        <button
          onClick={onClose}
          className="bg-[#2C2C2E] rounded-full px-4 py-2 text-[15px] font-medium text-white active:opacity-70 transition-opacity shrink-0"
        >
          {closeLabel}
        </button>
        <span className="flex-1 min-w-0 text-center text-[17px] font-semibold text-white truncate">
          {title}
        </span>
        {/* Balances the Close pill so the title stays optically centred */}
        <span aria-hidden className="invisible shrink-0 px-4 py-2 text-[15px] font-medium">
          {closeLabel}
        </span>
      </div>

      {children}
    </Sheet>
  );
}
