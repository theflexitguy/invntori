"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
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

  const canDelete = !!(user?.isAdmin || user?.managePermissions?.includes("deleteProducts"));

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [productSnap, whSnap] = await Promise.all([
      getDocs(collection(db, "companies", cid, "products")),
      getDocs(collection(db, "companies", cid, "warehouses")),
    ]);
    setProducts(productSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) })).sort((a, b) => a.name.localeCompare(b.name)));
    setWarehouses(whSnap.docs.map((d) => ({ id: d.id, name: d.data().name })));
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

  return (
    <div className="p-6 xl:p-8 w-full">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm">Admin</Link>
        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-sm text-white">Products</span>
      </div>

      <div className="flex items-start justify-between mb-6 mt-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Products</h2>
          <p className="text-gray-400 mt-1 text-sm">{filtered.length} products</p>
        </div>
        {user?.isAdmin && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Product
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] w-72"
        />
        <button
          onClick={() => setShowRetired((v) => !v)}
          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${showRetired ? "bg-gray-500/20 border-gray-500/40 text-gray-300" : "border-[#2a2f3e] text-gray-500 hover:text-gray-300"}`}
        >
          {showRetired ? "Hiding Retired" : "Show Retired"}
        </button>
      </div>

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2f3e]">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reorder At</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Cost</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2f3e]">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">No products found</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className={`hover:bg-white/[0.02] transition-colors ${p.isRetired ? "opacity-50" : ""}`}>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{p.name}</span>
                      {p.isRetired && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/20">Retired</span>}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-gray-400">{p.category ?? "—"}</td>
                  <td className="px-6 py-3.5 text-gray-400">{p.unit ?? "—"}</td>
                  <td className="px-6 py-3.5 text-gray-400">{p.reorderThreshold != null ? p.reorderThreshold : "—"}</td>
                  <td className="px-6 py-3.5 text-gray-400">
                    {p.unitCost != null ? p.unitCost.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—"}
                  </td>
                  <td className="px-6 py-3.5">
                    {user?.isAdmin && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setEditProduct(p)} className="px-2.5 py-1.5 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Edit</button>
                        <button onClick={() => toggleRetire(p)} className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${p.isRetired ? "text-green-400 hover:bg-green-400/10" : "text-amber-400 hover:bg-amber-400/10"}`}>
                          {p.isRetired ? "Reactivate" : "Retire"}
                        </button>
                        {canDelete && (
                          <button onClick={() => setConfirmDelete(p)} className="px-2.5 py-1.5 text-xs rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">Delete</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(showAdd || editProduct) && (
        <ProductFormModal
          product={editProduct}
          onSave={(data) => saveProduct(data, editProduct?.id)}
          onClose={() => { setShowAdd(false); setEditProduct(null); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
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

function ProductFormModal({ product, onSave, onClose }: {
  product: Product | null;
  onSave: (data: Omit<Product, "id">) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [threshold, setThreshold] = useState(product?.reorderThreshold != null ? String(product.reorderThreshold) : "");
  const [unitCost, setUnitCost] = useState(product?.unitCost != null ? String(product.unitCost) : "");
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
      const cost = parseFloat(unitCost);
      if (!isNaN(cost) && cost >= 0) data.unitCost = cost;
      if (isEdit && product?.isRetired !== undefined) data.isRetired = product.isRetired;
      await onSave(data);
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">{isEdit ? "Edit Product" : "Add Product"}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Bifenthrin Spray" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="e.g. Chemical" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} placeholder="e.g. oz" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Reorder Threshold</label>
              <input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputCls} placeholder="e.g. 10" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit Cost ($)</label>
              <input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={inputCls} placeholder="e.g. 12.50" />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}
