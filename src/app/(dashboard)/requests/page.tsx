"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import type { InventoryRequest, Warehouse, Product } from "@/lib/types";

const STATUS_TABS = ["All", "Pending", "Completed", "Returned"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [tab, setTab] = useState<StatusTab>("Pending");
  const [filterWarehouse, setFilterWarehouse] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

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

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (tab !== "All" && r.status !== tab) return false;
      if (filterWarehouse !== "all" && r.warehouseID !== filterWarehouse) return false;
      if (!user?.isAdmin && r.submittedByUID !== user?.uid) return false;
      return true;
    });
  }, [requests, tab, filterWarehouse, user]);

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
    <div className="p-6 xl:p-8 w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {user?.isAdmin ? "Request Queue" : "My Requests"}
          </h2>
          <p className="text-gray-400 mt-1 text-sm">{filtered.length} requests</p>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Request
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === t ? "bg-[#35B2FF]/20 text-[#35B2FF]" : "text-gray-500 hover:text-white"
              }`}
            >
              {t}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t ? "bg-[#35B2FF]/30" : "bg-white/5"}`}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>
        {warehouses.length > 0 && (
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#35B2FF]"
          >
            <option value="all">All Warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No {tab === "All" ? "" : tab.toLowerCase()} requests</div>
        ) : (
          filtered.map((r) => {
            const wh = warehouses.find((w) => w.id === r.warehouseID);
            const isExpanded = expanded === r.id;
            return (
              <div key={r.id} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
                <button
                  className="w-full px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : r.id!)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={r.status} />
                        <span className="text-white font-medium">{r.submittedBy}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
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
                  <div className="border-t border-[#2a2f3e] px-6 py-4">
                    <div className="space-y-2 mb-4">
                      {r.items?.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-[#2a2f3e] last:border-0">
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
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors disabled:opacity-50"
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

  const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">New Inventory Request</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
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
              <button onClick={addItem} className="text-xs text-[#35B2FF] hover:text-[#35B2FF]/80 transition-colors flex items-center gap-1">
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
                    <div className="flex-1">
                      <select
                        value={item.productID}
                        onChange={(e) => selectProduct(index, e.target.value)}
                        className={`${inputCls} appearance-none mb-1`}
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ""}</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                        className={inputCls}
                        placeholder="Qty"
                      />
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(index)} className="mt-2 text-gray-500 hover:text-red-400 transition-colors shrink-0">
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
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes…" className={`${inputCls} resize-none h-16`} />
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-[#2a2f3e]">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!canSubmit} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
            {saving ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
