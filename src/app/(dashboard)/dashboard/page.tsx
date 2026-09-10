"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  collection, getDocs, query, orderBy, limit, where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

interface StockItem {
  id: string;
  name: string;
  qty: number;
  threshold: number;
  unitCost: number;
  unit: string;
}

interface EquipmentAsset {
  id: string;
  name: string;
  status: string;
}

interface VehicleAsset {
  id: string;
  name: string;
  driverName?: string;
  condition?: string;
}

interface PendingPO {
  id: string;
  vendor: string;
  status: string;
  expectedDate?: Date;
  itemCount: number;
  createdAt: Date;
}

interface RequestEvent {
  id: string;
  submittedBy: string;
  submittedByUID: string;
  timestamp: Date;
  itemCount: number;
  status: string;
  warehouseID?: string;
  items?: Array<{ productID?: string; productName: string; quantity: number }>;
}

interface DashboardData {
  allStockItems: StockItem[];
  equipment: EquipmentAsset[];
  vehicles: VehicleAsset[];
  activeEmployeeCount: number;
  requests: RequestEvent[];
  pendingPOs: PendingPO[];
  warehouseCount: number;
}

// ── Date helpers ───────────────────────────────────────────────────────────

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === "object" && val !== null && "seconds" in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseNumber(val: unknown): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = parseFloat(val); return isNaN(n) ? null : n; }
  return null;
}

function subtractDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [insightsOpen, setInsightsOpen] = useState(true);

  const startDate = useMemo(() => subtractDays(rangeDays), [rangeDays]);
  const endDate = useMemo(() => new Date(), []);

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    setLoading(true);
    try {
      const [whSnap, prodSnap, eqSnap, vSnap, empSnap, reqSnap, poSnap] = await Promise.all([
        getDocs(collection(db, "companies", cid, "warehouses")),
        getDocs(collection(db, "companies", cid, "products")),
        getDocs(collection(db, "companies", cid, "equipment")),
        getDocs(collection(db, "companies", cid, "vehicles")),
        getDocs(query(collection(db, "companies", cid, "Employees"), where("isActive", "==", true))),
        getDocs(query(collection(db, "companies", cid, "inventoryRequests"), orderBy("timestamp", "desc"), limit(500))),
        getDocs(query(collection(db, "companies", cid, "purchaseOrders"), orderBy("createdAt", "desc"), limit(50))),
      ]);

      // Product cost map
      const productCostMap: Record<string, number> = {};
      for (const doc of prodSnap.docs) {
        const d = doc.data();
        if (d.isRetired !== true) {
          productCostMap[doc.id] = parseNumber(d.unitCost) ?? 0;
        }
      }

      // Load inventory from each warehouse subcollection
      const invSnaps = await Promise.all(
        whSnap.docs.map((w) => getDocs(collection(db, "companies", cid, "warehouses", w.id, "inventory")))
      );

      // Aggregate stock items across warehouses
      const stockMap: Record<string, { name: string; qty: number; threshold: number; unitCost: number; unit: string }> = {};
      for (const snap of invSnaps) {
        for (const doc of snap.docs) {
          const d = doc.data();
          const pid = doc.id;
          const qty = parseNumber(d.quantity) ?? 0;
          const threshold = parseNumber(d.reorderThreshold) ?? 0;
          const name = (d.name as string | undefined) ?? pid;
          const unit = (d.unit as string | undefined) ?? "";
          if (stockMap[pid]) {
            stockMap[pid].qty += qty;
            if (threshold > 0) stockMap[pid].threshold = threshold;
          } else {
            stockMap[pid] = { name, qty, threshold, unitCost: productCostMap[pid] ?? 0, unit };
          }
        }
      }

      const allStockItems: StockItem[] = Object.entries(stockMap).map(([id, v]) => ({ id, ...v }));

      const equipment: EquipmentAsset[] = eqSnap.docs
        .filter((d) => d.data().isRetired !== true)
        .map((d) => ({ id: d.id, name: d.data().name ?? "", status: d.data().status ?? "available" }));

      const vehicles: VehicleAsset[] = vSnap.docs
        .filter((d) => d.data().isRetired !== true)
        .map((d) => ({ id: d.id, name: d.data().name ?? "", driverName: d.data().currentDriverName, condition: d.data().condition }));

      const activeEmployeeCount = empSnap.size;

      const requests: RequestEvent[] = reqSnap.docs.map((d) => {
        const raw = d.data();
        const ts = parseDate(raw.timestamp) ?? parseDate(raw.createdAt) ?? new Date(0);
        return {
          id: d.id,
          submittedBy: raw.submittedBy ?? "",
          submittedByUID: raw.submittedByUID ?? raw.submittedByUid ?? "",
          timestamp: ts,
          itemCount: (raw.items as unknown[] | undefined)?.length ?? 0,
          status: raw.status ?? "Pending",
          warehouseID: raw.warehouseID,
          items: raw.items,
        };
      });

      const pendingPOs: PendingPO[] = poSnap.docs
        .map((d) => {
          const raw = d.data();
          const status = (raw.status as string) ?? "draft";
          const lower = status.toLowerCase();
          if (lower === "completed" || lower === "received" || lower === "complete") return null;
          return {
            id: d.id,
            vendor: raw.vendorName ?? raw.vendor ?? "Unknown Vendor",
            status,
            expectedDate: parseDate(raw.expectedDate) ?? undefined,
            itemCount: (raw.items as unknown[] | undefined)?.length ?? 0,
            createdAt: parseDate(raw.createdAt) ?? new Date(0),
          };
        })
        .filter(Boolean) as PendingPO[];

      setData({ allStockItems, equipment, vehicles, activeEmployeeCount, requests, pendingPOs, warehouseCount: whSnap.size });
    } finally {
      setLoading(false);
    }
  }, [user?.companyID]);

  useEffect(() => {
    if (user?.companyID) load();
  }, [user?.companyID, load]);

  // ── Computed metrics ─────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    if (!data) return null;
    const { allStockItems, equipment, vehicles, activeEmployeeCount, requests, pendingPOs, warehouseCount } = data;

    const atRiskItems = allStockItems.filter((i) => i.threshold > 0 && i.qty <= i.threshold);
    const outOfStockCount = allStockItems.filter((i) => i.threshold > 0 && i.qty === 0).length;
    const healthyStockCount = allStockItems.filter((i) => !(i.threshold > 0 && i.qty <= i.threshold)).length;
    const totalInventoryValue = allStockItems.reduce((sum, i) => sum + i.qty * i.unitCost, 0);

    const openRepairCount = equipment.filter((e) => e.status === "inRepair").length;
    const checkedOutCount = equipment.filter((e) => e.status === "checkedOut").length;

    const activeVehicleCount = vehicles.filter((v) => v.driverName && v.driverName.trim() !== "").length;
    const vehicleAttentionCount = vehicles.filter((v) => v.condition === "poor" || v.condition === "fair").length;

    const overdueOrderCount = pendingPOs.filter((po) => po.expectedDate && po.expectedDate < new Date()).length;

    // Period metrics (filtered by date range)
    const periodRequests = requests.filter((r) => r.timestamp >= startDate);
    const periodRequestCount = periodRequests.length;

    // Active users in period: unique submitters from requests
    const activeUsersInPeriod = new Set(periodRequests.map((r) => r.submittedByUID).filter(Boolean)).size;
    const activeUsers = Math.max(activeUsersInPeriod, 1) > 0 ? activeUsersInPeriod : 0;

    // Top employees by pulls in period
    const empCounts: Record<string, { name: string; count: number }> = {};
    for (const r of periodRequests) {
      if (!r.submittedByUID) continue;
      if (!empCounts[r.submittedByUID]) empCounts[r.submittedByUID] = { name: r.submittedBy, count: 0 };
      empCounts[r.submittedByUID].count += r.itemCount || 1;
    }
    const topEmployees = Object.values(empCounts).sort((a, b) => b.count - a.count);

    const openIssues = outOfStockCount + openRepairCount + overdueOrderCount;
    let healthLabel = "Steady";
    let healthColor = "green" as "green" | "orange" | "red";
    if (openIssues > 0) { healthLabel = "Needs Attention"; healthColor = "red"; }
    else if (atRiskItems.length > 0 || vehicleAttentionCount > 0) { healthLabel = "Watch List"; healthColor = "orange"; }

    // Insights
    const insights: string[] = [];
    const dailyPulls = periodRequestCount / rangeDays;
    if (dailyPulls > 0) {
      insights.push(`Team is averaging ${dailyPulls.toFixed(1)} supply requests/day over the last ${rangeDays} days.`);
    }
    if (atRiskItems.length > 0) {
      const listed = atRiskItems.slice(0, 3).map((i) => i.name).join(", ");
      const extra = atRiskItems.length > 3 ? ` +${atRiskItems.length - 3} more` : "";
      insights.push(`${atRiskItems.length} item${atRiskItems.length !== 1 ? "s" : ""} at or below reorder threshold: ${listed}${extra}.`);
    }
    if (overdueOrderCount > 0) {
      insights.push(`${overdueOrderCount} supply order${overdueOrderCount !== 1 ? "s are" : " is"} overdue — may be delaying restocks.`);
    }
    if (topEmployees[0]) {
      insights.push(`${topEmployees[0].name} led supply pulls this period with ${topEmployees[0].count} request${topEmployees[0].count !== 1 ? "s" : ""}.`);
    }

    return {
      atRiskItems,
      outOfStockCount,
      healthyStockCount,
      totalInventoryValue,
      openRepairCount,
      checkedOutCount,
      activeVehicleCount,
      vehicleAttentionCount,
      overdueOrderCount,
      periodRequestCount,
      activeUsers,
      topEmployees,
      openIssues,
      healthLabel,
      healthColor,
      warehouseCount,
      activeEmployeeCount,
      totalStockItems: allStockItems.length,
      totalEquipment: equipment.length,
      totalVehicles: vehicles.length,
      pendingPOCount: pendingPOs.length,
      insights,
    };
  }, [data, startDate, rangeDays]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-3">
        <Spinner size={32} />
        <p className="text-gray-500 text-sm">Loading dashboard…</p>
      </div>
    );
  }

  if (!metrics) {
    return <div className="p-8 text-gray-500 text-sm">No data available.</div>;
  }

  const m = metrics;

  return (
    <div className="p-6 max-w-5xl space-y-5">

      {/* Date Range Picker */}
      <div className="flex items-center gap-2 flex-wrap">
        {([30, 60, 90, 180] as const).map((days) => {
          const label = days === 180 ? "6M" : `${days}D`;
          const active = rangeDays === days;
          return (
            <button
              key={days}
              onClick={() => setRangeDays(days)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active
                  ? "bg-[#35B2FF] text-white"
                  : "bg-[#1a1f2e] text-gray-400 hover:text-white border border-[#2a2f3e]"
              }`}
            >
              {label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-gray-500">
          {formatDate(subtractDays(rangeDays))} → {formatDate(new Date())}
        </span>
      </div>

      {/* Company Overview Card */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Company Overview</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatDate(subtractDays(rangeDays))} to {formatDate(new Date())}
            </p>
          </div>
          <HealthBadge label={m.healthLabel} color={m.healthColor} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label="Inventory Value"
            value={m.totalInventoryValue > 0 ? formatCurrency(m.totalInventoryValue) : "$0"}
            color="green"
          />
          <MetricTile
            label="Active Staff"
            value={String(m.activeEmployeeCount)}
            color="blue"
          />
          <MetricTile
            label="Warehouses"
            value={String(m.warehouseCount)}
            color="teal"
          />
          <MetricTile
            label="Open Issues"
            value={String(m.openIssues)}
            color={m.openIssues > 0 ? "red" : "gray"}
          />
        </div>
      </div>

      {/* Focus Strip */}
      <div className="grid grid-cols-3 gap-3">
        <FocusTile href="/inventory" label="Low Stock" value={m.atRiskItems.length} color={m.atRiskItems.length > 0 ? "orange" : "gray"} />
        <FocusTile href="/equipment" label="Repairs" value={m.openRepairCount} color={m.openRepairCount > 0 ? "red" : "gray"} />
        <FocusTile href="/orders" label="Orders" value={m.pendingPOCount} color={m.overdueOrderCount > 0 ? "red" : m.pendingPOCount > 0 ? "teal" : "gray"} />
      </div>

      {/* AREAS Grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-[#35B2FF]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z" />
          </svg>
          <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Areas</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <AreaCard
            href="/inventory"
            title="Inventory"
            value={`${m.healthyStockCount}/${m.totalStockItems}`}
            subtitle={m.atRiskItems.length > 0 ? `${m.atRiskItems.length} need reorder` : "items stocked"}
            icon={<BoxIcon />}
            color={m.atRiskItems.length > 0 ? "orange" : "green"}
          />
          <AreaCard
            href="/requests"
            title="Activity"
            value={String(m.periodRequestCount)}
            subtitle={`${m.activeUsers} active user${m.activeUsers !== 1 ? "s" : ""}`}
            icon={<ChartIcon />}
            color="blue"
          />
          <AreaCard
            href="/equipment"
            title="Equipment"
            value={String(m.totalEquipment)}
            subtitle={`${m.checkedOutCount} assigned, ${m.openRepairCount} repair`}
            icon={<WrenchIcon />}
            color={m.openRepairCount > 0 ? "red" : "purple"}
          />
          <AreaCard
            href="/fleet"
            title="Fleet"
            value={String(m.totalVehicles)}
            subtitle={`${m.activeVehicleCount} assigned, ${m.vehicleAttentionCount} watch`}
            icon={<CarIcon />}
            color={m.vehicleAttentionCount > 0 ? "orange" : "teal"}
          />
          <AreaCard
            href="/orders"
            title="Orders"
            value={String(m.pendingPOCount)}
            subtitle={m.overdueOrderCount > 0 ? `${m.overdueOrderCount} overdue` : "awaiting delivery"}
            icon={<CartIcon />}
            color={m.overdueOrderCount > 0 ? "red" : "green"}
          />
          <AreaCard
            href="/employees"
            title="Team Usage"
            value={String(m.topEmployees.length)}
            subtitle={m.topEmployees[0] ? `top: ${m.topEmployees[0].name}` : "no pulls yet"}
            icon={<PeopleIcon />}
            color="indigo"
          />
        </div>
      </div>

      {/* Invntori Insights */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl overflow-hidden">
        <button
          onClick={() => setInsightsOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-5 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
          </svg>
          <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Invntori Insights</span>
          {m.insights.length > 0 && (
            <span className="ml-1 bg-[#35B2FF] text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{m.insights.length}</span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-gray-500 ml-auto transition-transform ${insightsOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {insightsOpen && (
          <div className="border-t border-[#2a2f3e]">
            {m.insights.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-500">
                {!data || data.allStockItems.length === 0
                  ? "Refresh to load your supply data."
                  : "Submit supply requests to start generating insights."}
              </p>
            ) : (
              <div className="px-5 py-4 space-y-3">
                {m.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#35B2FF] mt-2 shrink-0" />
                    <p className="text-sm text-gray-300 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-[#2a2f3e] px-5 py-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#35B2FF]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
              <p className="text-xs text-gray-500">Ask a follow-up in the invntori chat</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function HealthBadge({ label, color }: { label: string; color: "green" | "orange" | "red" }) {
  const cls = {
    green: "bg-green-400/15 text-green-400 border-green-400/30",
    orange: "bg-amber-400/15 text-amber-400 border-amber-400/30",
    red: "bg-red-400/15 text-red-400 border-red-400/30",
  }[color];
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cls}`}>{label}</span>
  );
}

function MetricTile({ label, value, color }: { label: string; value: string; color: string }) {
  const textColor = {
    green: "text-green-400",
    blue: "text-[#35B2FF]",
    teal: "text-teal-400",
    red: "text-red-400",
    gray: "text-gray-400",
  }[color] ?? "text-gray-400";
  return (
    <div className="bg-[#0f1117] rounded-xl p-4">
      <p className={`text-lg font-bold ${textColor} leading-none mb-1 truncate`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function FocusTile({ href, label, value, color }: { href: string; label: string; value: number; color: string }) {
  const textColor = {
    orange: "text-amber-400",
    red: "text-red-400",
    teal: "text-teal-400",
    gray: "text-gray-500",
  }[color] ?? "text-gray-500";
  return (
    <Link href={href} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl py-4 flex flex-col items-center gap-1 hover:border-[#35B2FF]/40 transition-colors">
      <span className={`text-2xl font-bold ${textColor}`}>{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </Link>
  );
}

function AreaCard({
  href, title, value, subtitle, icon, color,
}: {
  href: string; title: string; value: string; subtitle: string; icon: React.ReactNode; color: string;
}) {
  const colorMap: Record<string, { icon: string; bg: string }> = {
    orange: { icon: "text-amber-400", bg: "bg-amber-400/10" },
    green:  { icon: "text-green-400", bg: "bg-green-400/10" },
    blue:   { icon: "text-[#35B2FF]", bg: "bg-[#35B2FF]/10" },
    red:    { icon: "text-red-400",   bg: "bg-red-400/10" },
    purple: { icon: "text-violet-400", bg: "bg-violet-400/10" },
    teal:   { icon: "text-teal-400",  bg: "bg-teal-400/10" },
    indigo: { icon: "text-indigo-400", bg: "bg-indigo-400/10" },
    gray:   { icon: "text-gray-400",  bg: "bg-gray-400/10" },
  };
  const { icon: iconCls, bg } = colorMap[color] ?? colorMap.gray;

  return (
    <Link href={href} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-4 hover:border-[#35B2FF]/30 transition-colors group flex flex-col gap-3 min-h-[138px]">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
          <span className={`w-4 h-4 ${iconCls}`}>{icon}</span>
        </div>
        <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <div>
        <p className="text-xl font-bold text-white leading-none mb-1">{value}</p>
        <p className="text-sm font-medium text-gray-300">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </Link>
  );
}

// ── Icon components ─────────────────────────────────────────────────────────

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/>
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
    </svg>
  );
}

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-8.9-5h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4l-3.87 7H8.53L4.27 2H1v2h2l3.6 7.59L5.25 14c-.16.28-.25.61-.25.96C5 16.1 5.9 17 7 17h12v-2H7.42c-.13 0-.25-.11-.25-.25l.03-.12.9-1.63z"/>
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  );
}
