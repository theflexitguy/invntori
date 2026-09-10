"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import type { FirestoreInventoryItem, Warehouse } from "@/lib/types";

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

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const whSnap = await getDocs(collection(db, "companies", cid, "warehouses"));
    const whs: Warehouse[] = whSnap.docs.map((d) => ({ id: d.id, name: d.data().name, ...d.data() }));
    setWarehouses(whs);

    const allItems: InventoryEntry[] = [];
    await Promise.all(
      whs.map(async (wh) => {
        const snap = await getDocs(collection(db, "companies", cid, "warehouses", wh.id!, "inventory"));
        snap.docs.forEach((d) => {
          allItems.push({ id: d.id, warehouseID: wh.id, warehouseName: wh.name, ...(d.data() as Omit<FirestoreInventoryItem, "id" | "warehouseID">) });
        });
      })
    );
    setItems(allItems.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
    setLoading(false);
  }

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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  const lowCount = items.filter((i) => (i.quantity ?? 0) <= (i.reorderThreshold ?? 0) && (i.reorderThreshold ?? 0) > 0).length;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Inventory</h2>
          <p className="text-gray-400 mt-1 text-sm">{filtered.length} items · {warehouses.length} warehouses</p>
        </div>
        {lowCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm text-amber-400 font-medium">{lowCount} low stock</span>
          </div>
        )}
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

        {/* Category filter pills */}
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
                <div key={`${item.warehouseID}-${item.id}`} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
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
                    <div className="text-right shrink-0">
                      <span className={`text-lg font-bold ${outOfStock ? "text-red-400" : low ? "text-amber-400" : "text-white"}`}>
                        {qty}
                      </span>
                      <span className="text-gray-500 text-sm ml-1">{item.unit ?? ""}</span>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
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
