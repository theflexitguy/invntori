"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Sheet, SheetActions, PrimaryButton } from "@/components/ui/Sheet";
import { LargeTitle, Switch, TextAction, SearchField, Pill } from "@/components/ui/ios";
import { BoxIcon, ChevronDownIcon, ChevronRightIcon, CloseIcon } from "@/components/layout/nav";
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
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

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
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      <LargeTitle
        title="Inventory"
        subtitle={`${filtered.length} items · ${warehouses.length} warehouses${lowCount > 0 ? ` · ${lowCount} low` : ""}`}
      />

      {/* Warehouse + admin actions */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          aria-label="Warehouse selection"
          className="shrink-0 bg-[#1C1C1E] rounded-full px-4 py-2 text-[15px] font-medium text-[#0A84FF] focus:outline-none appearance-none text-center"
        >
          <option value="all">Warehouse Selection</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {user?.isAdmin && (
          <>
            <button
              onClick={() => setShowWarehousesMgr(true)}
              className="shrink-0 bg-[#1C1C1E] rounded-full px-4 py-2 text-[15px] font-medium text-[#0A84FF] active:bg-[#2C2C2E] transition-colors"
            >
              Warehouses
            </button>
            <button
              onClick={() => setShowProductsMgr(true)}
              className="shrink-0 bg-[#1C1C1E] rounded-full px-4 py-2 text-[15px] font-medium text-[#0A84FF] active:bg-[#2C2C2E] transition-colors"
            >
              Products
            </button>
          </>
        )}
      </div>

      {/* Filter card */}
      <div className="bg-[#1C1C1E] rounded-[14px] p-4 mb-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[14px] text-white leading-tight min-w-0">Low Inventory Only</span>
            <Switch checked={showLowOnly} onChange={setShowLowOnly} label="Low inventory only" />
          </div>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-[14px] text-white leading-tight min-w-0">Hide Out of Stock</span>
            <Switch checked={hideOutOfStock} onChange={setHideOutOfStock} label="Hide out of stock" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-1 mt-1 -mx-2 flex-wrap">
          <TextAction
            onClick={() => setFiltersOpen((v) => !v)}
            icon={<CircleGlyph><ChevronDownIcon className={`w-3 h-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} /></CircleGlyph>}
          >
            {filtersOpen ? "Hide Filters" : "Show Filters"}
          </TextAction>
          <TextAction
            onClick={() => { setSelectedCategory("All"); setSearch(""); setShowLowOnly(false); setHideOutOfStock(false); setSelectedWarehouse("all"); }}
            icon={<CircleGlyph><CloseIcon className="w-3 h-3" /></CircleGlyph>}
          >
            Clear Filters
          </TextAction>
          <TextAction onClick={() => load()} icon={<RefreshGlyph />}>
            Refresh
          </TextAction>
        </div>
      </div>

      {filtersOpen && (
        <div className="space-y-3 mb-3">
          <SearchField value={search} onChange={setSearch} />

          {categories.length > 1 && (
            <>
              <button
                onClick={() => setCategoriesOpen((v) => !v)}
                className="w-full bg-[#1C1C1E] rounded-[14px] px-4 py-3.5 flex items-center justify-between"
              >
                <span className="text-[17px] font-medium text-[#0A84FF]">
                  {selectedCategory === "All" ? "Filter Categories" : selectedCategory}
                </span>
                <SlidersGlyph />
              </button>
              {categoriesOpen && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar sm:flex-wrap">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`shrink-0 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-colors ${
                        selectedCategory === cat ? "bg-[#0A84FF] text-white" : "bg-[#1C1C1E] text-[rgba(235,235,245,0.6)]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Item cards */}
      {filtered.length === 0 ? (
        <div className="bg-[#1C1C1E] rounded-[14px] px-6 py-12 text-center text-[15px] text-[rgba(235,235,245,0.6)]">
          No items match your filters
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => (
            <InventoryCard
              key={`${item.warehouseID}-${item.id}`}
              item={item}
              onSelect={() => setDetail(item)}
            />
          ))}
        </div>
      )}

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
  const barColor = outOfStock ? "bg-red-500" : low ? "bg-amber-400" : "bg-[#0A84FF]";

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
    <Sheet title={item.name} subtitle={item.category} onClose={onClose}>
      <>
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

        <div className="bg-[#000000] rounded-xl p-4 mb-4">
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
              className="mt-3 px-3 py-2 -ml-1 rounded-lg text-xs font-medium text-[#0A84FF] bg-[#0A84FF]/10 border border-[#0A84FF]/20 active:bg-[#0A84FF]/20 transition-colors"
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
                inputMode="numeric"
                className="w-24 bg-[#1C1C1E] rounded-[12px] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0A84FF]"
              />
              <span className="text-xs text-gray-500">{item.unit ?? ""}</span>
              <button
                onClick={handleSaveQty}
                disabled={savingQty}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors disabled:opacity-50"
              >
                {savingQty ? "…" : "Save"}
              </button>
              <button
                onClick={() => setEditingQty(false)}
                className="px-4 py-2 text-xs rounded-lg border border-[#2C2C2E] text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {pct !== null && (
          <div className="mb-5">
            <div className="h-2 bg-[#3A3A3C] rounded-full overflow-hidden">
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
          <div className="border-t border-[#2C2C2E] pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Details</p>
              {isAdmin && !editingDetails && (
                <button
                  onClick={() => { setDetailValues(item.details ?? {}); setEditingDetails(true); }}
                  className="px-3 py-1.5 -mr-1 text-xs font-medium text-[#0A84FF] rounded-lg active:bg-[#0A84FF]/10 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            {!editingDetails ? (
              <div className="space-y-2">
                {detailFields!.map((field) => (
                  <div key={field.id} className="flex items-center justify-between py-1.5 border-b border-[#2C2C2E] last:border-0">
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
                      className="w-full bg-[#2C2C2E] border border-[#2C2C2E] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A84FF]"
                      placeholder={`Enter ${field.name}`}
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setEditingDetails(false)}
                    className="flex-1 py-2.5 rounded-lg text-xs border border-[#2C2C2E] text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDetails}
                    disabled={savingDetails}
                    className="flex-1 py-2.5 rounded-lg text-xs font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors disabled:opacity-50"
                  >
                    {savingDetails ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    </Sheet>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2C2C2E] last:border-0">
      <span className="text-gray-500">{label}</span>
      <div>{children}</div>
    </div>
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
    <>
      <Sheet title="Manage Products" onClose={onClose} size="xl">
        <div className="sticky top-0 z-10 -mx-5 sm:-mx-6 px-5 sm:px-6 pb-3 bg-[#1C1C1E] flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 bg-[#000000] border border-[#2C2C2E] rounded-lg px-3 py-2.5 sm:py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowRetired((v) => !v)}
              className={`flex-1 sm:flex-none px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                showRetired ? "bg-gray-500/20 border-gray-500/40 text-gray-300" : "border-[#2C2C2E] text-gray-500 hover:text-gray-300"
              }`}
            >
              {showRetired ? "Hiding Retired" : "Show Retired"}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Product
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">No products found</p>
        ) : (
          <div className="divide-y divide-[#38383A] -mx-5 sm:-mx-6">
            {filtered.map((product) => {
              const totalQty = qtyByProduct[product.id!] ?? 0;
              return (
                <div key={product.id} className="px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-white text-sm break-words">{product.name}</p>
                      {product.isRetired && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/20">Retired</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[product.category, product.unit].filter(Boolean).join(" · ")}
                      {totalQty > 0 && <span className="text-gray-400 ml-2">{totalQty} in stock</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 -ml-2 sm:ml-0">
                    <button
                      onClick={() => setEditProduct(product)}
                      className="px-3 py-2 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleRetire(product)}
                      className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                        product.isRetired ? "text-green-400 hover:bg-green-400/10" : "text-amber-400 hover:bg-amber-400/10"
                      }`}
                    >
                      {product.isRetired ? "Reactivate" : "Retire"}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setConfirmDelete(product)}
                        className="px-3 py-2 text-xs rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
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
      </Sheet>

      {(showAdd || editProduct) && (
        <ProductFormModal
          product={editProduct}
          onSave={(data) => saveProduct(data, editProduct?.id)}
          onClose={() => { setShowAdd(false); setEditProduct(null); }}
        />
      )}

      {confirmDelete && (
        <Sheet
          title={`Delete "${confirmDelete.name}"?`}
          onClose={() => setConfirmDelete(null)}
          size="sm"
          zIndex={60}
          footer={
            <SheetActions onCancel={() => setConfirmDelete(null)}>
              <PrimaryButton tone="red" disabled={deleting} onClick={() => handleDelete(confirmDelete)}>
                {deleting ? "Deleting…" : "Delete Permanently"}
              </PrimaryButton>
            </SheetActions>
          }
        >
          <p className="text-sm text-gray-400">
            This will permanently remove the product and all its warehouse inventory records. This cannot be undone.
          </p>
        </Sheet>
      )}
    </>
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

  const inputCls = "w-full bg-[#2C2C2E] border border-[#2C2C2E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]";

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
    <Sheet
      title={isEdit ? "Edit Product" : "Add Product"}
      onClose={onClose}
      zIndex={60}
      footer={
        <SheetActions onCancel={onClose}>
          <PrimaryButton onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
          </PrimaryButton>
        </SheetActions>
      }
    >
      <div className="space-y-3">
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
          <input type="number" inputMode="numeric" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputCls} placeholder="e.g. 10" />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>
    </Sheet>
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

  const inputCls = "w-full bg-[#2C2C2E] border border-[#2C2C2E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]";

  return (
    <>
      <Sheet
        title="Manage Warehouses"
        onClose={onClose}
        size="lg"
        footer={
          <button
            onClick={openAdd}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Warehouse
          </button>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>
        ) : warehouseList.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">No warehouses yet</p>
        ) : (
          <div className="divide-y divide-[#38383A] -mx-5 sm:-mx-6">
            {warehouseList.map((wh) => (
              <div key={wh.id} className="px-5 sm:px-6 py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm break-words">{wh.name}</p>
                  {wh.location && <p className="text-xs text-gray-500 mt-0.5">{wh.location}</p>}
                </div>
                <button onClick={() => openEdit(wh)} className="shrink-0 px-3 py-2 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors">Edit</button>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {showForm && (
        <Sheet
          title={editWarehouse ? "Edit Warehouse" : "New Warehouse"}
          onClose={() => setShowForm(false)}
          zIndex={60}
          footer={
            <SheetActions onCancel={() => setShowForm(false)}>
              <PrimaryButton onClick={handleSave} disabled={!whName.trim() || saving}>
                {saving ? "Saving…" : editWarehouse ? "Save Changes" : "Add Warehouse"}
              </PrimaryButton>
            </SheetActions>
          }
        >
          <div className="space-y-3">
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
        </Sheet>
      )}
    </>
  );
}


// ── Inventory item card — one card per item, with the reorder threshold
// marked on the stock bar, matching the native list. ────────────────────────

function InventoryCard({ item, onSelect }: { item: InventoryEntry; onSelect: () => void }) {
  const qty = item.quantity ?? 0;
  const threshold = item.reorderThreshold ?? 0;
  const outOfStock = qty === 0;
  const low = threshold > 0 && qty <= threshold;

  // Full-scale bar: threshold sits at a fixed fraction so the marker is
  // meaningful across very different stock levels.
  const scaleMax = Math.max(qty, threshold * 2, 1);
  const fillPct = Math.min(100, (qty / scaleMax) * 100);
  const markPct = threshold > 0 ? Math.min(100, (threshold / scaleMax) * 100) : null;

  const barColor = outOfStock ? "bg-[#FF453A]" : low ? "bg-[#FF9F0A]" : "bg-[#30D158]";
  const availColor = outOfStock ? "text-[#FF453A]" : low ? "text-[#FF9F0A]" : "text-[rgba(235,235,245,0.6)]";

  return (
    <button
      onClick={onSelect}
      className="w-full text-left bg-[#1C1C1E] rounded-[14px] px-4 py-3 active:bg-[#2C2C2E] transition-colors"
    >
      <div className="flex items-start gap-3">
        <BoxIcon className="w-[22px] h-[22px] text-[#0A84FF] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[16px] font-semibold text-white leading-snug break-words">{item.name}</span>
            {outOfStock ? <Pill tint="red">Out of stock</Pill> : low ? <Pill tint="orange">Low stock</Pill> : null}
          </div>
          <p className={`text-[14px] mt-0.5 ${availColor}`}>
            Available: {qty.toLocaleString()} {item.unit ?? ""}
          </p>
          {item.warehouseName && (
            <p className="text-[12px] text-[rgba(235,235,245,0.3)] mt-0.5 truncate">
              {[item.category, item.warehouseName].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <ChevronRightIcon className="w-[13px] h-[13px] text-[rgba(235,235,245,0.3)] shrink-0 mt-2" />
      </div>

      <div className="relative mt-2.5 h-[3px] rounded-full bg-[#3A3A3C]">
        <div className={`absolute inset-y-0 left-0 rounded-full ${barColor}`} style={{ width: `${fillPct}%` }} />
        {markPct !== null && (
          <span
            aria-hidden="true"
            title={`Reorder at ${threshold}`}
            className="absolute -top-[2px] w-[2px] h-[7px] rounded-full bg-[#FF453A]"
            style={{ left: `calc(${markPct}% - 1px)` }}
          />
        )}
      </div>
    </button>
  );
}

function CircleGlyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-[18px] h-[18px] rounded-full border-[1.5px] border-current flex items-center justify-center shrink-0">
      {children}
    </span>
  );
}

function RefreshGlyph() {
  return (
    <svg className="w-[17px] h-[17px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function SlidersGlyph() {
  return (
    <svg className="w-[19px] h-[19px] text-[#0A84FF] shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6.6h9.2a2.8 2.8 0 0 0 5.4 0H21a.9.9 0 0 0 0-1.8h-3.4a2.8 2.8 0 0 0-5.4 0H3a.9.9 0 0 0 0 1.8Zm18 4.5h-9.2a2.8 2.8 0 0 0-5.4 0H3a.9.9 0 1 0 0 1.8h3.4a2.8 2.8 0 0 0 5.4 0H21a.9.9 0 0 0 0-1.8Zm0 6.3h-3.4a2.8 2.8 0 0 0-5.4 0H3a.9.9 0 0 0 0 1.8h9.2a2.8 2.8 0 0 0 5.4 0H21a.9.9 0 0 0 0-1.8Z" />
    </svg>
  );
}
