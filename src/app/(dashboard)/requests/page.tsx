"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Sheet, SheetActions, PrimaryButton } from "@/components/ui/Sheet";
import { PlusIcon } from "@/components/ui/PageHeader";
import {
  LargeTitle, TextAction, SelectRow, BigButton, NavCircleButton,
} from "@/components/ui/ios";
import { NavBarLeft, NavBarRight } from "@/components/layout/NavBarSlot";
import { ChevronDownIcon, PersonCircleIcon } from "@/components/layout/nav";
import type { InventoryRequest, Warehouse, Product } from "@/lib/types";

const DATE_RANGES = [
  { key: "7", label: "Last 7 Days" },
  { key: "30", label: "Last 30 Days" },
  { key: "90", label: "Last 90 Days" },
  { key: "all", label: "All Time" },
] as const;
type DateRange = (typeof DATE_RANGES)[number]["key"];

const STATUS_TABS = ["All", "Pending", "Completed", "Returned"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function RequestsPage() {
  const { user, signOut } = useAuth();
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [tab, setTab] = useState<StatusTab>("Pending");
  const [filterWarehouse, setFilterWarehouse] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filterProduct, setFilterProduct] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [reqSnap, whSnap] = await Promise.all([
      getDocs(query(collection(db, "companies", cid, "inventoryRequests"), orderBy("timestamp", "desc"))),
      getDocs(collection(db, "companies", cid, "warehouses")),
    ]);
    setRequests(reqSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryRequest, "id">) })));
    setWarehouses(whSnap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    setLoading(false);
  }

  async function markComplete(id: string) {
    if (!user?.companyID) return;
    setUpdating(id);
    try {
      await updateDoc(doc(db, "companies", user.companyID, "inventoryRequests", id), {
        status: "Completed",
        completedAt: serverTimestamp(),
        completedBy: user.uid,
        completedByName: user.displayName ?? user.email ?? "",
      });
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "Completed" as const } : r));
    } finally {
      setUpdating(null);
    }
  }

  async function submitRequest(warehouseID: string, items: { productID: string; productName: string; quantity: number; unit: string }[], notes: string) {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const docRef = await addDoc(collection(db, "companies", cid, "inventoryRequests"), {
      submittedBy: user.displayName ?? user.email ?? "",
      submittedByUID: user.uid,
      status: "Pending",
      timestamp: serverTimestamp(),
      warehouseID,
      companyID: cid,
      items: items.map((i) => ({ productID: i.productID, productName: i.productName, quantity: i.quantity, unit: i.unit, warehouseID })),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    const newReq: InventoryRequest = {
      id: docRef.id,
      submittedBy: user.displayName ?? user.email ?? "",
      submittedByUID: user.uid,
      status: "Pending",
      warehouseID,
      items: items.map((i) => ({ productID: i.productID, productName: i.productName, quantity: i.quantity, unit: i.unit, warehouseID })),
    };
    setRequests((prev) => [newReq, ...prev]);
    setShowSubmit(false);
  }

  /** Distinct product names across visible requests, for the Product filter. */
  const productNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of requests) {
      if (!user?.isAdmin && r.submittedByUID !== user?.uid) continue;
      for (const item of r.items ?? []) {
        if (item.productName) set.add(item.productName);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [requests, user]);

  const filtered = useMemo(() => {
    const cutoff =
      dateRange === "all" ? null : new Date(Date.now() - Number(dateRange) * 86_400_000);

    return requests.filter((r) => {
      if (tab !== "All" && r.status !== tab) return false;
      if (filterWarehouse !== "all" && r.warehouseID !== filterWarehouse) return false;
      if (!user?.isAdmin && r.submittedByUID !== user?.uid) return false;
      if (filterProduct !== "all" && !r.items?.some((i) => i.productName === filterProduct)) {
        return false;
      }
      if (cutoff) {
        const ts = toDate(r.timestamp);
        if (!ts || ts < cutoff) return false;
      }
      return true;
    });
  }, [requests, tab, filterWarehouse, filterProduct, dateRange, user]);

  const counts = useMemo(() => {
    const base = user?.isAdmin ? requests : requests.filter((r) => r.submittedByUID === user?.uid);
    return STATUS_TABS.reduce((acc, t) => {
      acc[t] = t === "All" ? base.length : base.filter((r) => r.status === t).length;
      return acc;
    }, {} as Record<string, number>);
  }, [requests, user]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      {/* Account controls, as on the native My Requests tab */}
      <NavBarLeft>
        <NavCircleButton href="/account" label="Account" tint="blue">
          <PersonCircleIcon className="w-[26px] h-[26px]" />
        </NavCircleButton>
      </NavBarLeft>
      <NavBarRight>
        <button
          onClick={signOut}
          className="bg-[#1C1C1E] rounded-full px-4 py-2 text-[15px] font-medium text-[#0A84FF] active:bg-[#2C2C2E] transition-colors"
        >
          Logout
        </button>
      </NavBarRight>

      <LargeTitle
        title={user?.isAdmin ? "Request Queue" : "My Requests"}
        subtitle={`${filtered.length} of ${counts.All} requests`}
      />

      {/* Filter panel */}
      <div className="flex items-center gap-2 -mx-2 mb-2">
        <TextAction
          onClick={() => setFiltersOpen((v) => !v)}
          icon={<ChevronDownIcon className={`w-[17px] h-[17px] transition-transform ${filtersOpen ? "rotate-180" : ""}`} />}
        >
          {filtersOpen ? "Hide Filters" : "Show Filters"}
        </TextAction>
        <TextAction onClick={() => load()} icon={<RefreshGlyph />}>
          Refresh
        </TextAction>
      </div>

      {filtersOpen && (
        <div className="space-y-2.5 mb-4">
          {warehouses.length > 0 && (
            <SelectRow
              label="Warehouse"
              value={filterWarehouse}
              onChange={setFilterWarehouse}
              options={[
                { value: "all", label: "All" },
                ...warehouses.map((w) => ({ value: w.id!, label: w.name })),
              ]}
            />
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <SelectRow
              label="Product"
              value={filterProduct}
              onChange={setFilterProduct}
              options={[
                { value: "all", label: "All" },
                ...productNames.map((n) => ({ value: n, label: n })),
              ]}
            />
            <SelectRow
              label="Status"
              value={tab}
              onChange={(v) => setTab(v as StatusTab)}
              options={STATUS_TABS.map((t) => ({ value: t, label: t === "All" ? "All" : t }))}
            />
          </div>
          <SelectRow
            label="Date Range"
            value={dateRange}
            onChange={(v) => setDateRange(v as DateRange)}
            options={DATE_RANGES.map((d) => ({ value: d.key, label: d.label }))}
          />
        </div>
      )}

      <div className="mb-4">
        <BigButton onClick={() => setShowSubmit(true)}>
          <PlusIcon className="w-[17px] h-[17px]" />
          New Request
        </BigButton>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-[17px] text-[rgba(235,235,245,0.3)] py-20">No requests yet.</div>
        ) : (
          filtered.map((r) => {
            const wh = warehouses.find((w) => w.id === r.warehouseID);
            const isExpanded = expanded === r.id;
            return (
              <div key={r.id} className="bg-[#1C1C1E] rounded-[14px] overflow-hidden">
                <button
                  className="w-full px-4 sm:px-6 py-4 text-left hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : r.id!)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={r.status} />
                        <span className="text-white font-medium">{r.submittedBy}</span>
                      </div>
                      <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500 flex-wrap">
                        {wh && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {wh.name}
                          </span>
                        )}
                        {r.timestamp && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatDate(r.timestamp)}
                          </span>
                        )}
                        <span>{r.items?.length ?? 0} item{(r.items?.length ?? 0) !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#2C2C2E] px-4 sm:px-6 py-4">
                    <div className="space-y-2 mb-4">
                      {r.items?.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-[#2C2C2E] last:border-0">
                          <span className="text-white">{item.productName}</span>
                          <span className="text-gray-400">{item.quantity} {item.unit ?? ""}</span>
                        </div>
                      ))}
                    </div>
                    {r.notes && <p className="text-xs text-gray-500 mb-3">Note: {r.notes}</p>}
                    {(r.completedByName ?? r.completedBy) && (
                      <p className="text-xs text-gray-500 mb-3">
                        Completed by {r.completedByName ?? r.completedBy} {r.completedAt ? `· ${formatDate(r.completedAt)}` : ""}
                      </p>
                    )}
                    {user?.isAdmin && r.status === "Pending" && (
                      <button
                        onClick={() => markComplete(r.id!)}
                        disabled={updating === r.id}
                        className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                      >
                        {updating === r.id ? "Marking…" : "Mark as Completed"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showSubmit && (
        <SubmitRequestModal
          warehouses={warehouses}
          companyID={user?.companyID ?? ""}
          onSave={submitRequest}
          onClose={() => setShowSubmit(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: string }> = {
    Pending:   { cls: "bg-amber-400/15 text-amber-400 border-amber-400/20",  icon: "⏳" },
    Completed: { cls: "bg-green-400/15 text-green-400 border-green-400/20",   icon: "✓" },
    Returned:  { cls: "bg-red-400/15 text-red-400 border-red-400/20",         icon: "↩" },
  };
  const s = map[status] ?? { cls: "bg-gray-400/15 text-gray-400 border-gray-400/20", icon: "•" };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${s.cls}`}>
      <span>{s.icon}</span> {status}
    </span>
  );
}

function toDate(ts: { toDate?: () => Date; seconds?: number } | null | undefined): Date | null {
  if (!ts) return null;
  try {
    if (typeof ts === "object" && "toDate" in ts && ts.toDate) return ts.toDate();
    if (typeof ts === "object" && "seconds" in ts && ts.seconds) return new Date(ts.seconds * 1000);
  } catch { /* fall through */ }
  return null;
}

function formatDate(ts: { toDate?: () => Date; seconds?: number } | null | undefined): string {
  if (!ts) return "";
  try {
    const d = typeof ts === "object" && "toDate" in ts && ts.toDate ? ts.toDate() : new Date((ts as { seconds: number }).seconds * 1000);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

// ─── Submit Request Modal ────────────────────────────────────────────────────

interface LineItem { productID: string; productName: string; quantity: number; unit: string; }

function SubmitRequestModal({ warehouses, companyID, onSave, onClose }: {
  warehouses: Warehouse[];
  companyID: string;
  onSave: (warehouseID: string, items: LineItem[], notes: string) => Promise<void>;
  onClose: () => void;
}) {
  const [warehouseID, setWarehouseID] = useState(warehouses[0]?.id ?? "");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [items, setItems] = useState<LineItem[]>([{ productID: "", productName: "", quantity: 1, unit: "" }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyID) return;
    getDocs(collection(db, "companies", companyID, "products")).then((snap) => {
      setProducts(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }))
          .filter((p) => !p.isRetired)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setLoadingProducts(false);
    });
  }, [companyID]);

  function selectProduct(index: number, productID: string) {
    const product = products.find((p) => p.id === productID);
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, productID, productName: product?.name ?? "", unit: product?.unit ?? "" } : item));
  }

  function addItem() {
    setItems((prev) => [...prev, { productID: "", productName: "", quantity: 1, unit: "" }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  const validItems = items.filter((i) => i.productName.trim() && i.quantity > 0);
  const canSubmit = warehouseID && validItems.length > 0 && !saving;

  async function handleSubmit() {
    setSaving(true);
    try { await onSave(warehouseID, validItems, notes); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full bg-[#2C2C2E] border border-[#2C2C2E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]";

  return (
    <Sheet
      title="New Inventory Request"
      onClose={onClose}
      size="lg"
      footer={
        <SheetActions onCancel={onClose}>
          <PrimaryButton onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Submitting…" : "Submit Request"}
          </PrimaryButton>
        </SheetActions>
      }
    >
      <div className="space-y-4">
          {/* Warehouse */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Warehouse</label>
            <select value={warehouseID} onChange={(e) => setWarehouseID(e.target.value)} className={`${inputCls} appearance-none`}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              {warehouses.length === 0 && <option value="">No warehouses</option>}
            </select>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Items</label>
              <button onClick={addItem} className="px-2.5 py-1.5 -mr-1 rounded-lg text-xs font-medium text-[#0A84FF] active:bg-[#0A84FF]/10 transition-colors flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Item
              </button>
            </div>
            {loadingProducts ? (
              <div className="flex justify-center py-4"><Spinner size={20} /></div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <select
                        value={item.productID}
                        onChange={(e) => selectProduct(index, e.target.value)}
                        className={`${inputCls} appearance-none mb-1`}
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ""}</option>)}
                      </select>
                    </div>
                    <div className="w-20 sm:w-24 shrink-0">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                        className={inputCls}
                        placeholder="Qty"
                      />
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(index)} aria-label="Remove item" className="mt-1 p-2 rounded-lg text-gray-500 hover:text-red-400 active:bg-white/5 transition-colors shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes…" className={`${inputCls} resize-none h-20`} />
          </div>
      </div>
    </Sheet>
  );
}


function RefreshGlyph() {
  return (
    <svg className="w-[17px] h-[17px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
