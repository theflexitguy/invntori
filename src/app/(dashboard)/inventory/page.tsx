"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import type { FirestoreInventoryItem, Warehouse, Product, DetailField } from "@/lib/types";

interface InventoryEntry extends FirestoreInventoryItem {
  warehouseName?: string;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryEntry[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<InventoryEntry | null>(null);
  const [detailFields, setDetailFields] = useState<DetailField[]>([]);
  const [showProductsMgr, setShowProductsMgr] = useState(false);
  const [showWarehousesMgr, setShowWarehousesMgr] = useState(false);

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [whSnap, dfSnap] = await Promise.all([
      getDocs(collection(db, "companies", cid, "warehouses")),
      getDocs(collection(db, "companies", cid, "detailFields")),
    ]);
    const whs: Warehouse[] = whSnap.docs.map((d) => ({ id: d.id, name: d.data().name, ...d.data() }));
    setWarehouses(whs);
    setDetailFields(dfSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string })).sort((a, b) => a.name.localeCompare(b.name)));

    const allItems: InventoryEntry[] = [];
    await Promise.all(
      whs.map(async (wh) => {
        const snap = await getDocs(collection(db, "companies", cid, "warehouses", wh.id!, "inventory"));
        snap.docs.forEach((d) => {
          allItems.push({ ...d.data(), id: d.id, warehouseID: wh.id, warehouseName: wh.name } as InventoryEntry);
        });
      })
    );
    setItems(allItems.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
    setLoading(false);
  }, [user?.companyID]);

  useEffect(() => {
    if (user?.companyID) load();
  }, [user?.companyID, load]);

  const categories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category).filter(Boolean) as string[]);
    return ["All", ...Array.from(cats).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (selectedWarehouse !== "all" && item.warehouseID !== selectedWarehouse) return false;
      if (selectedCategory !== "All" && item.category !== selectedCategory) return false;
      if (search && !item.name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (hideOutOfStock && (item.quantity ?? 0) === 0) return false;
      if (showLowOnly && (item.quantity ?? 0) > (item.reorderThreshold ?? 0)) return false;
      return true;
    });
  }, [items, selectedWarehouse, selectedCategory, search, showLowOnly, hideOutOfStock]);

  async function updateItemQty(item: InventoryEntry, newQty: number) {
    if (!user?.companyID || !item.warehouseID || !item.id) return;
    await updateDoc(
      doc(db, "companies", user.companyID, "warehouses", item.warehouseID, "inventory", item.id),
      { quantity: newQty }
    );
    setItems((prev) =>
      prev.map((i) => i.id === item.id && i.warehouseID === item.warehouseID ? { ...i, quantity: newQty } : i)
    );
    setDetail((prev) => {
      if (!prev || prev.id !== item.id || prev.warehouseID !== item.warehouseID) return prev;
      return { ...prev, quantity: newQty };
    });
  }

  async function updateItemDetails(item: InventoryEntry, details: Record<string, string>) {
    if (!user?.companyID || !item.warehouseID || !item.id) return;
    await updateDoc(
      doc(db, "companies", user.companyID, "warehouses", item.warehouseID, "inventory", item.id),
      { details }
    );
    setItems((prev) =>
      prev.map((i) => i.id === item.id && i.warehouseID === item.warehouseID ? { ...i, details } : i)
    );
    setDetail((prev) => {
      if (!prev || prev.id !== item.id || prev.warehouseID !== item.warehouseID) return prev;
      return { ...prev, details };
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  const lowCount = items.filter((i) => (i.quantity ?? 0) <= (i.reorderThreshold ?? 0) && (i.reorderThreshold ?? 0) > 0).length;

  return (
    <div className="p-6 xl:p-8 w-full">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Inventory</h2>
          <p className="text-gray-400 mt-1 text-sm">{filtered.length} items · {warehouses.length} warehouses</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lowCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-2.5">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-amber-400 font-medium">{lowCount} low stock</span>
            </div>
          )}
          {user?.isAdmin && (
            <>
              <button
                onClick={() => setShowWarehousesMgr(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-gray-300 border border-[#2a2f3e] hover:text-white hover:border-white/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Warehouses
              </button>
              <button
                onClick={() => setShowProductsMgr(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Manage Products
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-3 flex-wrap items-center">
          <input
            type="search"
            placeholder="Search inventory…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] w-64"
          />
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#35B2FF]"
          >
            <option value="all">All Warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <ToggleButton active={showLowOnly} onClick={() => setShowLowOnly((v) => !v)} label="Low Stock Only" color="amber" />
          <ToggleButton active={hideOutOfStock} onClick={() => setHideOutOfStock((v) => !v)} label="Hide Out of Stock" color="gray" />
        </div>

        {categories.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-[#35B2FF] text-white"
                    : "bg-[#1a1f2e] border border-[#2a2f3e] text-gray-400 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">No items match your filters</div>
        ) : (
          <div className="divide-y divide-[#2a2f3e]">
            {filtered.map((item) => {
              const qty = item.quantity ?? 0;
              const threshold = item.reorderThreshold ?? 0;
              const outOfStock = qty === 0;
              const low = threshold > 0 && qty <= threshold;
              const pct = threshold > 0 ? Math.min(100, Math.round((qty / (threshold * 2)) * 100)) : 100;

              return (
                <button
                  key={`${item.warehouseID}-${item.id}`}
                  className="w-full text-left px-6 py-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
                  onClick={() => setDetail(item)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-white">{item.name}</p>
                        {outOfStock && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Out of Stock</span>
                        )}
                        {!outOfStock && low && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/20">Low Stock</span>
                        )}
                      </div>
                      {item.category && <p className="text-xs text-gray-500 mt-0.5">{item.category} · {item.warehouseName}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className={`text-lg font-bold ${outOfStock ? "text-red-400" : low ? "text-amber-400" : "text-white"}`}>
                          {qty}
                        </span>
                        <span className="text-gray-500 text-sm ml-1">{item.unit ?? ""}</span>
                      </div>
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  {threshold > 0 && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#2a2f3e] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${outOfStock ? "bg-red-500" : low ? "bg-amber-400" : "bg-[#35B2FF]"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">min {threshold}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {detail && (
        <ItemDetailModal
          item={detail}
          onClose={() => setDetail(null)}
          isAdmin={!!user?.isAdmin}
          onUpdateQty={updateItemQty}
          onUpdateDetails={updateItemDetails}
          detailFields={detailFields}
        />
      )}

      {showProductsMgr && (
        <ProductsManagerModal
          companyID={user!.companyID}
          items={items}
          warehouses={warehouses}
          canDelete={!!(user?.isAdmin || user?.managePermissions?.includes("deleteProducts"))}
          onClose={() => { setShowProductsMgr(false); load(); }}
        />
      )}

      {showWarehousesMgr && (
        <WarehousesManagerModal
          companyID={user!.companyID}
          onClose={() => { setShowWarehousesMgr(false); load(); }}
        />
      )}
    </div>
  );
}

function ItemDetailModal({
  item,
  onClose,
  isAdmin,
  onUpdateQty,
  onUpdateDetails,
  detailFields,
}: {
  item: InventoryEntry;
  onClose: () => void;
  isAdmin?: boolean;
  onUpdateQty?: (item: InventoryEntry, newQty: number) => Promise<void>;
  onUpdateDetails?: (item: InventoryEntry, details: Record<string, string>) => Promise<void>;
  detailFields?: DetailField[];
}) {
  const qty = item.quantity ?? 0;
  const threshold = item.reorderThreshold ?? 0;
  const outOfStock = qty === 0;
  const low = threshold > 0 && qty <= threshold;
  const pct = threshold > 0 ? Math.min(100, Math.round((qty / (threshold * 2)) * 100)) : null;
  const stockColor = outOfStock ? "text-red-400" : low ? "text-amber-400" : "text-green-400";
  const barColor = outOfStock ? "bg-red-500" : low ? "bg-amber-400" : "bg-[#35B2FF]";

  const [editingQty, setEditingQty] = useState(false);
  const [newQtyText, setNewQtyText] = useState(String(qty));
  const [savingQty, setSavingQty] = useState(false);

  const [editingDetails, setEditingDetails] = useState(false);
  const [detailValues, setDetailValues] = useState<Record<string, string>>(item.details ?? {});
  const [savingDetails, setSavingDetails] = useState(false);

  async function handleSaveQty() {
    const newQty = parseInt(newQtyText);
    if (isNaN(newQty) || newQty < 0 || !onUpdateQty) return;
    setSavingQty(true);
    try {
      await onUpdateQty(item, newQty);
      setEditingQty(false);
    } finally {
      setSavingQty(false);
    }
  }

  async function handleSaveDetails() {
    if (!onUpdateDetails) return;
    setSavingDetails(true);
    try {
      await onUpdateDetails(item, detailValues);
      setEditingDetails(false);
    } finally {
      setSavingDetails(false);
    }
  }

  const hasDetailFields = (detailFields?.length ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">{item.name}</h3>
            {item.category && <p className="text-xs text-gray-500 mt-1">{item.category}</p>}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors ml-4 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {outOfStock ? (
          <div className="mb-5 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm text-red-400 font-medium">Out of Stock — needs immediate reorder</span>
          </div>
        ) : low ? (
          <div className="mb-5 flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm text-amber-400 font-medium">Low Stock — at or below reorder threshold</span>
          </div>
        ) : null}

        <div className="bg-[#0f1117] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Stock</p>
              <p className={`text-3xl font-black ${stockColor}`}>
                {item.quantity ?? 0} <span className="text-lg font-medium text-gray-400">{item.unit ?? ""}</span>
              </p>
            </div>
            {threshold > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Reorder at</p>
                <p className="text-xl font-bold text-gray-300">{threshold} <span className="text-sm text-gray-500">{item.unit ?? ""}</span></p>
              </div>
            )}
          </div>
          {isAdmin && !editingQty && (
            <button
              onClick={() => { setNewQtyText(String(item.quantity ?? 0)); setEditingQty(true); }}
              className="mt-2 text-xs text-[#35B2FF] hover:underline"
            >
              Adjust Quantity
            </button>
          )}
          {isAdmin && editingQty && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <input
                type="number"
                min="0"
                value={newQtyText}
                onChange={(e) => setNewQtyText(e.target.value)}
                className="w-24 bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#35B2FF]"
              />
              <span className="text-xs text-gray-500">{item.unit ?? ""}</span>
              <button
                onClick={handleSaveQty}
                disabled={savingQty}
                className="px-3 py-1.5 text-xs rounded-lg bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50"
              >
                {savingQty ? "…" : "Save"}
              </button>
              <button
                onClick={() => setEditingQty(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {pct !== null && (
          <div className="mb-5">
            <div className="h-2 bg-[#2a2f3e] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{pct}% of reorder buffer</p>
          </div>
        )}

        <div className="space-y-2.5 text-sm mb-4">
          <DetailRow label="Warehouse">
            <span className="text-white">{item.warehouseName ?? "—"}</span>
          </DetailRow>
          {item.category && (
            <DetailRow label="Category">
              <span className="text-white">{item.category}</span>
            </DetailRow>
          )}
          {item.unit && (
            <DetailRow label="Unit">
              <span className="text-white">{item.unit}</span>
            </DetailRow>
          )}
        </div>

        {/* Detail Fields */}
        {hasDetailFields && (
          <div className="border-t border-[#2a2f3e] pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</p>
              {isAdmin && !editingDetails && (
                <button
                  onClick={() => { setDetailValues(item.details ?? {}); setEditingDetails(true); }}
                  className="text-xs text-[#35B2FF] hover:opacity-80 transition-opacity"
                >
                  Edit
                </button>
              )}
            </div>
            {!editingDetails ? (
              <div className="space-y-2">
                {detailFields!.map((field) => (
                  <div key={field.id} className="flex items-center justify-between py-1.5 border-b border-[#2a2f3e] last:border-0">
                    <span className="text-xs text-gray-500">{field.name}</span>
                    <span className="text-xs text-white">{item.details?.[field.name] || "—"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {detailFields!.map((field) => (
                  <div key={field.id}>
                    <label className="block text-xs text-gray-500 mb-1">{field.name}</label>
                    <input
                      value={detailValues[field.name] ?? ""}
                      onChange={(e) => setDetailValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      className="w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#35B2FF]"
                      placeholder={`Enter ${field.name}`}
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setEditingDetails(false)}
                    className="flex-1 py-1.5 rounded-lg text-xs border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDetails}
                    disabled={savingDetails}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50"
                  >
                    {savingDetails ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2a2f3e] last:border-0">
      <span className="text-gray-500">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ToggleButton({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  const colors: Record<string, string> = {
    amber: "bg-amber-400/20 border-amber-400/40 text-amber-300",
    gray: "bg-gray-500/20 border-gray-500/40 text-gray-300",
  };
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active ? colors[color] : "bg-transparent border-[#2a2f3e] text-gray-500 hover:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

function ProductsManagerModal({
  companyID,
  items,
  warehouses,
  canDelete,
  onClose,
}: {
  companyID: string;
  items: InventoryEntry[];
  warehouses: Warehouse[];
  canDelete: boolean;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const qtyByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      if (item.id) map[item.id] = (map[item.id] ?? 0) + (item.quantity ?? 0);
    }
    return map;
  }, [items]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "companies", companyID, "products"));
    setProducts(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setLoading(false);
  }, [companyID]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  async function toggleRetire(product: Product) {
    if (!product.id) return;
    const nowRetired = !product.isRetired;
    await updateDoc(doc(db, "companies", companyID, "products", product.id), { isRetired: nowRetired });
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, isRetired: nowRetired } : p));
  }

  async function handleDelete(product: Product) {
    if (!product.id) return;
    setDeleting(true);
    try {
      const batch = writeBatch(db);
      for (const wh of warehouses) {
        if (wh.id) batch.delete(doc(db, "companies", companyID, "warehouses", wh.id, "inventory", product.id));
      }
      batch.delete(doc(db, "companies", companyID, "products", product.id));
      await batch.commit();
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  async function saveProduct(data: Omit<Product, "id">, productId?: string) {
    const payload = data as Record<string, unknown>;
    if (productId) {
      await updateDoc(doc(db, "companies", companyID, "products", productId), payload);
      const syncData: Record<string, unknown> = { name: data.name };
      if (data.category !== undefined) syncData.category = data.category;
      if (data.unit !== undefined) syncData.unit = data.unit;
      if (data.reorderThreshold !== undefined) syncData.reorderThreshold = data.reorderThreshold;
      const batch = writeBatch(db);
      for (const wh of warehouses) {
        if (wh.id) batch.set(doc(db, "companies", companyID, "warehouses", wh.id, "inventory", productId), syncData, { merge: true });
      }
      await batch.commit();
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, ...data } : p));
      setEditProduct(null);
    } else {
      const docRef = await addDoc(collection(db, "companies", companyID, "products"), payload);
      if (warehouses.length > 0) {
        const batch = writeBatch(db);
        const invData = { name: data.name, category: data.category ?? "", unit: data.unit ?? "", reorderThreshold: data.reorderThreshold ?? 0, quantity: 0 };
        for (const wh of warehouses) {
          if (wh.id) batch.set(doc(db, "companies", companyID, "warehouses", wh.id, "inventory", docRef.id), invData);
        }
        await batch.commit();
      }
      setProducts((prev) => [...prev, { id: docRef.id, ...data }].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAdd(false);
    }
  }

  const filtered = useMemo(() => products.filter((p) => {
    if (!showRetired && p.isRetired) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [products, search, showRetired]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between p-5 border-b border-[#2a2f3e] shrink-0">
          <h3 className="text-lg font-bold text-white">Manage Products</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Product
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-[#2a2f3e] flex items-center gap-3 shrink-0">
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 bg-[#0f1117] border border-[#2a2f3e] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]"
          />
          <button
            onClick={() => setShowRetired((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
              showRetired ? "bg-gray-500/20 border-gray-500/40 text-gray-300" : "border-[#2a2f3e] text-gray-500 hover:text-gray-300"
            }`}
          >
            {showRetired ? "Hiding Retired" : "Show Retired"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-12 text-sm">No products found</p>
          ) : (
            <div className="divide-y divide-[#2a2f3e]">
              {filtered.map((product) => {
                const totalQty = qtyByProduct[product.id!] ?? 0;
                return (
                  <div key={product.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-white text-sm">{product.name}</p>
                        {product.isRetired && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/20">Retired</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[product.category, product.unit].filter(Boolean).join(" · ")}
                        {totalQty > 0 && <span className="text-gray-400 ml-2">{totalQty} in stock</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditProduct(product)}
                        className="px-2.5 py-1.5 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleRetire(product)}
                        className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                          product.isRetired ? "text-green-400 hover:bg-green-400/10" : "text-amber-400 hover:bg-amber-400/10"
                        }`}
                      >
                        {product.isRetired ? "Reactivate" : "Retire"}
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setConfirmDelete(product)}
                          className="px-2.5 py-1.5 text-xs rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(showAdd || editProduct) && (
        <ProductFormModal
          product={editProduct}
          onSave={(data) => saveProduct(data, editProduct?.id)}
          onClose={() => { setShowAdd(false); setEditProduct(null); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-white mb-2">Delete &quot;{confirmDelete.name}&quot;?</h4>
            <p className="text-sm text-gray-400 mb-5">This will permanently remove the product and all its warehouse inventory records. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting} className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductFormModal({
  product,
  onSave,
  onClose,
}: {
  product: Product | null;
  onSave: (data: Omit<Product, "id">) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [threshold, setThreshold] = useState(product?.reorderThreshold != null ? String(product.reorderThreshold) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

  async function handleSave() {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const data: Omit<Product, "id"> = { name: name.trim() };
      if (category.trim()) data.category = category.trim();
      if (unit.trim()) data.unit = unit.trim();
      const thresh = parseInt(threshold);
      if (!isNaN(thresh) && thresh >= 0) data.reorderThreshold = thresh;
      if (isEdit && product?.isRetired !== undefined) data.isRetired = product.isRetired;
      await onSave(data);
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">{isEdit ? "Edit Product" : "Add Product"}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Bifenthrin Spray" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="e.g. Chemical, Equipment" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Unit</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} placeholder="e.g. oz, gallon, bottle" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Reorder Threshold</label>
            <input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputCls} placeholder="e.g. 10" />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WarehousesManagerModal({
  companyID,
  onClose,
}: {
  companyID: string;
  onClose: () => void;
}) {
  const [warehouseList, setWarehouseList] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editWarehouse, setEditWarehouse] = useState<Warehouse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [whName, setWhName] = useState("");
  const [whLocation, setWhLocation] = useState("");

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "companies", companyID, "warehouses"));
    setWarehouseList(snap.docs.map((d) => ({ id: d.id, name: d.data().name, location: d.data().location ?? "" })).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }, [companyID]);

  useEffect(() => { loadWarehouses(); }, [loadWarehouses]);

  function openAdd() { setWhName(""); setWhLocation(""); setEditWarehouse(null); setShowForm(true); setFormError(""); }
  function openEdit(wh: Warehouse) { setWhName(wh.name); setWhLocation(wh.location ?? ""); setEditWarehouse(wh); setShowForm(true); setFormError(""); }

  async function handleSave() {
    if (!whName.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const name = whName.trim();
      const location = whLocation.trim() || undefined;
      if (editWarehouse?.id) {
        await updateDoc(doc(db, "companies", companyID, "warehouses", editWarehouse.id), { name, location });
        setWarehouseList((prev) => prev.map((w) => w.id === editWarehouse.id ? { ...w, name, location } : w));
      } else {
        const docRef = await addDoc(collection(db, "companies", companyID, "warehouses"), { name, location });
        setWarehouseList((prev) => [...prev, { id: docRef.id, name, location }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowForm(false);
    } catch {
      setFormError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between p-5 border-b border-[#2a2f3e] shrink-0">
          <h3 className="text-lg font-bold text-white">Manage Warehouses</h3>
          <div className="flex items-center gap-2">
            <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Warehouse
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>
          ) : warehouseList.length === 0 ? (
            <p className="text-center text-gray-500 py-12 text-sm">No warehouses yet</p>
          ) : (
            <div className="divide-y divide-[#2a2f3e]">
              {warehouseList.map((wh) => (
                <div key={wh.id} className="px-5 py-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm">{wh.name}</p>
                    {wh.location && <p className="text-xs text-gray-500 mt-0.5">{wh.location}</p>}
                  </div>
                  <button onClick={() => openEdit(wh)} className="px-2.5 py-1.5 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Edit</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {showForm && (
          <div className="border-t border-[#2a2f3e] p-5 shrink-0">
            <h4 className="text-sm font-semibold text-white mb-3">{editWarehouse ? "Edit Warehouse" : "New Warehouse"}</h4>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input value={whName} onChange={(e) => setWhName(e.target.value)} className={inputCls} placeholder="e.g. Main Warehouse" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Location</label>
                <input value={whLocation} onChange={(e) => setWhLocation(e.target.value)} className={inputCls} placeholder="e.g. 123 Main St" />
              </div>
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!whName.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
                {saving ? "Saving…" : editWarehouse ? "Save Changes" : "Add Warehouse"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
