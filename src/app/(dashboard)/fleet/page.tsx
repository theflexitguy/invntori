"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import type { Vehicle } from "@/lib/types";

const conditionVariant: Record<string, "green" | "blue" | "yellow" | "red"> = {
  excellent: "green",
  good: "blue",
  fair: "yellow",
  poor: "red",
};

const conditionLabel: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export default function FleetPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "vehicles"));
    setVehicles(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (!showRetired && v.isRetired) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!v.name.toLowerCase().includes(q) &&
            !v.make?.toLowerCase().includes(q) &&
            !v.model?.toLowerCase().includes(q) &&
            !v.licensePlate?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [vehicles, search, showRetired]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Fleet</h2>
        <p className="text-gray-400 mt-1 text-sm">{filtered.length} vehicles</p>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          type="search"
          placeholder="Search by name, make, model, or plate…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] w-72"
        />
        <button
          onClick={() => setShowRetired((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            showRetired ? "bg-gray-500/20 border-gray-500/40 text-gray-300" : "bg-transparent border-[#2a2f3e] text-gray-500 hover:text-gray-300"
          }`}
        >
          {showRetired ? "Hiding Retired" : "Show Retired"}
        </button>
      </div>

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2f3e]">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Year / Make / Model</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">License</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Driver</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Condition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2f3e]">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No vehicles found</td></tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className={`hover:bg-white/[0.02] transition-colors ${v.isRetired ? "opacity-50" : ""}`}>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <Link href={`/fleet/${v.id}`} className="font-medium text-white hover:text-[#35B2FF] transition-colors">
                        {v.name}
                      </Link>
                      {v.isRetired && <Badge variant="gray">Retired</Badge>}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-gray-400">
                    {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-6 py-3.5 text-gray-400 font-mono text-xs">{v.licensePlate ?? "—"}</td>
                  <td className="px-6 py-3.5 text-gray-400">{v.currentDriverName ?? "Unassigned"}</td>
                  <td className="px-6 py-3.5">
                    {v.isRetired
                      ? <Badge variant="gray">Retired</Badge>
                      : v.condition
                        ? <Badge variant={conditionVariant[v.condition] ?? "gray"}>{conditionLabel[v.condition] ?? v.condition}</Badge>
                        : <span className="text-gray-600">—</span>
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
