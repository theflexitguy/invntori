"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import type { Vehicle } from "@/lib/types";

export default function FleetPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "Vehicles"));
    setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) })));
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (!showRetired && v.isRetired) return false;
      if (search && !v.name.toLowerCase().includes(search.toLowerCase()) &&
          !`${v.make ?? ""} ${v.model ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [vehicles, search, showRetired]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
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
          placeholder="Search vehicles…"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 py-10">No vehicles found</p>
        ) : (
          filtered.map((v) => (
            <Link
              key={v.id}
              href={`/fleet/${v.id}`}
              className={`bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-5 hover:border-[#35B2FF]/40 transition-colors ${v.isRetired ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-violet-400/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4zM3 10l1.5-4.5A1 1 0 015.45 5h13.1a1 1 0 01.95.68L21 10M3 10h18M3 10v7h1m14 0h1v-7" />
                  </svg>
                </div>
                {v.isRetired && <Badge variant="gray">Retired</Badge>}
              </div>
              <p className="font-semibold text-white">{v.name}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
              </p>
              {v.licensePlate && (
                <p className="text-xs text-gray-500 mt-1 font-mono">{v.licensePlate}</p>
              )}
              {v.currentDriverName && !v.isRetired && (
                <div className="mt-3 pt-3 border-t border-[#2a2f3e]">
                  <p className="text-xs text-gray-500">Driver</p>
                  <p className="text-sm text-white mt-0.5">{v.currentDriverName}</p>
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
