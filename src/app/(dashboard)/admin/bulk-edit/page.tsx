"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Warehouse, FirestoreInventoryItem } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdjustAction = "Set" | "Add" | "Subtract";

interface ItemRow {
  id: string;
  name: string;
  category: string;
  currentQty: number;
  unit: string;
  productID?: string;
  inputValue: string;
  action: AdjustAction;
}

interface PendingChange {
  productID?: string;
  name: string;
  unit: string;
  originalQuantity: number;
  newQuantity: number;
  changeAmount: number;
  action: AdjustAction;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeNewQty(current: number, inputValue: string, action: AdjustAction): number | null {
  const v = parseFloat(inputValue);
  if (isNaN(v) || v < 0) return null;
  switch (action) {
    case "Add":
      return current + v;
    case "Subtract":
      return Math.max(0, current - v);
    case "Set":
      return v;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BulkEditPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseID, setSelectedWarehouseID] = useState<string>("");
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [notes, setNotes] = useState("");
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Admin guard
  useEffect(() => {
    if (user && !user.isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // Load warehouses
  useEffect(() => {
    if (!user?.companyID || !user.isAdmin) return;
    loadWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadWarehouses() {
    if (!user?.companyID) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "warehouses"));
    const whs: Warehouse[] = snap.docs.map((d) => ({ id: d.id, name: d.data().name as string }));
    setWarehouses(whs);
    setLoadingWarehouses(false);
  }

  // Load inventory when warehouse changes
  useEffect(() => {
    if (!selectedWarehouseID || !user?.companyID) return;
    loadInventory(selectedWarehouseID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseID]);

  async function loadInventory(warehouseID: string) {
    if (!user?.companyID) return;
    setLoadingItems(true);
    setRows([]);
    setNotes("");
    setSuccessMessage(null);
    setError(null);

    const snap = await getDocs(
      collection(db, "companies", user.companyID, "warehouses", warehouseID, "inventory")
    );
    const items: ItemRow[] = snap.docs
      .map((d) => {
        const data = d.data() as FirestoreInventoryItem;
        return {
          id: d.id,
          name: data.name ?? d.id,
          category: data.category ?? "",
          currentQty: typeof data.quantity === "number" ? data.quantity : 0,
          unit: data.unit ?? "",
          productID: data.productID,
          inputValue: "",
          action: "Set" as AdjustAction,
        };
      })
      .sort((a, b) => {
        const catCmp = a.category.localeCompare(b.category);
        return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
      });

    setRows(items);
    setLoadingItems(false);
  }

  function updateRow(id: string, patch: Partial<Pick<ItemRow, "inputValue" | "action">>) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              ...patch,
              // Reset inputValue when action changes if it was already set
              ...(patch.action && patch.action !== r.action ? { inputValue: r.inputValue } : {}),
            }
          : r
      )
    );
    setSuccessMessage(null);
    setError(null);
  }

  // Build pending changes map
  const pendingChanges = useMemo<Map<string, PendingChange>>(() => {
    const map = new Map<string, PendingChange>();
    for (const row of rows) {
      if (row.inputValue.trim() === "") continue;
      const newQty = computeNewQty(row.currentQty, row.inputValue, row.action);
      if (newQty === null) continue;
      if (newQty === row.currentQty && row.action !== "Set") continue;
      // For "Set", only flag if value actually differs
      if (row.action === "Set" && newQty === row.currentQty) continue;
      map.set(row.id, {
        productID: row.productID,
        name: row.name,
        unit: row.unit,
        originalQuantity: row.currentQty,
        newQuantity: newQty,
        changeAmount: Math.abs(newQty - row.currentQty),
        action: row.action,
      });
    }
    return map;
  }, [rows]);

  const canSubmit = pendingChanges.size > 0 && notes.trim().length > 0 && !submitting;

  async function handleApply() {
    if (!canSubmit || !user?.companyID || !selectedWarehouseID) return;
    setSubmitting(true);
    setError(null);

    const cid = user.companyID;
    const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseID);
    const warehouseName = selectedWarehouse?.name ?? selectedWarehouseID;

    try {
      const batch = writeBatch(db);

      // Patch each changed inventory doc
      for (const [itemID, change] of pendingChanges) {
        const itemRef = doc(db, "companies", cid, "warehouses", selectedWarehouseID, "inventory", itemID);
        batch.update(itemRef, { quantity: change.newQuantity });
      }

      await batch.commit();

      // Build audit log payload
      const changesRecord: Record<
        string,
        {
          productID?: string;
          name: string;
          unit: string;
          originalQuantity: number;
          newQuantity: number;
          changeAmount: number;
          action: string;
        }
      > = {};
      for (const [itemID, change] of pendingChanges) {
        changesRecord[itemID] = {
          ...(change.productID ? { productID: change.productID } : {}),
          name: change.name,
          unit: change.unit,
          originalQuantity: change.originalQuantity,
          newQuantity: change.newQuantity,
          changeAmount: change.changeAmount,
          action: change.action,
        };
      }

      await addDoc(collection(db, "companies", cid, "bulkInventoryEdits"), {
        createdAt: serverTimestamp(),
        createdByUID: user.uid,
        createdByName: user.displayName ?? user.email ?? "",
        warehouseID: selectedWarehouseID,
        warehouseName,
        companyID: cid,
        notes: notes.trim(),
        changes: changesRecord,
      });

      // Update local rows to reflect new quantities and reset inputs
      setRows((prev) =>
        prev.map((r) => {
          const change = pendingChanges.get(r.id);
          if (!change) return r;
          return { ...r, currentQty: change.newQuantity, inputValue: "", action: "Set" };
        })
      );
      setNotes("");
      setSuccessMessage(`${pendingChanges.size} item${pendingChanges.size !== 1 ? "s" : ""} updated successfully.`);
    } catch (err) {
      console.error("Bulk edit error:", err);
      setError("Failed to apply changes. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user?.isAdmin) return null;

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm">
          Admin
        </Link>
        <svg
          className="w-3 h-3 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm text-white">Manual Adjustment</span>
      </div>

      {/* Header */}
      <div className="mt-4 mb-6">
        <h1 className="ios-large-title text-white">Manual Inventory Adjustment</h1>
        <p className="text-[rgba(235,235,245,0.6)] mt-1 text-[15px]">
          Directly add, subtract, or set quantities for items in a warehouse
        </p>
      </div>

      {/* Warehouse selector */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Warehouse
        </label>
        {loadingWarehouses ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner size={16} />
            <span className="text-sm text-gray-500">Loading warehouses…</span>
          </div>
        ) : (
          <select
            value={selectedWarehouseID}
            onChange={(e) => setSelectedWarehouseID(e.target.value)}
            className="w-full sm:w-auto bg-[#1C1C1E] rounded-[12px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0A84FF] transition-colors appearance-none min-w-[220px]"
          >
            <option value="">Select a warehouse…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id!}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Items table */}
      {selectedWarehouseID && (
        <>
          {loadingItems ? (
            <div className="flex items-center justify-center py-16 bg-[#1C1C1E] rounded-[14px]">
              <Spinner size={28} />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-[#1C1C1E] rounded-[14px] mb-5">
              <div className="w-12 h-12 rounded-full bg-[#3A3A3C] flex items-center justify-center mb-3">
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <p className="text-gray-400 font-medium">No inventory items</p>
              <p className="text-gray-600 text-sm mt-1">This warehouse has no inventory yet</p>
            </div>
          ) : (
            <>
              {/* Pending count badge */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Items ({rows.length})
                </p>
                {pendingChanges.size > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20">
                    {pendingChanges.size} change{pendingChanges.size !== 1 ? "s" : ""} pending
                  </span>
                )}
              </div>

              {/* Column headers */}
              <div className="hidden sm:grid grid-cols-12 px-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-5">Product</div>
                <div className="col-span-2 text-right">Current</div>
                <div className="col-span-2 text-center">Action</div>
                <div className="col-span-3 text-right">New Value</div>
              </div>

              <div className="bg-[#1C1C1E] rounded-[14px] overflow-hidden divide-y divide-[#38383A] mb-5">
                {rows.map((row) => {
                  const isPending = pendingChanges.has(row.id);
                  const pendingChange = pendingChanges.get(row.id);

                  return (
                    <div
                      key={row.id}
                      className={`grid grid-cols-1 sm:grid-cols-12 gap-2 px-4 py-3.5 transition-colors ${
                        isPending
                          ? "bg-[#0A84FF]/[0.04] border-l-2 border-l-[#0A84FF]/40"
                          : "hover:bg-white/[0.015]"
                      }`}
                    >
                      {/* Product info */}
                      <div className="sm:col-span-5 flex flex-col justify-center min-w-0">
                        <p className="text-sm font-medium text-white truncate">{row.name}</p>
                        {row.category && (
                          <p className="text-xs text-gray-500 mt-0.5">{row.category}</p>
                        )}
                      </div>

                      {/* Current qty */}
                      <div className="sm:col-span-2 flex sm:justify-end items-center gap-1">
                        <span className="text-xs text-gray-500 sm:hidden">Current:</span>
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            isPending ? "text-gray-400 line-through" : "text-white"
                          }`}
                        >
                          {row.currentQty}
                        </span>
                        {row.unit && (
                          <span className="text-xs text-gray-500">{row.unit}</span>
                        )}
                        {isPending && pendingChange && (
                          <span className="text-sm font-semibold text-[#0A84FF] tabular-nums ml-1.5">
                            → {pendingChange.newQuantity}
                          </span>
                        )}
                      </div>

                      {/* Action dropdown */}
                      <div className="sm:col-span-2 flex sm:justify-center items-center">
                        <select
                          value={row.action}
                          onChange={(e) =>
                            updateRow(row.id, { action: e.target.value as AdjustAction })
                          }
                          className="w-full bg-[#000000] border border-[#2C2C2E] rounded-lg px-2 py-2 sm:py-1.5 text-xs text-white focus:outline-none focus:border-[#0A84FF] transition-colors appearance-none"
                        >
                          <option value="Set">Set</option>
                          <option value="Add">Add</option>
                          <option value="Subtract">Subtract</option>
                        </select>
                      </div>

                      {/* Input */}
                      <div className="sm:col-span-3 flex items-center justify-end gap-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder={row.action === "Set" ? String(row.currentQty) : "0"}
                          value={row.inputValue}
                          onChange={(e) => updateRow(row.id, { inputValue: e.target.value })}
                          inputMode="decimal"
                          className={`w-full sm:max-w-[100px] bg-[#000000] border rounded-lg px-3 py-2 sm:py-1.5 text-sm text-white text-right placeholder-gray-600 focus:outline-none transition-colors ${
                            isPending
                              ? "border-[#0A84FF]/50 focus:border-[#0A84FF]"
                              : "border-[#2C2C2E] focus:border-[#0A84FF]"
                          }`}
                        />
                        {row.unit && (
                          <span className="text-xs text-gray-500 w-8 shrink-0">{row.unit}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Notes + Submit */}
              <div className="bg-[#1C1C1E] rounded-[14px] p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Notes / Reason{" "}
                    <span className="text-rose-500 font-normal normal-case">(required)</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Explain why these quantities are being adjusted…"
                    className="w-full bg-[#000000] border border-[#2C2C2E] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF] transition-colors resize-none h-20"
                  />
                </div>

                {/* Feedback messages */}
                {successMessage && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-400/10 border border-emerald-400/20 rounded-lg">
                    <svg
                      className="w-4 h-4 text-emerald-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <p className="text-sm text-emerald-400">{successMessage}</p>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-rose-400/10 border border-rose-400/20 rounded-lg">
                    <svg
                      className="w-4 h-4 text-rose-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm text-rose-400">{error}</p>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                  <p className="text-xs text-gray-500">
                    {pendingChanges.size > 0
                      ? `${pendingChanges.size} item${pendingChanges.size !== 1 ? "s" : ""} will be updated`
                      : "No changes pending"}
                  </p>
                  <button
                    onClick={handleApply}
                    disabled={!canSubmit}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Spinner size={14} />
                        Applying…
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Apply Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Prompt to select warehouse */}
      {!selectedWarehouseID && !loadingWarehouses && warehouses.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-[#1C1C1E] rounded-[14px] border-dashed">
          <div className="w-12 h-12 rounded-full bg-[#3A3A3C] flex items-center justify-center mb-3">
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </div>
          <p className="text-gray-400 font-medium">Select a warehouse to begin</p>
          <p className="text-gray-600 text-sm mt-1">
            Choose a warehouse above to load its inventory
          </p>
        </div>
      )}
    </div>
  );
}
