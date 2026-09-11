"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { NavBarRight } from "@/components/layout/NavBarSlot";
import {
  LargeTitle,
  CaptionHeader,
  Group,
  PickerRow,
  Switch,
  NavPillButton,
  TextAction,
} from "@/components/ui/ios";
import {
  BoxIcon,
  CalendarIcon,
  TrashIcon,
  PlusCircleIcon,
  ChevronRightIcon,
} from "@/components/layout/nav";
import type { Product, Warehouse } from "@/lib/types";

interface LineItem {
  key: number;
  productName: string;
  quantity: string;
  unit: string;
  unitCost: string;
}

let nextKey = 1;
function blankItem(): LineItem {
  return { key: nextKey++, productName: "", quantity: "1", unit: "", unitCost: "" };
}

/** Inline text field that fills a grouped list row, iOS "value entry" style. */
function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  last,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal";
  last?: boolean;
}) {
  return (
    <div className="pl-4">
      <div className={`pr-4 py-3 ${last ? "" : "border-b border-[#38383A]/70"}`}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? label}
          aria-label={label}
          inputMode={inputMode}
          className="w-full bg-transparent text-[17px] text-white placeholder-[rgba(235,235,245,0.3)] focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function LogPurchaseOrderPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorName, setVendorName] = useState("");
  const [vendorRef, setVendorRef] = useState("");
  const [warehouseID, setWarehouseID] = useState("");
  const [hasExpectedDate, setHasExpectedDate] = useState(false);
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([blankItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !user.isAdmin) router.replace("/orders");
  }, [user, router]);

  useEffect(() => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    Promise.all([
      getDocs(collection(db, "companies", cid, "warehouses")),
      getDocs(collection(db, "companies", cid, "products")),
    ]).then(([whSnap, pSnap]) => {
      setWarehouses(
        whSnap.docs
          .map((d) => ({ id: d.id, name: d.data().name as string }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setProducts(
        pSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }))
          .filter((p) => !p.isRetired)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setLoading(false);
    });
  }, [user]);

  function updateItem(key: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function selectProduct(key: number, productName: string) {
    const p = products.find((p) => p.name === productName);
    updateItem(key, {
      productName,
      unit: p?.unit ?? "",
      unitCost: p?.unitCost !== undefined ? String(p.unitCost) : "",
    });
  }

  const validItems = useMemo(
    () => items.filter((i) => i.productName.trim() && parseFloat(i.quantity) > 0),
    [items]
  );

  const canSave = Boolean(vendorName.trim()) && Boolean(warehouseID) && validItems.length > 0 && !saving;

  async function handleSave() {
    if (!canSave || !user?.companyID) return;
    setSaving(true);
    setError(null);
    try {
      const cid = user.companyID;
      const mapped = validItems.map((i) => ({
        productName: i.productName.trim(),
        quantity: parseFloat(i.quantity),
        unit: i.unit.trim(),
        ...(i.unitCost.trim() && !isNaN(parseFloat(i.unitCost))
          ? { unitCost: parseFloat(i.unitCost) }
          : {}),
      }));
      const total = mapped.reduce((sum, i) => sum + (i.unitCost ?? 0) * i.quantity, 0);
      const wh = warehouses.find((w) => w.id === warehouseID);

      await addDoc(collection(db, "companies", cid, "purchaseOrders"), {
        vendorName: vendorName.trim(),
        status: "Pending",
        items: mapped,
        warehouseID,
        warehouseName: wh?.name ?? "",
        createdAt: serverTimestamp(),
        createdByUID: user.uid,
        createdByName: user.displayName ?? user.email ?? "",
        ...(total > 0 ? { totalCost: total } : {}),
        ...(vendorRef.trim() ? { vendorRef: vendorRef.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(hasExpectedDate && expectedDate ? { expectedDate: new Date(expectedDate) } : {}),
      });

      router.push("/orders");
    } catch (err) {
      console.error("Log purchase order error:", err);
      setError("Failed to save the order. Please try again.");
      setSaving(false);
    }
  }

  if (!user?.isAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-3xl">
      <NavBarRight>
        <NavPillButton onClick={handleSave} disabled={!canSave} tone="white">
          {saving ? "Saving…" : "Save"}
        </NavPillButton>
      </NavBarRight>

      <LargeTitle title="Log Purchase Order" />

      <CaptionHeader>Purchase Order</CaptionHeader>
      <Group>
        <FieldRow label="Vendor name" value={vendorName} onChange={setVendorName} />
        <FieldRow label="Order ID #" value={vendorRef} onChange={setVendorRef} />
        <PickerRow
          label="Warehouse"
          value={warehouseID}
          onChange={setWarehouseID}
          placeholder="Select a warehouse"
          options={warehouses.map((w) => ({ value: w.id!, label: w.name }))}
        />
        <div className="pl-4">
          <div
            className={`flex items-center gap-3 pr-4 py-3 ${
              hasExpectedDate ? "border-b border-[#38383A]/70" : ""
            }`}
          >
            <CalendarIcon className="w-[20px] h-[20px] text-[#0A84FF] shrink-0" />
            <span className="flex-1 min-w-0 text-[17px] text-white">Expected Date</span>
            <Switch
              checked={hasExpectedDate}
              onChange={(v) => {
                setHasExpectedDate(v);
                if (v && !expectedDate) {
                  setExpectedDate(new Date().toISOString().slice(0, 10));
                }
              }}
              label="Expected date"
            />
          </div>
          {hasExpectedDate && (
            <div className="pr-4 py-3 border-b border-[#38383A]/70">
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                aria-label="Expected delivery date"
                className="w-full bg-transparent text-[17px] text-[#0A84FF] focus:outline-none"
              />
            </div>
          )}
        </div>
        <FieldRow label="Notes (optional)" value={notes} onChange={setNotes} last />
      </Group>

      {/* Line items */}
      <div className="flex items-center justify-between mt-6 mb-2 -mr-2">
        <CaptionHeader>Line Items</CaptionHeader>
        <div className="-mt-2">
          <TextAction tone="red" onClick={() => setItems([blankItem()])}>
            Clear all
          </TextAction>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Group key={item.key} className="p-4">
            {/* Product picker */}
            <div className="relative flex items-center gap-2.5">
              <BoxIcon className="w-[20px] h-[20px] text-[#0A84FF] shrink-0" />
              <span className="flex-1 min-w-0 text-[17px] text-[#0A84FF] truncate">
                {warehouseID
                  ? (item.productName || "Select a product")
                  : "Select warehouse first"}
              </span>
              <ChevronRightIcon className="w-[14px] h-[14px] text-[rgba(235,235,245,0.3)] shrink-0" />
              <select
                value={item.productName}
                disabled={!warehouseID}
                onChange={(e) => selectProduct(item.key, e.target.value)}
                aria-label="Product"
                className="absolute inset-y-0 left-0 right-10 opacity-0 appearance-none disabled:pointer-events-none cursor-pointer"
              >
                <option value="">Select a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                    {p.unit ? ` (${p.unit})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  setItems((prev) =>
                    prev.length > 1 ? prev.filter((i) => i.key !== item.key) : [blankItem()]
                  )
                }
                aria-label="Remove line item"
                className="relative z-10 shrink-0 p-1 -mr-1 text-[#FF453A] active:opacity-60 transition-opacity"
              >
                <TrashIcon className="w-[19px] h-[19px]" />
              </button>
            </div>

            <div className="flex items-end gap-3 mt-3">
              <div className="w-[110px] shrink-0">
                <p className="text-[13px] text-[rgba(235,235,245,0.6)] mb-1.5">Qty Ordered</p>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                  aria-label="Quantity ordered"
                  className="w-full bg-[#2C2C2E] rounded-full px-4 py-2 text-[17px] text-white text-center focus:outline-none focus:ring-1 focus:ring-[#0A84FF]"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[rgba(235,235,245,0.6)] mb-1.5">Unit</p>
                <input
                  value={item.unit}
                  onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                  placeholder="—"
                  aria-label="Unit"
                  className="w-full bg-[#2C2C2E] rounded-full px-4 py-2 text-[17px] text-white placeholder-[rgba(235,235,245,0.3)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[rgba(235,235,245,0.6)] mb-1.5">Unit Cost</p>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={item.unitCost}
                  onChange={(e) => updateItem(item.key, { unitCost: e.target.value })}
                  placeholder="—"
                  aria-label="Unit cost"
                  className="w-full bg-[#2C2C2E] rounded-full px-4 py-2 text-[17px] text-white text-center placeholder-[rgba(235,235,245,0.3)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]"
                />
              </div>
            </div>
          </Group>
        ))}
      </div>

      <div className="mt-3 -ml-2">
        <TextAction
          onClick={() => setItems((prev) => [...prev, blankItem()])}
          icon={<PlusCircleIcon className="w-[20px] h-[20px]" />}
        >
          Add
        </TextAction>
      </div>

      {error && <p className="text-[15px] text-[#FF453A] mt-4 px-1">{error}</p>}

      {!canSave && !saving && (
        <p className="text-[13px] text-[rgba(235,235,245,0.6)] mt-4 px-1">
          A vendor, a warehouse and at least one line item are needed before saving.
        </p>
      )}
    </div>
  );
}
