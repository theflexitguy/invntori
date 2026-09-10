"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InventoryRequest, Warehouse } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseFirestoreDate(
  ts: { toDate?: () => Date; seconds?: number } | string | null | undefined
): Date | null {
  if (!ts) return null;
  try {
    if (typeof ts === "string") return new Date(ts);
    if (typeof ts === "object" && "toDate" in ts && typeof ts.toDate === "function") {
      return ts.toDate();
    }
    if (typeof ts === "object" && "seconds" in ts && typeof ts.seconds === "number") {
      return new Date(ts.seconds * 1000);
    }
  } catch {
    return null;
  }
  return null;
}

function formatDate(ts: unknown): string {
  const d = parseFirestoreDate(ts as Parameters<typeof parseFirestoreDate>[0]);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(ts: unknown): string {
  const d = parseFirestoreDate(ts as Parameters<typeof parseFirestoreDate>[0]);
  if (!d) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

const STATUS_TABS = ["All", "Pending", "Completed"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const variants: Record<string, { bg: string; text: string; border: string; glow: string; dot: string }> = {
    Pending: {
      bg: "bg-amber-400/10",
      text: "text-amber-400",
      border: "border-amber-400/25",
      glow: "shadow-amber-400/10",
      dot: "bg-amber-400",
    },
    Completed: {
      bg: "bg-emerald-400/10",
      text: "text-emerald-400",
      border: "border-emerald-400/25",
      glow: "shadow-emerald-400/10",
      dot: "bg-emerald-400",
    },
    Returned: {
      bg: "bg-rose-400/10",
      text: "text-rose-400",
      border: "border-rose-400/25",
      glow: "shadow-rose-400/10",
      dot: "bg-rose-400",
    },
  };
  const v = variants[status] ?? {
    bg: "bg-gray-400/10",
    text: "text-gray-400",
    border: "border-gray-400/25",
    glow: "shadow-gray-400/10",
    dot: "bg-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shadow-sm ${v.bg} ${v.text} ${v.border} ${v.glow}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
      {status}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminRequestsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusTab>("Pending");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Admin guard
  useEffect(() => {
    if (user && !user.isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user?.companyID || !user.isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [reqSnap, whSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "companies", cid, "inventoryRequests"),
          orderBy("timestamp", "desc")
        )
      ),
      getDocs(collection(db, "companies", cid, "warehouses")),
    ]);
    setRequests(
      reqSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryRequest, "id">) }))
    );
    setWarehouses(
      whSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string }))
    );
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return requests.filter((r) => {
      if (tab !== "All" && r.status !== tab) return false;
      if (!q) return true;
      if (r.submittedBy.toLowerCase().includes(q)) return true;
      if (r.items?.some((i) => i.productName.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [requests, tab, search]);

  const counts = useMemo(
    () =>
      STATUS_TABS.reduce(
        (acc, t) => {
          acc[t] = t === "All" ? requests.length : requests.filter((r) => r.status === t).length;
          return acc;
        },
        {} as Record<string, number>
      ),
    [requests]
  );

  if (!user?.isAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 xl:p-8 w-full max-w-3xl pb-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm">
          Admin
        </Link>
        <svg
          className="w-3 h-3 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm text-white">Request Queue</span>
      </div>

      {/* Header */}
      <div className="mt-4 mb-6">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Pending Requests</h2>
          {counts["Pending"] > 0 && (
            <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/20">
              {counts["Pending"]}
            </span>
          )}
        </div>
        <p className="text-gray-400 mt-1 text-sm">
          All inventory requests from every employee
        </p>
      </div>

      {/* Tabs + Search row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg p-1 w-fit">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === t
                  ? "bg-[#35B2FF]/20 text-[#35B2FF]"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {t}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  tab === t ? "bg-[#35B2FF]/30" : "bg-white/5"
                }`}
              >
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-0">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by employee or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] transition-colors"
          />
        </div>
      </div>

      {/* Request list */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl">
            <div className="w-12 h-12 rounded-full bg-[#2a2f3e] flex items-center justify-center mb-3">
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">No requests found</p>
            <p className="text-gray-600 text-sm mt-1">
              {search ? "Try adjusting your search" : `No ${tab === "All" ? "" : tab.toLowerCase() + " "}requests`}
            </p>
          </div>
        ) : (
          filtered.map((r) => {
            const wh = warehouses.find((w) => w.id === r.warehouseID);
            const isExpanded = expanded === r.id;
            const itemCount = r.items?.length ?? 0;

            return (
              <div
                key={r.id}
                className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden transition-colors hover:border-[#35B2FF]/20"
              >
                {/* Card header — clickable */}
                <button
                  className="w-full px-5 py-4 text-left hover:bg-white/[0.015] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : r.id!)}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                        <StatusPill status={r.status} />
                        <span className="text-white font-medium text-sm">{r.submittedBy}</span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        {/* Timestamp */}
                        {r.timestamp && (
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {formatDateTime(r.timestamp)}
                          </span>
                        )}

                        {/* Warehouse */}
                        {wh && (
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                              />
                            </svg>
                            {wh.name}
                          </span>
                        )}

                        {/* Item count */}
                        <span className="flex items-center gap-1">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 6h16M4 10h16M4 14h16M4 18h16"
                            />
                          </svg>
                          {itemCount} {itemCount === 1 ? "item" : "items"}
                        </span>
                      </div>
                    </div>

                    <svg
                      className={`w-4 h-4 text-gray-500 shrink-0 mt-0.5 transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[#2a2f3e] bg-[#0f1117]/50 px-5 py-4">
                    {/* Item list */}
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Items
                    </p>
                    <div className="space-y-0 rounded-lg border border-[#2a2f3e] overflow-hidden mb-4">
                      {r.items?.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-4 py-2.5 text-sm border-b border-[#2a2f3e] last:border-0 hover:bg-white/[0.015]"
                        >
                          <span className="text-white">{item.productName}</span>
                          <span className="text-gray-400 font-medium tabular-nums">
                            {item.quantity}
                            {item.unit ? <span className="text-gray-500 font-normal ml-1">{item.unit}</span> : null}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    {r.notes && (
                      <div className="mb-4 flex items-start gap-2 bg-white/[0.03] border border-[#2a2f3e] rounded-lg px-3 py-2.5">
                        <svg
                          className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                          />
                        </svg>
                        <p className="text-xs text-gray-400">{r.notes}</p>
                      </div>
                    )}

                    {/* Completion info */}
                    {r.status === "Completed" && (r.completedByName ?? r.completedBy) && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Completed by{" "}
                        <span className="font-medium">
                          {r.completedByName ?? r.completedBy}
                        </span>
                        {r.completedAt && (
                          <span className="text-emerald-600">
                            {" "}
                            · {formatDate(r.completedAt)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Returned info */}
                    {r.status === "Returned" && (
                      <div className="flex items-center gap-1.5 text-xs text-rose-400">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                          />
                        </svg>
                        Returned
                        {r.completedAt && (
                          <span className="text-rose-600"> · {formatDate(r.completedAt)}</span>
                        )}
                      </div>
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
