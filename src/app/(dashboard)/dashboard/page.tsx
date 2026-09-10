"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import type { FirestoreInventoryItem, Equipment, Vehicle, InventoryRequest } from "@/lib/types";

interface Stats {
  inventoryCount: number;
  equipmentCount: number;
  vehicleCount: number;
  pendingRequests: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRequests, setRecentRequests] = useState<InventoryRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    if (!user) return;
    const cid = user.companyID;

    try {
      const [invSnap, eqSnap, vSnap, reqSnap, pendingSnap] = await Promise.all([
        getDocs(collection(db, "companies", cid, "Inventory")),
        getDocs(collection(db, "companies", cid, "Equipment")),
        getDocs(collection(db, "companies", cid, "Vehicles")),
        getDocs(
          query(
            collection(db, "companies", cid, "InventoryRequests"),
            orderBy("createdAt", "desc"),
            limit(5)
          )
        ),
        getDocs(
          query(
            collection(db, "companies", cid, "InventoryRequests"),
            where("status", "==", "pending")
          )
        ),
      ]);

      setStats({
        inventoryCount: invSnap.size,
        equipmentCount: eqSnap.docs.filter((d) => (d.data() as Equipment).status !== "retired").length,
        vehicleCount: vSnap.docs.filter((d) => !(d.data() as Vehicle).isRetired).length,
        pendingRequests: pendingSnap.size,
      });

      setRecentRequests(
        reqSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryRequest, "id">) }))
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  const cards = [
    { label: "Inventory Items", value: stats?.inventoryCount ?? 0, color: "text-[#35B2FF]", bg: "bg-[#35B2FF]/10", href: "/inventory" },
    { label: "Equipment", value: stats?.equipmentCount ?? 0, color: "text-emerald-400", bg: "bg-emerald-400/10", href: "/equipment" },
    { label: "Vehicles", value: stats?.vehicleCount ?? 0, color: "text-violet-400", bg: "bg-violet-400/10", href: "/fleet" },
    { label: "Pending Requests", value: stats?.pendingRequests ?? 0, color: "text-amber-400", bg: "bg-amber-400/10", href: "/requests" },
  ];

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 mt-1 text-sm">Overview of your company resources</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((c) => (
          <a
            key={c.label}
            href={c.href}
            className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-5 hover:border-[#35B2FF]/40 transition-colors group"
          >
            <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
              <span className={`text-lg font-bold ${c.color}`}>{c.value}</span>
            </div>
            <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">{c.label}</p>
          </a>
        ))}
      </div>

      {/* Recent requests */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2f3e] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recent Requests</h3>
          <a href="/requests" className="text-xs text-[#35B2FF] hover:underline">View all</a>
        </div>
        {recentRequests.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">No requests yet</div>
        ) : (
          <div className="divide-y divide-[#2a2f3e]">
            {recentRequests.map((r) => (
              <div key={r.id} className="px-6 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">
                    {r.items?.length === 1 ? r.items[0].name : `${r.items?.length ?? 0} items`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.requestedByName}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-400/15 text-amber-400",
    approved: "bg-green-400/15 text-green-400",
    denied: "bg-red-400/15 text-red-400",
    fulfilled: "bg-blue-400/15 text-blue-400",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status] ?? "bg-gray-400/15 text-gray-400"}`}>
      {status}
    </span>
  );
}
