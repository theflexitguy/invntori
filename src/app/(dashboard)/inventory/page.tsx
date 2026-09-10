"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import type { FirestoreInventoryItem, Warehouse } from "@/lib/types";

export default function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FirestoreInventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const cid = user.companyID;
    const [invSnap, whSnap] = await Promise.all([
      getDocs(collection(db, "companies", cid, "Inventory")),
      getDocs(collection(db, "companies", cid, "Warehouses")),
    ]);
    setItems(invSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreInventoryItem, "id">) })));
    setWarehouses(whSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Warehouse, "id">) })));
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchWarehouse = selectedWarehouse === "all" || item.warehouseID === selectedWarehouse;
      const matchSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category?.toLowerCase().includes(search.toLowerCase());
      return matchWarehouse && matchSearch;
    });
  }, [items, selectedWarehouse, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Inventory</h2>
          <p className="text-gray-400 mt-1 text-sm">{filtered.length} items</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          type="search"
          placeholder="Search items…"
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
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2f3e]">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Warehouse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2f3e]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No items found</td>
              </tr>
            ) : (
              filtered.map((item) => {
                const wh = warehouses.find((w) => w.id === item.warehouseID);
                const low = item.quantity <= (item.reorderThreshold ?? 0);
                return (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-white">{item.name}</p>
                    </td>
                    <td className="px-6 py-3.5 text-gray-400">{item.category ?? "—"}</td>
                    <td className="px-6 py-3.5 text-right">
                      <span className={low ? "text-red-400 font-semibold" : "text-white"}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-gray-400">{item.unit ?? "—"}</td>
                    <td className="px-6 py-3.5 text-gray-400">{wh?.name ?? item.warehouseID ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
