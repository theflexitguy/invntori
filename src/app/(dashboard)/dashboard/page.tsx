"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import type { InventoryRequest } from "@/lib/types";

interface Stats {
  totalInventoryItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  equipmentCheckedOut: number;
  equipmentInRepair: number;
  activeVehicles: number;
  pendingRequests: number;
  warehouseCount: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRequests, setRecentRequests] = useState<InventoryRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.companyID) return;
    loadDashboard();
  }, [user]);

  async function loadDashboard() {
    if (!user?.companyID) return;
    const cid = user.companyID;

    try {
      const [whSnap, eqSnap, vSnap, pendingSnap, recentSnap] = await Promise.all([
        getDocs(collection(db, "companies", cid, "warehouses")),
        getDocs(collection(db, "companies", cid, "equipment")),
        getDocs(collection(db, "companies", cid, "vehicles")),
        getDocs(query(collection(db, "companies", cid, "inventoryRequests"), where("status", "==", "Pending"))),
        getDocs(query(collection(db, "companies", cid, "inventoryRequests"), orderBy("timestamp", "desc"), limit(5))),
      ]);

      // Count all inventory items across warehouses
      const invSnaps = await Promise.all(
        whSnap.docs.map((w) => getDocs(collection(db, "companies", cid, "warehouses", w.id, "inventory")))
      );

      let totalItems = 0, lowStock = 0, outOfStock = 0;
      invSnaps.forEach((snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();
          totalItems++;
          if ((data.quantity ?? 0) === 0) outOfStock++;
          else if ((data.reorderThreshold ?? 0) > 0 && data.quantity <= data.reorderThreshold) lowStock++;
        });
      });

      setStats({
        totalInventoryItems: totalItems,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
        equipmentCheckedOut: eqSnap.docs.filter((d) => d.data().status === "checkedOut").length,
        equipmentInRepair: eqSnap.docs.filter((d) => d.data().status === "inRepair").length,
        activeVehicles: vSnap.docs.filter((d) => !d.data().isRetired).length,
        pendingRequests: pendingSnap.size,
        warehouseCount: whSnap.size,
      });

      setRecentRequests(
        recentSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryRequest, "id">) }))
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  const s = stats!;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 mt-1 text-sm">
          Welcome back{user?.displayName ? `, ${user.displayName}` : ""}
        </p>
      </div>

      {/* Alert strip */}
      {(s.lowStockCount > 0 || s.outOfStockCount > 0 || s.equipmentInRepair > 0 || s.pendingRequests > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {s.lowStockCount > 0 && (
            <Link href="/inventory" className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 hover:bg-amber-400/15 transition-colors">
              <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-400">{s.lowStockCount} Low Stock</p>
                <p className="text-xs text-amber-400/70">View inventory</p>
              </div>
            </Link>
          )}
          {s.equipmentInRepair > 0 && (
            <Link href="/equipment" className="flex items-center gap-3 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 hover:bg-red-400/15 transition-colors">
              <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-400">{s.equipmentInRepair} In Repair</p>
                <p className="text-xs text-red-400/70">View equipment</p>
              </div>
            </Link>
          )}
          {s.pendingRequests > 0 && (
            <Link href="/requests" className="flex items-center gap-3 bg-[#35B2FF]/10 border border-[#35B2FF]/20 rounded-xl px-4 py-3 hover:bg-[#35B2FF]/15 transition-colors">
              <svg className="w-5 h-5 text-[#35B2FF] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-[#35B2FF]">{s.pendingRequests} Pending</p>
                <p className="text-xs text-[#35B2FF]/70">View requests</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Main stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard href="/inventory" label="Inventory Items" value={s.totalInventoryItems} sub={`${s.warehouseCount} warehouse${s.warehouseCount !== 1 ? "s" : ""}`} color="blue" />
        <StatCard href="/equipment" label="Equipment Out" value={s.equipmentCheckedOut} sub="currently checked out" color="emerald" />
        <StatCard href="/fleet" label="Active Vehicles" value={s.activeVehicles} sub="in service" color="violet" />
      </div>

      {/* Recent requests */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2f3e] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recent Requests</h3>
          <Link href="/requests" className="text-xs text-[#35B2FF] hover:underline">View all</Link>
        </div>
        {recentRequests.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">No requests yet</div>
        ) : (
          <div className="divide-y divide-[#2a2f3e]">
            {recentRequests.map((r) => (
              <div key={r.id} className="px-6 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">
                    {r.items?.length === 1 ? r.items[0].productName : `${r.items?.length ?? 0} items`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.submittedBy}</p>
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

function StatCard({ href, label, value, sub, color }: { href: string; label: string; value: number; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "text-[#35B2FF] bg-[#35B2FF]/10",
    emerald: "text-emerald-400 bg-emerald-400/10",
    violet: "text-violet-400 bg-violet-400/10",
    amber: "text-amber-400 bg-amber-400/10",
  };
  const [text, bg] = (colors[color] ?? colors.blue).split(" ");
  return (
    <Link href={href} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-5 hover:border-[#35B2FF]/40 transition-colors group">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <span className={`text-xl font-bold ${text}`}>{value}</span>
      </div>
      <p className="text-sm font-medium text-white group-hover:text-gray-200 transition-colors">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending:   "bg-amber-400/15 text-amber-400",
    Completed: "bg-green-400/15 text-green-400",
    Returned:  "bg-red-400/15 text-red-400",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status] ?? "bg-gray-400/15 text-gray-400"}`}>
      {status}
    </span>
  );
}
