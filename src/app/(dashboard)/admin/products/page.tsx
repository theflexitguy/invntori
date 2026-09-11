"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { LargeTitle, Switch, Pill, NavCircleButton } from "@/components/ui/ios";
import { NavBarRight } from "@/components/layout/NavBarSlot";
import { PlusIcon } from "@/components/ui/PageHeader";
import { GridIcon, RulerIcon, BoxIcon, DollarCircleIcon } from "@/components/layout/nav";
import { ProductFormSheet } from "./ProductFormSheet";
import type { ComponentType } from "react";
import type { Product, Warehouse } from "@/lib/types";

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [unitTypes, setUnitTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Record<string, { warehouse: string; qty: number }[]>>({});

  const canDelete = !!(user?.isAdmin || user?.managePermissions?.includes("deleteProducts"));

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [productSnap, whSnap, unitSnap, catSnap] = await Promise.all([
      getDocs(collection(db, "companies", cid, "products")),
      getDocs(collection(db, "companies", cid, "warehouses")),
      getDocs(collection(db, "companies", cid, "unitTypes")),
      getDocs(collection(db, "companies", cid, "categories")),
    ]);
    setProducts(productSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) })).sort((a, b) => a.name.localeCompare(b.name)));
    const whs = whSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string }));
    setWarehouses(whs);
    setUnitTypes(unitSnap.docs.map((d) => d.data().unitname as string).filter(Boolean).sort());
    setCategories(catSnap.docs.map((d) => d.data().categoryname as string).filter(Boolean).sort());

    // Stock per product, per warehouse — the editor shows the breakdown.
    const invSnaps = await Promise.all(
      whs.map((wh) => getDocs(collection(db, "companies", cid, "warehouses", wh.id, "inventory")))
    );
    const byProduct: Record<string, { warehouse: string; qty: number }[]> = {};
    invSnaps.forEach((snap, i) => {
      snap.docs.forEach((d) => {
        const qty = typeof d.data().quantity === "number" ? d.data().quantity : 0;
        (byProduct[d.id] ??= []).push({ warehouse: whs[i].name, qty });
      });
    });
    setStockByProduct(byProduct);
    setLoading(false);
  }, [user?.companyID]);

  useEffect(() => { load(); }, [load]);

  async function toggleRetire(product: Product) {
    if (!user?.companyID || !product.id) return;
    const nowRetired = !product.isRetired;
    await updateDoc(doc(db, "companies", user.companyID, "products", product.id), { isRetired: nowRetired });
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, isRetired: nowRetired } : p));
  }

  async function handleDelete(product: Product) {
    if (!user?.companyID || !product.id) return;
    setDeleting(true);
    try {
      const batch = writeBatch(db);
      for (const wh of warehouses) {
        if (wh.id) batch.delete(doc(db, "companies", user.companyID, "warehouses", wh.id, "inventory", product.id));
      }
      batch.delete(doc(db, "companies", user.companyID, "products", product.id));
      await batch.commit();
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  async function saveProduct(data: Omit<Product, "id">, productId?: string) {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const payload = data as Record<string, unknown>;
    if (productId) {
      await updateDoc(doc(db, "companies", cid, "products", productId), payload);
      const syncData: Record<string, unknown> = { name: data.name };
      if (data.category !== undefined) syncData.category = data.category;
      if (data.unit !== undefined) syncData.unit = data.unit;
      if (data.reorderThreshold !== undefined) syncData.reorderThreshold = data.reorderThreshold;
      if (warehouses.length > 0) {
        const batch = writeBatch(db);
        for (const wh of warehouses) {
          if (wh.id) batch.set(doc(db, "companies", cid, "warehouses", wh.id, "inventory", productId), syncData, { merge: true });
        }
        await batch.commit();
      }
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, ...data } : p));
      setEditProduct(null);
    } else {
      const docRef = await addDoc(collection(db, "companies", cid, "products"), payload);
      if (warehouses.length > 0) {
        const batch = writeBatch(db);
        const invData = { name: data.name, category: data.category ?? "", unit: data.unit ?? "", reorderThreshold: data.reorderThreshold ?? 0, quantity: 0 };
        for (const wh of warehouses) {
          if (wh.id) batch.set(doc(db, "companies", cid, "warehouses", wh.id, "inventory", docRef.id), invData);
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

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  const totalQty = (id?: string) =>
    (stockByProduct[id ?? ""] ?? []).reduce((sum, r) => sum + r.qty, 0);

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-2xl">
      {user?.isAdmin && (
        <NavBarRight>
          <NavCircleButton label="Add product" onClick={() => setShowAdd(true)}>
            <PlusIcon className="w-[17px] h-[17px]" />
          </NavCircleButton>
        </NavBarRight>
      )}

      <LargeTitle title="Manage Products" />

      {/* Search — the native screen sets the glyph outside the field */}
      <div className="flex items-center gap-3 mb-4">
        <svg
          className="w-[22px] h-[22px] text-white shrink-0"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M10.5 3a7.5 7.5 0 1 0 4.55 13.46l4.24 4.25a1.1 1.1 0 0 0 1.56-1.56l-4.25-4.24A7.5 7.5 0 0 0 10.5 3Zm0 2.2a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Products"
          className="flex-1 min-w-0 bg-[#1C1C1E] rounded-[12px] px-4 py-3 text-[17px] text-white placeholder-[rgba(235,235,245,0.4)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]/60"
        />
      </div>

      <div className="flex items-center justify-between gap-4 pb-4 mb-4 border-b border-[#38383A]/70">
        <span className="text-[17px] font-semibold text-white">Show Retired Products</span>
        <Switch checked={showRetired} onChange={setShowRetired} label="Show retired products" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#1C1C1E] rounded-[14px] px-6 py-12 text-center text-[15px] text-[rgba(235,235,245,0.6)]">
          No products found
        </div>
      ) : (
        <div>
          {filtered.map((p, i) => (
            <div key={p.id}>
              <button
                onClick={() => user?.isAdmin && setEditProduct(p)}
                className={`w-full text-left bg-[#1C1C1E] rounded-[12px] px-4 py-3.5 active:bg-[#2C2C2E] transition-colors ${
                  p.isRetired ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[17px] font-semibold text-white break-words">{p.name}</span>
                  {p.isRetired && <Pill tint="gray">Retired</Pill>}
                </div>
                <dl className="mt-1.5 space-y-1">
                  <MetaRow Icon={GridIcon} label="Category" value={p.category ?? "—"} />
                  <MetaRow Icon={RulerIcon} label="Unit" value={p.unit ?? "—"} />
                  <MetaRow
                    Icon={DollarCircleIcon}
                    label="Unit Cost"
                    value={
                      p.unitCost != null
                        ? p.unitCost.toLocaleString("en-US", { style: "currency", currency: "USD" })
                        : "—"
                    }
                  />
                  <MetaRow Icon={BoxIcon} label="Quantity" value={totalQty(p.id).toLocaleString()} />
                </dl>
              </button>
              {i < filtered.length - 1 && <div className="border-t border-[#38383A]/70 my-3 ml-8" />}
            </div>
          ))}
        </div>
      )}

      {(showAdd || editProduct) && (
        <ProductFormSheet
          product={editProduct}
          unitTypes={unitTypes}
          categories={categories}
          stock={stockByProduct[editProduct?.id ?? ""] ?? []}
          canDelete={canDelete && !!editProduct}
          deleting={deleting}
          onDelete={() => editProduct && handleDelete(editProduct)}
          onSave={(data) => saveProduct(data, editProduct?.id)}
          onClose={() => { setShowAdd(false); setEditProduct(null); }}
        />
      )}

    </div>
  );
}

function MetaRow({
  Icon,
  label,
  value,
}: {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="w-[15px] h-[15px] text-[rgba(235,235,245,0.6)] shrink-0" />
      <dt className="text-[15px] font-semibold text-[rgba(235,235,245,0.85)]">{label}:</dt>
      <dd className="text-[15px] text-[rgba(235,235,245,0.6)] min-w-0 truncate">{value}</dd>
    </div>
  );
}
