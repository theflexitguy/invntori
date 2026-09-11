"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection, getDocs, query, orderBy, doc, serverTimestamp,
  updateDoc, writeBatch, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import type { Product } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface PurchaseOrderItem {
  productID?: string;
  productName: string;
  quantity: number;
  qtyReceived?: number;
  unit?: string;
  unitCost?: number;
}

interface PurchaseOrder {
  id: string;
  vendorName: string;
  status: string;
  vendorRef?: string;
  notes?: string;
  createdAt?: Date;
  expectedDate?: Date;
  totalCost?: number;
  warehouseID?: string;
  items: PurchaseOrderItem[];
}

interface Warehouse { id: string; name: string; }

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
  if (s === "partiallyreceived") return { bg: "bg-blue-400/15", text: "text-[#35B2FF]", border: "border-[#35B2FF]/20" };
  if (s === "cancelled" || s === "closed") return { bg: "bg-gray-400/15", text: "text-gray-400", border: "border-gray-400/20" };
  if (s === "approved") return { bg: "bg-violet-400/15", text: "text-violet-400", border: "border-violet-400/20" };
  return { bg: "bg-amber-400/15", text: "text-amber-400", border: "border-amber-400/20" };
}

const STATUS_TABS = ["All", "Pending", "Completed"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>("Pending");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // Lazy-loaded lines from subcollection (for iOS-created POs that have no items array)
  const [subcollectionLines, setSubcollectionLines] = useState<Record<string, PurchaseOrderItem[]>>({});

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [snap, whSnap] = await Promise.all([
      getDocs(query(collection(db, "companies", cid, "purchaseOrders"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "companies", cid, "warehouses")),
    ]);
    setWarehouses(whSnap.docs.map((d) => ({ id: d.id, name: (d.data().name as string | undefined) ?? d.id })));
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
        warehouseID: raw.warehouseID,
        items: Array.isArray(raw.items) ? raw.items : [],
      };
    });
    setOrders(loaded);
    setLoading(false);
  }

  async function handleExpand(orderId: string) {
    if (expanded === orderId) { setExpanded(null); return; }
    setExpanded(orderId);
    const order = orders.find((o) => o.id === orderId);
    // If order has no items array (iOS-created), lazy-load from lines subcollection
    if (order && order.items.length === 0 && !subcollectionLines[orderId] && user?.companyID) {
      const linesSnap = await getDocs(collection(db, "companies", user.companyID, "purchaseOrders", orderId, "lines"));
      const lines: PurchaseOrderItem[] = linesSnap.docs.map((d) => ({
        productID: d.data().productID as string | undefined,
        productName: (d.data().productName as string | undefined) ?? "",
        quantity: (d.data().qtyOrdered as number | undefined) ?? 0,
        qtyReceived: (d.data().qtyReceived as number | undefined) ?? 0,
        unit: d.data().unit as string | undefined,
      }));
      setSubcollectionLines((prev) => ({ ...prev, [orderId]: lines }));
    }
  }

  async function createOrder(
    vendorName: string, vendorRef: string, warehouseID: string,
    items: { productID: string; productName: string; quantity: number; unit: string; unitCost: string }[],
    expectedDate: string, notes: string,
  ) {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const validItems = items.filter((i) => i.productID && i.productName.trim() && i.quantity > 0);
    const total = validItems.reduce((sum, i) => sum + (parseFloat(i.unitCost) || 0) * i.quantity, 0);

    const batch = writeBatch(db);
    const poRef = doc(collection(db, "companies", cid, "purchaseOrders"));

    // Header document — includes items array for quick display + warehouseID for iOS receive flow
    const headerData: Record<string, unknown> = {
      vendorName: vendorName.trim(),
      status: "Pending",
      warehouseID,
      items: validItems.map((i) => ({
        productID: i.productID,
        productName: i.productName.trim(),
        quantity: i.quantity,
        unit: i.unit.trim() || undefined,
        ...(i.unitCost ? { unitCost: parseFloat(i.unitCost) } : {}),
      })),
      createdAt: serverTimestamp(),
      createdByUID: user.uid,
      createdByName: user.displayName ?? user.email ?? "",
      ...(total > 0 ? { totalCost: total } : {}),
      ...(vendorRef.trim() ? { vendorRef: vendorRef.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(expectedDate ? { expectedDate: new Date(expectedDate) } : {}),
    };
    batch.set(poRef, headerData);

    // Lines subcollection — matches iOS format so iOS can read and receive these orders
    for (const item of validItems) {
      const lineRef = doc(collection(db, "companies", cid, "purchaseOrders", poRef.id, "lines"));
      batch.set(lineRef, {
        productID: item.productID,
        productName: item.productName.trim(),
        unit: item.unit.trim() ?? "",
        warehouseID,
        qtyOrdered: item.quantity,
        qtyReceived: 0,
      });
    }

    await batch.commit();

    const newOrder: PurchaseOrder = {
      id: poRef.id,
      vendorName: vendorName.trim(),
      status: "Pending",
      vendorRef: vendorRef.trim() || undefined,
      notes: notes.trim() || undefined,
      warehouseID,
      items: validItems.map((i) => ({
        productID: i.productID,
        productName: i.productName.trim(),
        quantity: i.quantity,
        unit: i.unit.trim() || undefined,
        unitCost: parseFloat(i.unitCost) || undefined,
      })),
      expectedDate: expectedDate ? new Date(expectedDate) : undefined,
      totalCost: total > 0 ? total : undefined,
    };
    setOrders((prev) => [newOrder, ...prev]);
    setShowCreate(false);
  }

  async function markReceived(order: PurchaseOrder) {
    if (!user?.companyID) return;
    const cid = user.companyID;
    setUpdating(order.id);
    try {
      const batch = writeBatch(db);
      const poRef = doc(db, "companies", cid, "purchaseOrders", order.id);

      // If order has a warehouseID, update individual line items and increment inventory
      if (order.warehouseID) {
        const linesSnap = await getDocs(collection(db, "companies", cid, "purchaseOrders", order.id, "lines"));
        for (const lineDoc of linesSnap.docs) {
          const lineData = lineDoc.data();
          const remaining = (lineData.qtyOrdered as number ?? 0) - (lineData.qtyReceived as number ?? 0);
          if (remaining > 0 && lineData.productID) {
            batch.update(lineDoc.ref, { qtyReceived: lineData.qtyOrdered });
            const invRef = doc(db, "companies", cid, "warehouses", order.warehouseID, "inventory", lineData.productID as string);
            batch.update(invRef, { quantity: increment(remaining) });
          }
        }
      }

      batch.update(poRef, {
        status: "received",
        receivedAt: serverTimestamp(),
        receivedBy: user.uid,
        receivedByName: user.displayName ?? user.email ?? "",
      });

      await batch.commit();
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "received" } : o));
    } finally {
      setUpdating(null);
    }
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
    <div className="p-6 xl:p-8 w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Purchase Orders</h2>
          <p className="text-gray-400 mt-1 text-sm">{filtered.length} orders</p>
        </div>
        {user?.isAdmin && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Order
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg p-1">
          {STATUS_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${tab === t ? "bg-[#35B2FF]/20 text-[#35B2FF]" : "text-gray-500 hover:text-white"}`}>
              {t}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t ? "bg-[#35B2FF]/30" : "bg-white/5"}`}>{counts[t]}</span>
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search vendor, item…" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] w-64" />
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
            const displayItems = subcollectionLines[order.id] ?? order.items;
            const wh = warehouses.find((w) => w.id === order.warehouseID);
            return (
              <div key={order.id} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
                <button className="w-full px-6 py-4 text-left hover:bg-white/[0.02] transition-colors" onClick={() => handleExpand(order.id)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border ${sc.bg} ${sc.text} ${sc.border}`}>{displayStatus(order.status)}</span>
                        {isOverdue && <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border bg-red-400/15 text-red-400 border-red-400/20">Overdue</span>}
                        <span className="text-white font-medium">{order.vendorName}</span>
                        {order.vendorRef && <span className="text-xs text-gray-500 font-mono">#{order.vendorRef}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {order.createdAt && <span>{order.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                        {order.expectedDate && <span>Expected: {order.expectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        {wh && <span>{wh.name}</span>}
                        <span>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
                        {order.totalCost !== undefined && <span>{order.totalCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>}
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#2a2f3e] px-6 py-4">
                    {displayItems.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {displayItems.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-[#2a2f3e] last:border-0">
                            <span className="text-white">{item.productName}</span>
                            <div className="text-right">
                              <span className="text-gray-400">{item.quantity} {item.unit ?? ""}</span>
                              {item.qtyReceived !== undefined && item.qtyReceived > 0 && (
                                <span className="text-green-400/70 text-xs ml-2">({item.qtyReceived} received)</span>
                              )}
                              {item.unitCost !== undefined && <span className="text-gray-600 text-xs ml-2">@ {item.unitCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-500 mb-3">No line items</p>}
                    {order.notes && <p className="text-xs text-gray-500 mb-3">Note: {order.notes}</p>}
                    {user?.isAdmin && isPending && (
                      <button onClick={() => markReceived(order)} disabled={updating === order.id} className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors disabled:opacity-50">
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
        <CreateOrderModal
          companyID={user?.companyID ?? ""}
          warehouses={warehouses}
          onSave={createOrder}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ─── Create Order Modal ──────────────────────────────────────────────────────

interface OrderLineItem { productID: string; productName: string; quantity: number; unit: string; unitCost: string; }

function CreateOrderModal({ companyID, warehouses, onSave, onClose }: {
  companyID: string;
  warehouses: Warehouse[];
  onSave: (vendor: string, ref: string, warehouseID: string, items: OrderLineItem[], expectedDate: string, notes: string) => Promise<void>;
  onClose: () => void;
}) {
  const [vendorName, setVendorName] = useState("");
  const [vendorRef, setVendorRef] = useState("");
  const [warehouseID, setWarehouseID] = useState(warehouses[0]?.id ?? "");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderLineItem[]>([{ productID: "", productName: "", quantity: 1, unit: "", unitCost: "" }]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!companyID) return;
    getDocs(collection(db, "companies", companyID, "products")).then((snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) })).filter((p) => !p.isRetired).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, [companyID]);

  function addItem() { setItems((prev) => [...prev, { productID: "", productName: "", quantity: 1, unit: "", unitCost: "" }]); }
  function removeItem(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof OrderLineItem, value: string | number) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }
  function selectProduct(i: number, productID: string) {
    const p = products.find((p) => p.id === productID);
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, productID, productName: p?.name ?? "", unit: p?.unit ?? item.unit } : item));
  }

  const validItems = items.filter((i) => i.productID && i.productName.trim() && i.quantity > 0);
  const canSave = vendorName.trim() && warehouseID && validItems.length > 0 && !saving;

  async function handleSave() {
    setSaving(true);
    try { await onSave(vendorName, vendorRef, warehouseID, validItems, expectedDate, notes); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">New Purchase Order</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
            <label className="block text-xs text-gray-500 mb-1">Warehouse *</label>
            <select value={warehouseID} onChange={(e) => setWarehouseID(e.target.value)} className={`${inputCls} appearance-none`}>
              {warehouses.length === 0 && <option value="">No warehouses</option>}
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Expected Delivery Date</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Line Items *</label>
              <button onClick={addItem} className="text-xs text-[#35B2FF] hover:opacity-80 transition-opacity flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <select value={item.productID} onChange={(e) => selectProduct(index, e.target.value)} className={`${inputCls} appearance-none mb-1`}>
                      <option value="">Select product…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ""}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))} className={inputCls} placeholder="Qty" />
                      <input value={item.unit} onChange={(e) => updateItem(index, "unit", e.target.value)} className={inputCls} placeholder="Unit" />
                      <input type="number" value={item.unitCost} onChange={(e) => updateItem(index, "unitCost", e.target.value)} className={inputCls} placeholder="$/unit" />
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(index)} className="mt-2 text-gray-500 hover:text-red-400 transition-colors shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none h-16`} placeholder="Optional" />
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-[#2a2f3e]">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!canSave} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
            {saving ? "Creating…" : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
