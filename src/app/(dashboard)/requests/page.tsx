"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import type { InventoryRequest } from "@/lib/types";

const TAB_STATUS = ["all", "pending", "approved", "denied", "completed"] as const;
type Tab = (typeof TAB_STATUS)[number];

export default function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const snap = await getDocs(
      query(collection(db, "companies", user.companyID, "inventoryRequests"), orderBy("timestamp", "desc"))
    );
    setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryRequest, "id">) })));
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    if (!user?.companyID) return;
    setUpdating(id);
    try {
      await updateDoc(doc(db, "companies", user.companyID, "inventoryRequests", id), { status });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: status as InventoryRequest["status"] } : r)));
    } finally {
      setUpdating(null);
    }
  }

  const filtered = useMemo(() => {
    if (tab === "all") return requests;
    return requests.filter((r) => r.status === tab);
  }, [requests, tab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Inventory Requests</h2>
        <p className="text-gray-400 mt-1 text-sm">{filtered.length} requests</p>
      </div>

      <div className="flex gap-1 mb-6 bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg p-1 w-fit">
        {TAB_STATUS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-[#35B2FF]/20 text-[#35B2FF]" : "text-gray-500 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-10">No {tab === "all" ? "" : tab} requests</div>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-white">
                      {r.items?.length === 1
                        ? r.items[0].productName
                        : `${r.items?.length ?? 0} items`}
                    </p>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    Requested by <span className="text-gray-300">{r.submittedBy}</span>
                  </p>
                  {r.items && r.items.length > 1 && (
                    <ul className="mt-2 space-y-0.5">
                      {r.items.map((item, i) => (
                        <li key={i} className="text-xs text-gray-500">
                          {item.productName} × {item.quantity} {item.unit ?? ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.notes && <p className="text-sm text-gray-500 mt-1">{r.notes}</p>}
                </div>

                {user?.isAdmin && r.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus(r.id!, "approved")}
                      disabled={updating === r.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatus(r.id!, "denied")}
                      disabled={updating === r.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </div>
                )}

                {user?.isAdmin && r.status === "approved" && (
                  <button
                    onClick={() => updateStatus(r.id!, "completed")}
                    disabled={updating === r.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-colors disabled:opacity-50 shrink-0"
                  >
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          ))
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
    completed: "bg-blue-400/15 text-blue-400",
  };
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${map[status] ?? "bg-gray-400/15 text-gray-400"}`}>
      {status}
    </span>
  );
}
