"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  collection, getDocs, query, orderBy, limit, where
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  BoxIcon, ToolsIcon, CarIcon, CartIcon, PeopleIcon, ChartLineIcon, GridIcon,
  SparklesIcon, ChevronDownIcon, ChevronRightIcon,
} from "@/components/layout/nav";
import { IconBadge, Pill, TINTS, type Tint } from "@/components/ui/ios";
import { DetailModal, type DetailPanel, type ModalData } from "./DetailModal";

const CLOUD_FUNCTION_URL = "https://us-central1-premium-inventory-app.cloudfunctions.net/askInvntori";

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
  warehouses: { id: string; name: string; location?: string }[];
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
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [aiNotConfigured, setAiNotConfigured] = useState(false);
  const [detailPanel, setDetailPanel] = useState<DetailPanel | null>(null);

  const prevDataRef = useRef<DashboardData | null>(null);
  const insightsAbortRef = useRef<AbortController | null>(null);

  const startDate = useMemo(() => subtractDays(rangeDays), [rangeDays]);

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

      const productCostMap: Record<string, number> = {};
      for (const doc of prodSnap.docs) {
        const d = doc.data();
        if (d.isRetired !== true) {
          productCostMap[doc.id] = parseNumber(d.unitCost) ?? 0;
        }
      }

      const invSnaps = await Promise.all(
        whSnap.docs.map((w) => getDocs(collection(db, "companies", cid, "warehouses", w.id, "inventory")))
      );

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

      const warehouses = whSnap.docs.map((d) => ({
        id: d.id,
        name: (d.data().name as string | undefined) ?? d.id,
        location: d.data().location as string | undefined,
      }));
      setData({ allStockItems, equipment, vehicles, activeEmployeeCount, requests, pendingPOs, warehouseCount: whSnap.size, warehouses });
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

    const periodRequests = requests.filter((r) => r.timestamp >= startDate);
    const periodRequestCount = periodRequests.length;

    const activeUsersInPeriod = new Set(periodRequests.map((r) => r.submittedByUID).filter(Boolean)).size;
    const activeUsers = activeUsersInPeriod;

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

    // Fallback computed insights (shown if AI is not configured or still loading)
    const fallbackInsights: string[] = [];
    const dailyPulls = periodRequestCount / rangeDays;
    if (dailyPulls > 0) {
      fallbackInsights.push(`Team is averaging ${dailyPulls.toFixed(1)} supply requests/day over the last ${rangeDays} days.`);
    }
    if (atRiskItems.length > 0) {
      const listed = atRiskItems.slice(0, 3).map((i) => i.name).join(", ");
      const extra = atRiskItems.length > 3 ? ` +${atRiskItems.length - 3} more` : "";
      fallbackInsights.push(`${atRiskItems.length} item${atRiskItems.length !== 1 ? "s" : ""} at or below reorder threshold: ${listed}${extra}.`);
    }
    if (overdueOrderCount > 0) {
      fallbackInsights.push(`${overdueOrderCount} supply order${overdueOrderCount !== 1 ? "s are" : " is"} overdue — may be delaying restocks.`);
    }
    if (topEmployees[0]) {
      fallbackInsights.push(`${topEmployees[0].name} led supply pulls this period with ${topEmployees[0].count} request${topEmployees[0].count !== 1 ? "s" : ""}.`);
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
      fallbackInsights,
    };
  }, [data, startDate, rangeDays]);

  // ── AI Insights ───────────────────────────────────────────────────────────

  const generateInsights = useCallback(async () => {
    if (!metrics || !user?.companyID) return;

    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    insightsAbortRef.current?.abort();
    const abort = new AbortController();
    insightsAbortRef.current = abort;

    setGeneratingInsights(true);
    setAiInsights(null);
    setAiNotConfigured(false);

    const m = metrics;
    const context = [
      `Time period: last ${rangeDays} days`,
      `Inventory: ${m.totalStockItems} total items, ${m.healthyStockCount} healthy, ${m.atRiskItems.length} at/below reorder threshold, ${m.outOfStockCount} out of stock`,
      m.totalInventoryValue > 0 ? `Total inventory value: ${formatCurrency(m.totalInventoryValue)}` : null,
      `Warehouses: ${m.warehouseCount}`,
      `Active employees: ${m.activeEmployeeCount}`,
      `Supply requests in period: ${m.periodRequestCount} (${m.activeUsers} unique users)`,
      m.topEmployees.length > 0
        ? `Top employees by pulls: ${m.topEmployees.slice(0, 3).map((e) => `${e.name} (${e.count})`).join(", ")}`
        : null,
      m.atRiskItems.length > 0
        ? `Items needing reorder: ${m.atRiskItems.slice(0, 5).map((i) => `${i.name} (qty: ${i.qty}, threshold: ${i.threshold})`).join("; ")}`
        : "No items at reorder threshold",
      `Equipment: ${m.totalEquipment} total, ${m.checkedOutCount} assigned to techs, ${m.openRepairCount} in repair`,
      `Fleet: ${m.totalVehicles} vehicles, ${m.activeVehicleCount} assigned, ${m.vehicleAttentionCount} need attention`,
      `Purchase orders: ${m.pendingPOCount} pending, ${m.overdueOrderCount} overdue`,
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch(CLOUD_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          companyID: user.companyID,
          messages: [{ role: "user", content: `Here is the current business data snapshot:\n\n${context}\n\nPlease generate your insights.` }],
          system: `You are invntori's AI insights engine for a pest control supply and operations business. The user has provided a live data snapshot. Generate exactly 4 to 6 specific, actionable business insights. Format each insight as a single line starting with • followed by the insight text. Do not include any introduction, headers, or closing remarks — only the bullet lines. Include a mix of: wins worth calling out, risks or inefficiencies to address, and operational patterns worth knowing. Reference specific numbers from the data. Keep each insight to one clear sentence.`,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        if (res.status === 403) setAiNotConfigured(true);
        setGeneratingInsights(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              fullText += evt.delta.text ?? "";
            }
            // OpenAI-compatible fallback
            if (evt.choices?.[0]?.delta?.content) {
              fullText += evt.choices[0].delta.content;
            }
          } catch {
            // malformed SSE chunk — skip
          }
        }
      }

      const parsed = fullText
        .split("\n")
        .map((l) => l.replace(/^[•\-\*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
        .filter((l) => l.length > 15);

      setAiInsights(parsed.length > 0 ? parsed : null);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        // AI not configured or error — fall through to fallback insights
        setAiInsights(null);
      }
    } finally {
      setGeneratingInsights(false);
    }
  }, [metrics, user?.companyID, rangeDays]);

  // Auto-generate when fresh data loads; reset on new load
  useEffect(() => {
    if (data && data !== prevDataRef.current) {
      prevDataRef.current = data;
      generateInsights();
    }
  }, [data, generateInsights]);

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-3">
        <Spinner size={32} />
        <p className="text-[rgba(235,235,245,0.6)] text-[15px]">Loading dashboard…</p>
      </div>
    );
  }

  if (!metrics) {
    return <div className="p-6 text-[rgba(235,235,245,0.6)] text-[15px]">No data available.</div>;
  }

  const m = metrics;
  const displayInsights = aiInsights ?? m.fallbackInsights;
  const insightCount = generatingInsights ? 0 : displayInsights.length;

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full space-y-4">

      {/* Date range */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
          {([30, 60, 90, 180] as const).map((days) => {
            const label = days === 180 ? "6M" : `${days}D`;
            const active = rangeDays === days;
            return (
              <button
                key={days}
                onClick={() => setRangeDays(days)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-[15px] font-semibold transition-colors ${
                  active ? "bg-[#0A84FF] text-white" : "bg-[#1C1C1E] text-[rgba(235,235,245,0.6)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="text-right shrink-0 text-[12px] leading-tight text-[rgba(235,235,245,0.6)] pt-1">
          <div>{formatDate(subtractDays(rangeDays))}</div>
          <div>→ {formatDate(new Date())}</div>
        </div>
      </div>

      {/* Company Overview */}
      <div className="bg-[#1C1C1E] rounded-[18px] p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-white leading-tight tracking-tight">
            Company Overview
          </h2>
          <HealthBadge label={m.healthLabel} color={m.healthColor} />
        </div>
        <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-1">
          {formatDate(subtractDays(rangeDays))} to {formatDate(new Date())}
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 mt-4">
          <MetricTile onClick={() => setDetailPanel("stock")} label="Inventory Value" value={m.totalInventoryValue > 0 ? formatCurrency(m.totalInventoryValue) : "$0"} tint="green" />
          <MetricTile onClick={() => setDetailPanel("teamUsage")} label="Active Staff" value={String(m.activeEmployeeCount)} tint="blue" />
          <MetricTile onClick={() => setDetailPanel("warehouses")} label="Warehouses" value={String(m.warehouseCount)} tint="teal" />
          <MetricTile onClick={m.openIssues > 0 ? () => setDetailPanel("issues") : undefined} label="Open Issues" value={String(m.openIssues)} tint={m.openIssues > 0 ? "red" : "gray"} />
        </div>
      </div>

      {/* Focus strip */}
      <div className="grid grid-cols-3 gap-3">
        <FocusTile onClick={() => setDetailPanel("stock")} label="Low Stock" value={m.atRiskItems.length} tint={m.atRiskItems.length > 0 ? "orange" : "gray"} />
        <FocusTile onClick={() => setDetailPanel("equipment")} label="Repairs" value={m.openRepairCount} tint={m.openRepairCount > 0 ? "red" : "gray"} />
        <FocusTile onClick={() => setDetailPanel("orders")} label="Orders" value={m.pendingPOCount} tint={m.overdueOrderCount > 0 ? "red" : m.pendingPOCount > 0 ? "teal" : "gray"} />
      </div>

      {/* Areas */}
      <div className="pt-1">
        <div className="flex items-center gap-2 mb-3 px-0.5">
          <GridIcon className="w-[15px] h-[15px] text-[#0A84FF]" />
          <span className="text-[13px] font-semibold text-[rgba(235,235,245,0.6)] tracking-[0.08em] uppercase">
            Areas
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <AreaCard
            onClick={() => setDetailPanel("stock")}
            title="Inventory"
            value={`${m.healthyStockCount}/${m.totalStockItems}`}
            subtitle={m.atRiskItems.length > 0 ? `${m.atRiskItems.length} need reorder` : "items stocked"}
            Icon={BoxIcon}
            tint={m.atRiskItems.length > 0 ? "orange" : "green"}
          />
          <AreaCard
            onClick={() => setDetailPanel("requests")}
            title="Activity"
            value={String(m.periodRequestCount)}
            subtitle={`${m.activeUsers} active user${m.activeUsers !== 1 ? "s" : ""}`}
            Icon={ChartLineIcon}
            tint="blue"
          />
          <AreaCard
            onClick={() => setDetailPanel("equipment")}
            title="Equipment"
            value={String(m.totalEquipment)}
            subtitle={`${m.checkedOutCount} assigned, ${m.openRepairCount} repair`}
            Icon={ToolsIcon}
            tint={m.openRepairCount > 0 ? "red" : "purple"}
          />
          <AreaCard
            onClick={() => setDetailPanel("fleet")}
            title="Fleet"
            value={String(m.totalVehicles)}
            subtitle={`${m.activeVehicleCount} assigned, ${m.vehicleAttentionCount} watch`}
            Icon={CarIcon}
            tint={m.vehicleAttentionCount > 0 ? "orange" : "teal"}
          />
          <AreaCard
            onClick={() => setDetailPanel("orders")}
            title="Orders"
            value={String(m.pendingPOCount)}
            subtitle={m.overdueOrderCount > 0 ? `${m.overdueOrderCount} overdue` : "awaiting delivery"}
            Icon={CartIcon}
            tint={m.overdueOrderCount > 0 ? "red" : "green"}
          />
          <AreaCard
            onClick={() => setDetailPanel("teamUsage")}
            title="Team Usage"
            value={String(m.topEmployees.length)}
            subtitle={m.topEmployees[0] ? `top: ${m.topEmployees[0].name}` : "no pulls yet"}
            Icon={PeopleIcon}
            tint="indigo"
          />
        </div>
      </div>

      {/* Detail Drill-Down Modal */}
      {detailPanel && data && metrics && (
        <DetailModal
          panel={detailPanel}
          data={{
            allStockItems: data.allStockItems,
            atRiskItems: metrics.atRiskItems,
            equipment: data.equipment,
            vehicles: data.vehicles,
            requests: data.requests,
            pendingPOs: data.pendingPOs,
            warehouses: data.warehouses,
            topEmployees: metrics.topEmployees,
          } as ModalData}
          onClose={() => setDetailPanel(null)}
        />
      )}

      {/* Invntori Insights */}
      <div className="bg-[#1C1C1E] rounded-[18px] overflow-hidden">
        <div className="w-full flex items-center gap-2 px-4 py-3.5">
          <button onClick={() => setInsightsOpen((v) => !v)} className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="w-4 h-4 text-[#FFD60A] shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
            <span className="text-[13px] font-semibold text-[rgba(235,235,245,0.6)] tracking-[0.08em] uppercase">
              Invntori Insights
            </span>
            {generatingInsights ? (
              <span className="ml-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0A84FF] animate-pulse" />
                <span className="text-[11px] text-[#0A84FF] font-medium">Generating…</span>
              </span>
            ) : insightCount > 0 ? (
              <span className="ml-1 bg-[#0A84FF] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">{insightCount}</span>
            ) : null}
            <ChevronDownIcon
              className={`w-4 h-4 text-[rgba(235,235,245,0.3)] ml-auto transition-transform ${insightsOpen ? "rotate-180" : ""}`}
            />
          </button>
          <button
            onClick={() => generateInsights()}
            disabled={generatingInsights}
            aria-label="Regenerate insights"
            className="ml-1 p-2 rounded-lg text-[rgba(235,235,245,0.3)] active:bg-white/10 transition-colors disabled:opacity-30 shrink-0"
          >
            <svg className={`w-4 h-4 ${generatingInsights ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {insightsOpen && (
          <div className="border-t border-[#38383A]/60">
            {generatingInsights ? (
              <div className="px-4 py-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0A84FF]/30 mt-2 shrink-0" />
                    <div className="h-4 rounded bg-white/5 animate-pulse" style={{ width: `${65 + (i % 3) * 12}%` }} />
                  </div>
                ))}
              </div>
            ) : aiNotConfigured ? (
              <div className="px-4 py-4">
                <p className="text-[15px] text-[#FF9F0A] mb-1">AI insights not configured</p>
                <p className="text-[13px] text-[rgba(235,235,245,0.6)]">Enable AI in Company Settings → AI Integration, then refresh.</p>
              </div>
            ) : displayInsights.length === 0 ? (
              <p className="px-4 py-4 text-[15px] text-[rgba(235,235,245,0.6)]">
                {!data || data.allStockItems.length === 0
                  ? "Refresh to load your supply data."
                  : "Submit supply requests to start generating insights."}
              </p>
            ) : (
              <div className="px-4 py-4 space-y-3">
                {aiInsights && (
                  <p className="text-[11px] text-[#0A84FF]/70 mb-3 flex items-center gap-1.5">
                    <SparklesIcon className="w-3 h-3" />
                    AI-generated · based on live data
                  </p>
                )}
                {displayInsights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full mt-[7px] shrink-0 ${aiInsights ? "bg-[#FFD60A]" : "bg-[#0A84FF]"}`} />
                    <p className="text-[15px] text-[rgba(235,235,245,0.85)] leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-[#38383A]/60 px-4 py-3 flex items-center gap-2">
              <SparklesIcon className="w-3.5 h-3.5 text-[#0A84FF]" />
              <Link href="/chat" className="text-[13px] text-[rgba(235,235,245,0.6)] active:text-[#0A84FF] transition-colors">
                Ask a follow-up in the invntori chat →
              </Link>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function HealthBadge({ label, color }: { label: string; color: "green" | "orange" | "red" }) {
  const tint: Tint = color === "green" ? "green" : color === "orange" ? "orange" : "red";
  return (
    <span className="shrink-0 mt-0.5">
      <Pill tint={tint}>{label}</Pill>
    </span>
  );
}

function MetricTile({ label, value, tint, onClick }: { label: string; value: string; tint: Tint; onClick?: () => void }) {
  const inner = (
    <>
      <p className={`text-[22px] font-bold leading-none tracking-tight tabular-nums ${TINTS[tint].text}`}>{value}</p>
      <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-1.5">{label}</p>
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full min-w-0 text-left active:opacity-60 transition-opacity">
        {inner}
      </button>
    );
  }
  return <div className="min-w-0">{inner}</div>;
}

function FocusTile({ onClick, label, value, tint }: { onClick: () => void; label: string; value: number; tint: Tint }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-[#1C1C1E] rounded-[14px] py-4 flex flex-col items-center gap-1 active:bg-[#2C2C2E] transition-colors"
    >
      <span className={`text-[26px] font-bold leading-none ${TINTS[tint].text}`}>{value}</span>
      <span className="text-[13px] text-[rgba(235,235,245,0.6)]">{label}</span>
    </button>
  );
}

function AreaCard({
  onClick, title, value, subtitle, Icon, tint,
}: {
  onClick: () => void; title: string; value: string; subtitle: string;
  Icon: ComponentType<{ className?: string }>; tint: Tint;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#1C1C1E] rounded-[18px] p-4 active:bg-[#2C2C2E] transition-colors flex flex-col gap-4 min-h-[132px]"
    >
      <div className="flex items-center justify-between">
        <IconBadge Icon={Icon} tint={tint} />
        <ChevronRightIcon className="w-[13px] h-[13px] text-[rgba(235,235,245,0.3)]" />
      </div>
      <div className="mt-auto">
        <p className="text-[24px] font-bold text-white leading-none tracking-tight">{value}</p>
        <p className="text-[17px] font-medium text-white mt-1.5 leading-tight">{title}</p>
        <p className="text-[13px] text-[rgba(235,235,245,0.6)] mt-0.5 truncate">{subtitle}</p>
      </div>
    </button>
  );
}
