"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Sheet, SheetActions, PrimaryButton } from "@/components/ui/Sheet";
import { PageHeader, HeaderButton, PlusIcon } from "@/components/ui/PageHeader";
import type { Product } from "@/lib/types";

type POStatus = "draft" | "submitted" | "approved" | "Pending" | "PartiallyReceived" | "Completed" | "received" | "cancelled";

interface PurchaseOrderItem { productName: string; quantity: number; unit?: string; unitCost?: number; }

interface PurchaseOrder {
  id: string;
  vendorName: string;
  status: POStatus | string;
  vendorRef?: string;
  notes?: string;
  createdAt?: Date;
  expectedDate?: Date;
  totalCost?: number;
  items: PurchaseOrderItem[];
}

function parseDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (typeof val === "object" && val !== null && "toDate" in val) return (val as { toDate: () => Date }).toDate();
  if (typeof val === "object" && val !== null && "seconds" in val) return new Date((val as { seconds: number }).seconds * 1000);
  if (typeof val === "string") { const d = new Date(val); return isNaN(d.getTime()) ? undefined : d; }
  return undefined;
}

function displayStatus(status: string): string {
  if (status === "PartiallyReceived") return "Partial";
  if (status === "Closed") return "Completed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusColor(status: string): { bg: string; text: string; border: string } {
  const s = status.toLowerCase();
  if (s === "completed" || s === "received") return { bg: "bg-green-400/15", text: "text-green-400", border: "border-green-400/20" };
  if (s === "partiallyreceived") return { bg: "bg-blue-400/15", text: "text-[#0A84FF]", border: "border-[#0A84FF]/20" };
  if (s === "cancelled" || s === "closed") return { bg: "bg-gray-400/15", text: "text-gray-400", border: "border-gray-400/20" };
  if (s === "approved") return { bg: "bg-violet-400/15", text: "text-violet-400", border: "border-violet-400/20" };
  return { bg: "bg-amber-400/15", text: "text-amber-400", border: "border-amber-400/20" };
}

const STATUS_TABS = ["All", "Pending", "Completed"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>("Pending");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const snap = await getDocs(query(collection(db, "companies", cid, "purchaseOrders"), orderBy("createdAt", "desc")));
    const loaded: PurchaseOrder[] = snap.docs.map((d) => {
      const raw = d.data();
      return {
        id: d.id,
        vendorName: raw.vendorName ?? raw.vendor ?? "Unknown Vendor",
        status: raw.status ?? "Pending",
        vendorRef: raw.vendorRef ?? raw.orderNumber,
        notes: raw.notes,
        createdAt: parseDate(raw.createdAt),
        expectedDate: parseDate(raw.expectedDate),
        totalCost: typeof raw.totalCost === "number" ? raw.totalCost : undefined,
        items: Array.isArray(raw.items) ? raw.items : [],
      };
    });
    setOrders(loaded);
    setLoading(false);
  }

  async function createOrder(vendorName: string, vendorRef: string, items: PurchaseOrderItem[], expectedDate: string, notes: string) {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const total = items.reduce((sum, i) => sum + (i.unitCost ?? 0) * i.quantity, 0);
    const data: Record<string, unknown> = {
      vendorName: vendorName.trim(),
      status: "Pending",
      items,
      createdAt: serverTimestamp(),
      createdByUID: user.uid,
      createdByName: user.displayName ?? user.email ?? "",
      ...(total > 0 ? { totalCost: total } : {}),
      ...(vendorRef.trim() ? { vendorRef: vendorRef.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(expectedDate ? { expectedDate: new Date(expectedDate) } : {}),
    };
    const docRef = await addDoc(collection(db, "companies", cid, "purchaseOrders"), data);
    const newOrder: PurchaseOrder = { id: docRef.id, vendorName: vendorName.trim(), status: "Pending", vendorRef: vendorRef.trim() || undefined, notes: notes.trim() || undefined, items, expectedDate: expectedDate ? new Date(expectedDate) : undefined, totalCost: total > 0 ? total : undefined };
    setOrders((prev) => [newOrder, ...prev]);
    setShowCreate(false);
  }

  async function markReceived(id: string) {
    if (!user?.companyID) return;
    setUpdating(id);
    try {
      await updateDoc(doc(db, "companies", user.companyID, "purchaseOrders", id), { status: "received", receivedAt: serverTimestamp(), receivedBy: user.uid, receivedByName: user.displayName ?? user.email ?? "" });
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "received" } : o));
    } finally { setUpdating(null); }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      if (tab === "Pending") { const s = o.status.toLowerCase(); if (s === "completed" || s === "received" || s === "complete" || s === "cancelled") return false; }
      else if (tab === "Completed") { const s = o.status.toLowerCase(); if (s !== "completed" && s !== "received" && s !== "complete") return false; }
      if (!q) return true;
      return o.vendorName.toLowerCase().includes(q) || (o.vendorRef?.toLowerCase().includes(q) ?? false) || o.items.some((i) => i.productName.toLowerCase().includes(q));
    });
  }, [orders, tab, search]);

  const counts = useMemo(() => {
    const pending = orders.filter((o) => { const s = o.status.toLowerCase(); return s !== "completed" && s !== "received" && s !== "complete" && s !== "cancelled"; }).length;
    const completed = orders.filter((o) => { const s = o.status.toLowerCase(); return s === "completed" || s === "received" || s === "complete"; }).length;
    return { All: orders.length, Pending: pending, Completed: completed };
  }, [orders]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${filtered.length} orders`}
        actions={
          user?.isAdmin ? (
            <HeaderButton onClick={() => setShowCreate(true)}>
              <PlusIcon />
              New Order
            </HeaderButton>
          ) : undefined
        }
      />

      <div className="space-y-2.5 sm:space-y-0 sm:flex sm:gap-3 mb-4 sm:items-center">
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
          <div className="inline-flex gap-1 bg-[#1C1C1E] rounded-[14px] p-1">
            {STATUS_TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${tab === t ? "bg-[#0A84FF]/20 text-[#0A84FF]" : "text-gray-500 hover:text-white"}`}>
                {t}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t ? "bg-[#0A84FF]/30" : "bg-white/5"}`}>{counts[t]}</span>
              </button>
            ))}
          </div>
        </div>
        <input type="search" placeholder="Search vendor, item…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64 bg-[#1C1C1E] rounded-[14px] sm:rounded-lg px-4 py-2.5 sm:py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]" />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No orders found</div>
        ) : (
          filtered.map((order) => {
            const sc = statusColor(order.status);
            const isExpanded = expanded === order.id;
            const isPending = !["completed", "received", "complete", "cancelled"].includes(order.status.toLowerCase());
            const isOverdue = order.expectedDate && order.expectedDate < new Date() && isPending;
            return (
              <div key={order.id} className="bg-[#1C1C1E] rounded-[14px] overflow-hidden">
                <button className="w-full px-4 sm:px-6 py-4 text-left hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors" onClick={() => setExpanded(isExpanded ? null : order.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border ${sc.bg} ${sc.text} ${sc.border}`}>{displayStatus(order.status)}</span>
                        {isOverdue && <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border bg-red-400/15 text-red-400 border-red-400/20">Overdue</span>}
                        <span className="text-white font-medium">{order.vendorName}</span>
                        {order.vendorRef && <span className="text-xs text-gray-500 font-mono">#{order.vendorRef}</span>}
                      </div>
                      <div className="flex items-center gap-x-3 gap-y-1 text-xs text-gray-500 flex-wrap">
                        {order.createdAt && <span>{order.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                        {order.expectedDate && <span>Expected: {order.expectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        <span>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
                        {order.totalCost !== undefined && <span>{order.totalCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>}
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#2C2C2E] px-4 sm:px-6 py-4">
                    {order.items.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-start justify-between text-sm py-2 border-b border-[#2C2C2E] last:border-0 gap-2">
                            <span className="text-white min-w-0 break-words">{item.productName}</span>
                            <div className="text-right shrink-0 ml-3">
                              <span className="text-gray-400">{item.quantity} {item.unit ?? ""}</span>
                              {item.unitCost !== undefined && <span className="text-gray-600 text-xs ml-2">@ {item.unitCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-500 mb-3">No line items</p>}
                    {order.notes && <p className="text-xs text-gray-500 mb-3">Note: {order.notes}</p>}
                    {user?.isAdmin && isPending && (
                      <button onClick={() => markReceived(order.id)} disabled={updating === order.id} className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors disabled:opacity-50">
                        {updating === order.id ? "Updating…" : "Mark as Received"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showCreate && (
        <CreateOrderModal companyID={user?.companyID ?? ""} onSave={createOrder} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

// ─── Create Order Modal ──────────────────────────────────────────────────────

interface OrderLineItem { productName: string; quantity: number; unit: string; unitCost: string; }

function CreateOrderModal({ companyID, onSave, onClose }: {
  companyID: string;
  onSave: (vendor: string, ref: string, items: PurchaseOrderItem[], expectedDate: string, notes: string) => Promise<void>;
  onClose: () => void;
}) {
  const [vendorName, setVendorName] = useState("");
  const [vendorRef, setVendorRef] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderLineItem[]>([{ productName: "", quantity: 1, unit: "", unitCost: "" }]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyID) return;
    getDocs(collection(db, "companies", companyID, "products")).then((snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) })).filter((p) => !p.isRetired).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, [companyID]);

  function addItem() { setItems((prev) => [...prev, { productName: "", quantity: 1, unit: "", unitCost: "" }]); }
  function removeItem(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof OrderLineItem, value: string | number) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }
  function selectProduct(i: number, productName: string) {
    const p = products.find((p) => p.name === productName);
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, productName, unit: p?.unit ?? item.unit } : item));
  }

  const validItems = items.filter((i) => i.productName.trim() && i.quantity > 0);
  const canSave = vendorName.trim() && validItems.length > 0 && !saving;

  async function handleSave() {
    setSaving(true);
    try {
      const mapped: PurchaseOrderItem[] = validItems.map((i) => ({
        productName: i.productName.trim(),
        quantity: i.quantity,
        unit: i.unit.trim() || undefined,
        unitCost: i.unitCost ? parseFloat(i.unitCost) : undefined,
      }));
      await onSave(vendorName, vendorRef, mapped, expectedDate, notes);
    } finally { setSaving(false); }
  }

  const inputCls = "w-full bg-[#2C2C2E] border border-[#2C2C2E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]";

  return (
    <Sheet
      title="New Purchase Order"
      onClose={onClose}
      size="lg"
      footer={
        <SheetActions onCancel={onClose}>
          <PrimaryButton onClick={handleSave} disabled={!canSave}>
            {saving ? "Creating…" : "Create Order"}
          </PrimaryButton>
        </SheetActions>
      }
    >
      <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vendor Name *</label>
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={inputCls} placeholder="e.g. Supplier Co." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">PO / Ref Number</label>
              <input value={vendorRef} onChange={(e) => setVendorRef(e.target.value)} className={inputCls} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Expected Delivery Date</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Line Items *</label>
              <button onClick={addItem} className="px-2.5 py-1.5 -mr-1 rounded-lg text-xs font-medium text-[#0A84FF] active:bg-[#0A84FF]/10 transition-colors flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <select value={item.productName} onChange={(e) => selectProduct(index, e.target.value)} className={`${inputCls} appearance-none mb-1`}>
                      <option value="">Select product…</option>
                      {products.map((p) => <option key={p.id} value={p.name}>{p.name}{p.unit ? ` (${p.unit})` : ""}</option>)}
                    </select>
                    <div className="flex gap-1.5">
                      <input type="number" inputMode="numeric" min="1" value={item.quantity} onChange={(e) => updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))} className={inputCls} placeholder="Qty" />
                      <input value={item.unit} onChange={(e) => updateItem(index, "unit", e.target.value)} className={inputCls} placeholder="Unit" />
                      <input type="number" inputMode="decimal" value={item.unitCost} onChange={(e) => updateItem(index, "unitCost", e.target.value)} className={inputCls} placeholder="$/unit" />
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(index)} aria-label="Remove line item" className="mt-1 p-2 rounded-lg text-gray-500 hover:text-red-400 active:bg-white/5 transition-colors shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none h-20`} placeholder="Optional" />
          </div>
      </div>
    </Sheet>
  );
}
