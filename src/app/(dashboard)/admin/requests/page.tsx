"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { useRouter } from "next/navigation";
import { NavBarTitle, NavBarRight } from "@/components/layout/NavBarSlot";
import {
  TextAction,
  SelectRow,
  Pill,
  NavPillButton,
  type Tint,
} from "@/components/ui/ios";
import {
  ChevronDownIcon,
  BuildingIcon,
  ClockIcon,
  PencilSquareIcon,
  HourglassIcon,
  CheckCircleIcon,
  SyncIcon,
} from "@/components/layout/nav";
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

/** "Sep 8, 2026 at 7:29 AM", the way the native queue prints a timestamp. */
function formatDateTime(ts: unknown): string {
  const d = parseFirestoreDate(ts as Parameters<typeof parseFirestoreDate>[0]);
  if (!d) return "";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

function formatDate(ts: unknown): string {
  const d = parseFirestoreDate(ts as Parameters<typeof parseFirestoreDate>[0]);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_TABS = ["All", "Pending", "Completed", "Returned"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const statusTint: Record<string, Tint> = {
  Pending: "orange",
  Completed: "green",
  Returned: "red",
};

function StatusGlyph({ status }: { status: string }) {
  if (status === "Completed") return <CheckCircleIcon className="w-[11px] h-[11px]" />;
  if (status === "Returned") return <SyncIcon className="w-[11px] h-[11px]" />;
  return <HourglassIcon className="w-[11px] h-[11px]" />;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminRequestsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [tab, setTab] = useState<StatusTab>("Pending");
  const [warehouseFilter, setWarehouseFilter] = useState("All");
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
    setRefreshing(true);
    try {
      const [reqSnap, whSnap] = await Promise.all([
        getDocs(
          query(collection(db, "companies", cid, "inventoryRequests"), orderBy("timestamp", "desc"))
        ),
        getDocs(collection(db, "companies", cid, "warehouses")),
      ]);
      setRequests(
        reqSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryRequest, "id">) }))
      );
      setWarehouses(
        whSnap.docs
          .map((d) => ({ id: d.id, name: d.data().name as string }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  const warehouseName = useMemo(() => {
    const map: Record<string, string> = {};
    warehouses.forEach((w) => {
      if (w.id) map[w.id] = w.name;
    });
    return map;
  }, [warehouses]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (tab !== "All" && r.status !== tab) return false;
      if (warehouseFilter !== "All" && r.warehouseID !== warehouseFilter) return false;
      return true;
    });
  }, [requests, tab, warehouseFilter]);

  if (!user?.isAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      {/* The native queue keeps its title inline and Logout in the bar */}
      <NavBarTitle>
        <span className="text-[17px] font-semibold text-white truncate">Pending Requests</span>
      </NavBarTitle>
      <NavBarRight>
        <NavPillButton onClick={signOut}>Logout</NavPillButton>
      </NavBarRight>

      {/* Filter bar */}
      <div className="flex items-center gap-2 -mx-2 mb-2">
        <TextAction
          onClick={() => setFiltersOpen((v) => !v)}
          icon={
            <ChevronDownIcon
              className={`w-[17px] h-[17px] transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            />
          }
        >
          {filtersOpen ? "Hide Filters" : "Show Filters"}
        </TextAction>
        <TextAction
          onClick={() => load()}
          icon={<SyncIcon className={`w-[16px] h-[16px] ${refreshing ? "animate-spin" : ""}`} />}
        >
          Refresh
        </TextAction>
      </div>

      {filtersOpen && (
        <div className="space-y-2 mb-4">
          <SelectRow
            label="Warehouse"
            value={warehouseFilter}
            onChange={setWarehouseFilter}
            options={[
              { value: "All", label: "All" },
              ...warehouses.map((w) => ({ value: w.id!, label: w.name })),
            ]}
          />
          <SelectRow
            label="Status"
            value={tab}
            onChange={(v) => setTab(v as StatusTab)}
            options={STATUS_TABS.map((t) => ({ value: t, label: t }))}
          />
        </div>
      )}

      {/* Queue */}
      {filtered.length === 0 ? (
        <p className="text-[17px] text-[rgba(235,235,245,0.6)] py-16 text-center">
          No requests found.
        </p>
      ) : (
        <div>
          {filtered.map((r, i) => {
            const isExpanded = expanded === r.id;
            const items = r.items ?? [];
            const first = items[0];
            const firstLabel = first
              ? `${first.quantity} ${first.productName}${first.unit ? ` (${first.unit})` : ""}`
              : "No items";

            return (
              <div
                key={r.id}
                className={i === filtered.length - 1 ? "" : "border-b border-[#38383A]/70"}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : r.id!)}
                  className="w-full text-left py-3.5 flex items-start gap-3 active:bg-white/[0.04] transition-colors"
                >
                  {/* Status + origin */}
                  <div className="min-w-0 flex-1">
                    <Pill tint={statusTint[r.status] ?? "gray"}>
                      <span className="inline-flex items-center gap-1">
                        <StatusGlyph status={r.status} />
                        {r.status}
                      </span>
                    </Pill>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <BuildingIcon className="w-[14px] h-[14px] text-[#0A84FF] shrink-0" />
                      <span className="text-[15px] text-[rgba(235,235,245,0.6)] truncate">
                        {r.warehouseID ? (warehouseName[r.warehouseID] ?? "Unknown warehouse") : "No warehouse"}
                      </span>
                    </div>
                    <p className="text-[15px] text-white mt-1 truncate">{r.submittedBy}</p>
                  </div>

                  {/* When + what */}
                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <ClockIcon className="w-[13px] h-[13px] text-[rgba(235,235,245,0.6)]" />
                      <span className="text-[13px] text-[rgba(235,235,245,0.6)]">
                        {formatDateTime(r.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-1.5">
                      <PencilSquareIcon className="w-[13px] h-[13px] text-[rgba(235,235,245,0.6)]" />
                      <span className="text-[13px] text-[rgba(235,235,245,0.6)] max-w-[180px] truncate">
                        {firstLabel}
                      </span>
                    </div>
                    <p className="text-[13px] text-[rgba(235,235,245,0.3)] mt-1">
                      {items.length} item{items.length !== 1 ? "s" : ""} requested
                    </p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="pb-4">
                    <div className="bg-[#1C1C1E] rounded-[12px] px-4 py-1">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between gap-3 py-2.5 ${
                            idx === items.length - 1 ? "" : "border-b border-[#38383A]/70"
                          }`}
                        >
                          <span className="text-[17px] text-white min-w-0 break-words">
                            {item.productName}
                          </span>
                          <span className="text-[15px] text-[rgba(235,235,245,0.6)] shrink-0">
                            {item.quantity}
                            {item.unit ? ` ${item.unit}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>

                    {r.notes && (
                      <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-3 px-1 leading-snug">
                        {r.notes}
                      </p>
                    )}

                    {r.status === "Completed" && (r.completedByName ?? r.completedBy) && (
                      <p className="text-[13px] text-[#30D158] mt-3 px-1">
                        Completed by {r.completedByName ?? r.completedBy}
                        {r.completedAt ? ` · ${formatDate(r.completedAt)}` : ""}
                      </p>
                    )}
                    {r.status === "Returned" && (
                      <p className="text-[13px] text-[#FF453A] mt-3 px-1">
                        Returned{r.completedAt ? ` · ${formatDate(r.completedAt)}` : ""}
                      </p>
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
