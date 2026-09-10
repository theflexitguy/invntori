"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import type { InventoryRequest, Warehouse } from "@/lib/types";

// iOS status values are capitalized
const STATUS_TABS = ["All", "Pending", "Completed", "Returned"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [tab, setTab] = useState<StatusTab>("Pending");
  const [filterWarehouse, setFilterWarehouse] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [reqSnap, whSnap] = await Promise.all([
      getDocs(query(collection(db, "companies", cid, "inventoryRequests"), orderBy("timestamp", "desc"))),
      getDocs(collection(db, "companies", cid, "warehouses")),
    ]);
    setRequests(reqSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryRequest, "id">) })));
    setWarehouses(whSnap.docs.map((d) => ({ id: d.id, name: d.data().name })));
    setLoading(false);
  }

  async function markComplete(id: string) {
    if (!user?.companyID) return;
    setUpdating(id);
    try {
      await updateDoc(doc(db, "companies", user.companyID, "inventoryRequests", id), {
        status: "Completed",
        completedAt: serverTimestamp(),
        completedBy: user.uid,
        completedByName: user.displayName ?? user.email ?? "",
      });
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "Completed" as const } : r));
    } finally {
      setUpdating(null);
    }
  }

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (tab !== "All" && r.status !== tab) return false;
      if (filterWarehouse !== "all" && r.warehouseID !== filterWarehouse) return false;
      // Non-admins see only their own requests
      if (!user?.isAdmin && r.submittedByUID !== user?.uid) return false;
      return true;
    });
  }, [requests, tab, filterWarehouse, user]);

  const counts = useMemo(() => {
    const base = user?.isAdmin ? requests : requests.filter((r) => r.submittedByUID === user?.uid);
    return STATUS_TABS.reduce((acc, t) => {
      acc[t] = t === "All" ? base.length : base.filter((r) => r.status === t).length;
      return acc;
    }, {} as Record<string, number>);
  }, [requests, user]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">
          {user?.isAdmin ? "Request Queue" : "My Requests"}
        </h2>
        <p className="text-gray-400 mt-1 text-sm">{filtered.length} requests</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === t ? "bg-[#35B2FF]/20 text-[#35B2FF]" : "text-gray-500 hover:text-white"
              }`}
            >
              {t}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t ? "bg-[#35B2FF]/30" : "bg-white/5"}`}>
                {counts[t]}
              </span>
            </button>
          ))}
        </div>
        {warehouses.length > 0 && (
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#35B2FF]"
          >
            <option value="all">All Warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No {tab === "All" ? "" : tab.toLowerCase()} requests</div>
        ) : (
          filtered.map((r) => {
            const wh = warehouses.find((w) => w.id === r.warehouseID);
            const isExpanded = expanded === r.id;
            return (
              <div key={r.id} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
                <button
                  className="w-full px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : r.id!)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={r.status} />
                        <span className="text-white font-medium">{r.submittedBy}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                        {wh && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {wh.name}
                          </span>
                        )}
                        {r.timestamp && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatDate(r.timestamp)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {r.items?.length ?? 0} item{(r.items?.length ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#2a2f3e] px-6 py-4">
                    {/* Items */}
                    <div className="space-y-2 mb-4">
                      {r.items?.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-[#2a2f3e] last:border-0">
                          <span className="text-white">{item.productName}</span>
                          <span className="text-gray-400">{item.quantity} {item.unit ?? ""}</span>
                        </div>
                      ))}
                    </div>

                    {/* Completion info */}
                    {r.completedBy && (
                      <p className="text-xs text-gray-500 mb-3">
                        Completed by {r.completedBy} {r.completedAt ? `· ${formatDate(r.completedAt)}` : ""}
                      </p>
                    )}

                    {/* Admin action */}
                    {user?.isAdmin && r.status === "Pending" && (
                      <button
                        onClick={() => markComplete(r.id!)}
                        disabled={updating === r.id}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                      >
                        {updating === r.id ? "Marking…" : "Mark as Completed"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: string }> = {
    Pending:   { cls: "bg-amber-400/15 text-amber-400 border-amber-400/20",  icon: "⏳" },
    Completed: { cls: "bg-green-400/15 text-green-400 border-green-400/20",   icon: "✓" },
    Returned:  { cls: "bg-red-400/15 text-red-400 border-red-400/20",         icon: "↩" },
  };
  const s = map[status] ?? { cls: "bg-gray-400/15 text-gray-400 border-gray-400/20", icon: "•" };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${s.cls}`}>
      <span>{s.icon}</span> {status}
    </span>
  );
}

function formatDate(ts: { toDate?: () => Date; seconds?: number } | null | undefined): string {
  if (!ts) return "";
  try {
    const d = typeof ts === "object" && "toDate" in ts && ts.toDate ? ts.toDate() : new Date((ts as { seconds: number }).seconds * 1000);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}
