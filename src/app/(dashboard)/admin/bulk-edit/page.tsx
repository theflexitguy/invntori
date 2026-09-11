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
import { useRouter } from "next/navigation";
import { NavBarRight } from "@/components/layout/NavBarSlot";
import {
  LargeTitle,
  CaptionHeader,
  Group,
  PickerRow,
  SearchField,
  SegmentedControl,
  NavPillButton,
} from "@/components/ui/ios";
import type { Warehouse, FirestoreInventoryItem } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdjustAction = "Add" | "Subtract" | "Set";

const ACTIONS: { value: AdjustAction; label: string }[] = [
  { value: "Add", label: "Add" },
  { value: "Subtract", label: "Subtract" },
  { value: "Set", label: "Set" },
];

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
  const [search, setSearch] = useState("");
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
    const whs: Warehouse[] = snap.docs
      .map((d) => ({ id: d.id, name: d.data().name as string }))
      .sort((a, b) => a.name.localeCompare(b.name));
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
    setSearch("");
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
          action: "Add" as AdjustAction,
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
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
      if (newQty === row.currentQty) continue;
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

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );
  }, [rows, search]);

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

      for (const [itemID, change] of pendingChanges) {
        const itemRef = doc(db, "companies", cid, "warehouses", selectedWarehouseID, "inventory", itemID);
        batch.update(itemRef, { quantity: change.newQuantity });
      }

      await batch.commit();

      // Audit log, exactly as the native app records it
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

      const applied = pendingChanges.size;
      setRows((prev) =>
        prev.map((r) => {
          const change = pendingChanges.get(r.id);
          if (!change) return r;
          return { ...r, currentQty: change.newQuantity, inputValue: "", action: "Add" };
        })
      );
      setNotes("");
      setSuccessMessage(`${applied} item${applied !== 1 ? "s" : ""} updated.`);
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
      <NavBarRight>
        <NavPillButton onClick={handleApply} disabled={!canSubmit} tone="blue">
          {submitting ? "Applying…" : "Apply"}
        </NavPillButton>
      </NavBarRight>

      <LargeTitle title="Bulk Inventory Edit" />

      {/* Warehouse */}
      <CaptionHeader>Select Warehouse</CaptionHeader>
      {loadingWarehouses ? (
        <Group className="px-4 py-4 flex items-center gap-2">
          <Spinner size={16} />
          <span className="text-[15px] text-[rgba(235,235,245,0.6)]">Loading warehouses…</span>
        </Group>
      ) : (
        <Group>
          <PickerRow
            label="Warehouse"
            value={selectedWarehouseID}
            onChange={setSelectedWarehouseID}
            placeholder="Select a warehouse"
            options={warehouses.map((w) => ({ value: w.id!, label: w.name }))}
            last
          />
        </Group>
      )}

      {selectedWarehouseID && !loadingItems && rows.length > 0 && (
        <>
          {/* Reason — the audit record the native app writes requires it */}
          <div className="mt-6">
            <CaptionHeader>Reason for Adjustment</CaptionHeader>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSuccessMessage(null);
              }}
              placeholder="Why are these quantities changing?"
              className="w-full bg-[#1C1C1E] rounded-[12px] px-4 py-3 text-[17px] text-white placeholder-[rgba(235,235,245,0.3)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF] resize-none h-20"
            />
            <p className="text-[13px] text-[rgba(235,235,245,0.6)] mt-1.5 px-1">
              {pendingChanges.size === 0
                ? "Enter a quantity on at least one item to enable Apply."
                : notes.trim()
                  ? `${pendingChanges.size} item${pendingChanges.size !== 1 ? "s" : ""} will be updated.`
                  : "A reason is required before changes can be applied."}
            </p>
          </div>

          {/* Items */}
          <div className="mt-6 mb-3">
            <CaptionHeader>Inventory Items</CaptionHeader>
            <SearchField value={search} onChange={setSearch} placeholder="Search inventory..." />
          </div>

          {successMessage && (
            <p className="text-[15px] text-[#30D158] mb-3 px-1">{successMessage}</p>
          )}
          {error && <p className="text-[15px] text-[#FF453A] mb-3 px-1">{error}</p>}

          {visibleRows.length === 0 ? (
            <p className="text-[15px] text-[rgba(235,235,245,0.6)] py-8 text-center">
              No items match “{search}”.
            </p>
          ) : (
            <div>
              {visibleRows.map((row, i) => {
                const change = pendingChanges.get(row.id);
                return (
                  <div
                    key={row.id}
                    className={`py-3.5 ${
                      i === visibleRows.length - 1 ? "" : "border-b border-[#38383A]/70"
                    }`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="flex-1 min-w-0 text-[17px] font-semibold text-white break-words">
                        {row.name}
                      </span>
                      <span className="text-[15px] text-[rgba(235,235,245,0.6)] shrink-0">
                        Current: {row.currentQty}
                        {row.unit ? ` ${row.unit}` : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2.5">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="Qty"
                        value={row.inputValue}
                        onChange={(e) => updateRow(row.id, { inputValue: e.target.value })}
                        aria-label={`Quantity for ${row.name}`}
                        className={`w-[86px] shrink-0 bg-[#1C1C1E] rounded-[9px] px-3 py-2 text-[15px] text-white placeholder-[rgba(235,235,245,0.3)] focus:outline-none focus:ring-1 ${
                          change ? "ring-1 ring-[#0A84FF]" : "focus:ring-[#0A84FF]"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <SegmentedControl
                          value={row.action}
                          onChange={(v) => updateRow(row.id, { action: v })}
                          options={ACTIONS}
                          size="sm"
                        />
                      </div>
                    </div>

                    {change && (
                      <p className="text-[13px] text-[#0A84FF] mt-2">
                        {change.originalQuantity} → {change.newQuantity}
                        {row.unit ? ` ${row.unit}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {selectedWarehouseID && loadingItems && (
        <div className="flex items-center justify-center py-16">
          <Spinner size={28} />
        </div>
      )}

      {selectedWarehouseID && !loadingItems && rows.length === 0 && (
        <p className="text-[15px] text-[rgba(235,235,245,0.6)] py-16 text-center">
          This warehouse has no inventory yet.
        </p>
      )}

      {!selectedWarehouseID && !loadingWarehouses && (
        <p className="text-[15px] text-[rgba(235,235,245,0.6)] py-16 text-center">
          Choose a warehouse to load its inventory.
        </p>
      )}
    </div>
  );
}
