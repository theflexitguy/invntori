"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";

type POStatus = "draft" | "submitted" | "approved" | "Pending" | "PartiallyReceived" | "Completed" | "received" | "cancelled";

interface PurchaseOrderItem {
  productName: string;
  quantity: number;
  unit?: string;
  unitCost?: number;
}

interface PurchaseOrder {
  id: string;
  vendorName: string;
  status: POStatus | string;
  vendorRef?: string;
  notes?: string;
  createdAt?: Date;
  expectedDate?: Date;
  totalCost?: number;
  items: PurchaseOrderItem[];
}

function parseDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (typeof val === "object" && val !== null && "toDate" in val) return (val as { toDate: () => Date }).toDate();
  if (typeof val === "object" && val !== null && "seconds" in val) return new Date((val as { seconds: number }).seconds * 1000);
  if (typeof val === "string") { const d = new Date(val); return isNaN(d.getTime()) ? undefined : d; }
  return undefined;
}

function displayStatus(status: string): string {
  switch (status) {
    case "PartiallyReceived": return "Partial";
    case "Closed": return "Completed";
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function statusColor(status: string): { bg: string; text: string; border: string } {
  const s = status.toLowerCase();
  if (s === "completed" || s === "received") return { bg: "bg-green-400/15", text: "text-green-400", border: "border-green-400/20" };
  if (s === "partiallyreceived") return { bg: "bg-blue-400/15", text: "text-[#35B2FF]", border: "border-[#35B2FF]/20" };
  if (s === "cancelled" || s === "closed") return { bg: "bg-gray-400/15", text: "text-gray-400", border: "border-gray-400/20" };
  if (s === "approved") return { bg: "bg-violet-400/15", text: "text-violet-400", border: "border-violet-400/20" };
  return { bg: "bg-amber-400/15", text: "text-amber-400", border: "border-amber-400/20" };
}

const STATUS_TABS = ["All", "Pending", "Completed"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>("Pending");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const snap = await getDocs(
      query(collection(db, "companies", cid, "purchaseOrders"), orderBy("createdAt", "desc"))
    );
    const loaded: PurchaseOrder[] = snap.docs.map((d) => {
      const raw = d.data();
      return {
        id: d.id,
        vendorName: raw.vendorName ?? raw.vendor ?? "Unknown Vendor",
        status: raw.status ?? "Pending",
        vendorRef: raw.vendorRef ?? raw.orderNumber,
        notes: raw.notes,
        createdAt: parseDate(raw.createdAt),
        expectedDate: parseDate(raw.expectedDate),
        totalCost: typeof raw.totalCost === "number" ? raw.totalCost : undefined,
        items: Array.isArray(raw.items) ? raw.items : [],
      };
    });
    setOrders(loaded);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      if (tab === "Pending") {
        const s = o.status.toLowerCase();
        if (s === "completed" || s === "received" || s === "complete" || s === "cancelled") return false;
      } else if (tab === "Completed") {
        const s = o.status.toLowerCase();
        if (s !== "completed" && s !== "received" && s !== "complete") return false;
      }
      if (!q) return true;
      return (
        o.vendorName.toLowerCase().includes(q) ||
        (o.vendorRef?.toLowerCase().includes(q) ?? false) ||
        o.items.some((i) => i.productName.toLowerCase().includes(q))
      );
    });
  }, [orders, tab, search]);

  const counts = useMemo(() => {
    const pending = orders.filter((o) => {
      const s = o.status.toLowerCase();
      return s !== "completed" && s !== "received" && s !== "complete" && s !== "cancelled";
    }).length;
    const completed = orders.filter((o) => {
      const s = o.status.toLowerCase();
      return s === "completed" || s === "received" || s === "complete";
    }).length;
    return { All: orders.length, Pending: pending, Completed: completed };
  }, [orders]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Purchase Orders</h2>
        <p className="text-gray-400 mt-1 text-sm">{filtered.length} orders</p>
      </div>

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
        <input
          type="search"
          placeholder="Search vendor, item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] w-64"
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No orders found</div>
        ) : (
          filtered.map((order) => {
            const sc = statusColor(order.status);
            const isExpanded = expanded === order.id;
            const isOverdue = order.expectedDate && order.expectedDate < new Date() &&
              !["completed", "received"].includes(order.status.toLowerCase());
            return (
              <div key={order.id} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
                <button
                  className="w-full px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border ${sc.bg} ${sc.text} ${sc.border}`}>
                          {displayStatus(order.status)}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border bg-red-400/15 text-red-400 border-red-400/20">
                            Overdue
                          </span>
                        )}
                        <span className="text-white font-medium">{order.vendorName}</span>
                        {order.vendorRef && (
                          <span className="text-xs text-gray-500 font-mono">#{order.vendorRef}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {order.createdAt && (
                          <span>{order.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        )}
                        {order.expectedDate && (
                          <span>Expected: {order.expectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        )}
                        <span>{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span>
                        {order.totalCost !== undefined && (
                          <span>{order.totalCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
                        )}
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#2a2f3e] px-6 py-4">
                    {order.items.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-[#2a2f3e] last:border-0">
                            <span className="text-white">{item.productName}</span>
                            <div className="text-right">
                              <span className="text-gray-400">{item.quantity} {item.unit ?? ""}</span>
                              {item.unitCost !== undefined && (
                                <span className="text-gray-600 text-xs ml-2">
                                  @ {item.unitCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mb-3">No line items</p>
                    )}
                    {order.notes && (
                      <p className="text-xs text-gray-500">Note: {order.notes}</p>
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
