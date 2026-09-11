"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { PlusIcon } from "@/components/ui/PageHeader";
import { NavBarRight } from "@/components/layout/NavBarSlot";
import {
  LargeTitle,
  SearchField,
  SegmentedControl,
  Pill,
  NavCircleButton,
  type Tint,
} from "@/components/ui/ios";
import { ChevronRightIcon } from "@/components/layout/nav";

type POStatus = "draft" | "submitted" | "approved" | "Pending" | "PartiallyReceived" | "Completed" | "received" | "cancelled";

interface PurchaseOrderItem { productName: string; quantity: number; unit?: string; unitCost?: number; }

interface PurchaseOrder {
  id: string;
  vendorName: string;
  status: POStatus | string;
  vendorRef?: string;
  notes?: string;
  warehouseName?: string;
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
  if (status === "PartiallyReceived") return "Partial";
  if (status === "Closed") return "Completed";
  if (status === "received") return "Completed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTint(status: string): Tint {
  const s = status.toLowerCase();
  if (s === "completed" || s === "received" || s === "complete") return "green";
  if (s === "partiallyreceived") return "blue";
  if (s === "cancelled" || s === "closed") return "gray";
  if (s === "approved") return "purple";
  return "orange";
}

/** "August 25, 2026" — the long form the native list prints. */
function longDate(d?: Date): string {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const STATUS_TABS = [
  { value: "Pending" as const, label: "Pending" },
  { value: "Completed" as const, label: "Completed" },
  { value: "All" as const, label: "All" },
];
type StatusTab = (typeof STATUS_TABS)[number]["value"];

const DONE = new Set(["completed", "received", "complete"]);

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>("Pending");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const snap = await getDocs(query(collection(db, "companies", cid, "purchaseOrders"), orderBy("createdAt", "desc")));
    const loaded: PurchaseOrder[] = snap.docs.map((d) => {
      const raw = d.data();
      return {
        id: d.id,
        vendorName: raw.vendorName ?? raw.vendor ?? "Unknown Vendor",
        status: raw.status ?? "Pending",
        vendorRef: raw.vendorRef ?? raw.orderNumber,
        notes: raw.notes,
        warehouseName: raw.warehouseName,
        createdAt: parseDate(raw.createdAt),
        expectedDate: parseDate(raw.expectedDate),
        totalCost: typeof raw.totalCost === "number" ? raw.totalCost : undefined,
        items: Array.isArray(raw.items) ? raw.items : [],
      };
    });
    setOrders(loaded);
    setLoading(false);
  }

  async function markReceived(id: string) {
    if (!user?.companyID) return;
    setUpdating(id);
    try {
      await updateDoc(doc(db, "companies", user.companyID, "purchaseOrders", id), {
        status: "Completed",
        receivedAt: serverTimestamp(),
        receivedBy: user.uid,
        receivedByName: user.displayName ?? user.email ?? "",
      });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "Completed" } : o)));
    } finally {
      setUpdating(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter((o) => {
      const s = o.status.toLowerCase();
      if (tab === "Pending" && (DONE.has(s) || s === "cancelled")) return false;
      if (tab === "Completed" && !DONE.has(s)) return false;
      if (!q) return true;
      return (
        o.vendorName.toLowerCase().includes(q) ||
        (o.vendorRef?.toLowerCase().includes(q) ?? false) ||
        longDate(o.createdAt).toLowerCase().includes(q) ||
        o.items.some((i) => i.productName.toLowerCase().includes(q))
      );
    });
  }, [orders, tab, search]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-3xl">
      {user?.isAdmin && (
        <NavBarRight>
          <NavCircleButton href="/orders/new" label="Log purchase order">
            <PlusIcon className="w-[17px] h-[17px]" />
          </NavCircleButton>
        </NavBarRight>
      )}

      <LargeTitle title="Purchase Orders" />

      <div className="mb-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search by vendor, order #, item, or date"
          shape="pill"
        />
      </div>

      <div className="mb-4">
        <SegmentedControl value={tab} onChange={setTab} options={STATUS_TABS} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-[17px] text-[rgba(235,235,245,0.6)] py-16 text-center">No orders found.</p>
      ) : (
        <div>
          {filtered.map((order, i) => {
            const isExpanded = expanded === order.id;
            const s = order.status.toLowerCase();
            const isPending = !DONE.has(s) && s !== "cancelled";
            const isOverdue = order.expectedDate && order.expectedDate < new Date() && isPending;

            return (
              <div
                key={order.id}
                className={i === filtered.length - 1 ? "" : "border-b border-[#38383A]/70"}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                  className="w-full text-left py-3.5 flex items-start gap-3 active:bg-white/[0.04] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-semibold text-white break-words">{order.vendorName}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Pill tint={statusTint(order.status)}>{displayStatus(order.status)}</Pill>
                      {isOverdue && <Pill tint="red">Overdue</Pill>}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[15px] text-white">
                      {order.vendorRef ? `Order #${order.vendorRef}` : "No order #"}
                    </p>
                    <p className="text-[13px] text-[rgba(235,235,245,0.6)] mt-1.5">
                      {longDate(order.createdAt)}
                    </p>
                    <p className="text-[13px] text-[rgba(235,235,245,0.6)]">
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <ChevronRightIcon
                    className={`w-[14px] h-[14px] text-[rgba(235,235,245,0.3)] shrink-0 mt-1.5 transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="pb-4">
                    {order.items.length > 0 ? (
                      <div className="bg-[#1C1C1E] rounded-[12px] px-4 py-1">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between gap-3 py-2.5 ${
                              idx === order.items.length - 1 ? "" : "border-b border-[#38383A]/70"
                            }`}
                          >
                            <span className="text-[17px] text-white min-w-0 break-words">
                              {item.productName}
                            </span>
                            <span className="text-[15px] text-[rgba(235,235,245,0.6)] shrink-0">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                              {item.unitCost !== undefined
                                ? ` · ${item.unitCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[15px] text-[rgba(235,235,245,0.6)] px-1">No line items.</p>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 px-1 text-[13px] text-[rgba(235,235,245,0.6)]">
                      {order.warehouseName && <span>Into {order.warehouseName}</span>}
                      {order.expectedDate && <span>Expected {longDate(order.expectedDate)}</span>}
                      {order.totalCost !== undefined && (
                        <span>
                          Total{" "}
                          {order.totalCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                        </span>
                      )}
                    </div>

                    {order.notes && (
                      <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-2 px-1 leading-snug">
                        {order.notes}
                      </p>
                    )}

                    {user?.isAdmin && isPending && (
                      <button
                        onClick={() => markReceived(order.id)}
                        disabled={updating === order.id}
                        className="mt-3 w-full py-3 rounded-[14px] text-[17px] font-semibold bg-[#30D158]/15 text-[#30D158] active:bg-[#30D158]/25 transition-colors disabled:opacity-50"
                      >
                        {updating === order.id ? "Updating…" : "Mark as Received"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
