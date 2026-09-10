"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import type { Equipment } from "@/lib/types";

const statusVariant: Record<string, "green" | "blue" | "yellow" | "red" | "gray"> = {
  available: "green",
  checkedOut: "blue",
  inRepair: "yellow",
  retired: "gray",
};

export default function EquipmentPage() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "Equipment"));
    setEquipment(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Equipment, "id">) })));
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return equipment.filter((e) => {
      if (!showRetired && e.status === "retired") return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [equipment, search, showRetired]);

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
          <h2 className="text-2xl font-bold text-white">Equipment</h2>
          <p className="text-gray-400 mt-1 text-sm">{filtered.length} items</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          type="search"
          placeholder="Search equipment…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] w-64"
        />
        <button
          onClick={() => setShowRetired((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            showRetired
              ? "bg-gray-500/20 border-gray-500/40 text-gray-300"
              : "bg-transparent border-[#2a2f3e] text-gray-500 hover:text-gray-300"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8" />
          </svg>
          {showRetired ? "Hiding retired" : "Show retired"}
        </button>
      </div>

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2f3e]">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Serial #</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Checked Out To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2f3e]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">No equipment found</td>
              </tr>
            ) : (
              filtered.map((eq) => (
                <tr key={eq.id} className={`hover:bg-white/[0.02] transition-colors ${eq.status === "retired" ? "opacity-50" : ""}`}>
                  <td className="px-6 py-3.5">
                    <Link href={`/equipment/${eq.id}`} className="font-medium text-white hover:text-[#35B2FF] transition-colors">
                      {eq.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-gray-400">{eq.category ?? "—"}</td>
                  <td className="px-6 py-3.5 text-gray-400 font-mono text-xs">{eq.serialNumber ?? "—"}</td>
                  <td className="px-6 py-3.5">
                    <Badge variant={statusVariant[eq.status] ?? "gray"}>{eq.status}</Badge>
                  </td>
                  <td className="px-6 py-3.5 text-gray-400">{eq.currentHolderName ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
