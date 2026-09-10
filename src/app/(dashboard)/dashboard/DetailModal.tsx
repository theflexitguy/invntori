"use client";

import React from "react";

export type DetailPanel =
  | "stock" | "requests" | "equipment" | "fleet"
  | "orders" | "teamUsage" | "issues" | "warehouses";

interface StockItem { id: string; name: string; qty: number; threshold: number; unitCost: number; unit: string; }
interface EquipmentItem { id: string; name: string; status: string; }
interface VehicleItem { id: string; name: string; driverName?: string; condition?: string; }
interface POItem { id: string; vendor: string; status: string; expectedDate?: Date; itemCount: number; createdAt: Date; }
interface RequestItem { id: string; submittedBy: string; timestamp: Date; itemCount: number; status: string; }

export interface ModalData {
  allStockItems: StockItem[];
  atRiskItems: StockItem[];
  equipment: EquipmentItem[];
  vehicles: VehicleItem[];
  requests: RequestItem[];
  pendingPOs: POItem[];
  warehouses: { id: string; name: string; location?: string }[];
  topEmployees: { name: string; count: number }[];
}

const panelTitles: Record<DetailPanel, string> = {
  stock: "Inventory Status",
  requests: "Recent Requests",
  equipment: "Equipment",
  fleet: "Fleet",
  orders: "Purchase Orders",
  teamUsage: "Team Activity",
  issues: "Open Issues",
  warehouses: "Warehouses",
};

export function DetailModal({ panel, data, onClose }: {
  panel: DetailPanel;
  data: ModalData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex" onClick={onClose}>
      <div
        className="ml-auto w-full max-w-lg bg-[#0f1117] border-l border-[#2a2f3e] h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2f3e] shrink-0">
          <h2 className="text-lg font-bold text-white">{panelTitles[panel]}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {panel === "stock"      && <StockPanel items={data.allStockItems} />}
          {panel === "requests"   && <RequestsPanel requests={data.requests} />}
          {panel === "equipment"  && <EquipmentPanel equipment={data.equipment} />}
          {panel === "fleet"      && <FleetPanel vehicles={data.vehicles} />}
          {panel === "orders"     && <OrdersPanel orders={data.pendingPOs} />}
          {panel === "teamUsage"  && <TeamUsagePanel employees={data.topEmployees} />}
          {panel === "issues"     && <IssuesPanel atRiskItems={data.atRiskItems} equipment={data.equipment} orders={data.pendingPOs} />}
          {panel === "warehouses" && <WarehousesPanel warehouses={data.warehouses} />}
        </div>
      </div>
    </div>
  );
}

// ── Stock ────────────────────────────────────────────────────────────────────

function StockPanel({ items }: { items: StockItem[] }) {
  const outOfStock = items.filter(i => i.threshold > 0 && i.qty === 0).sort((a, b) => a.name.localeCompare(b.name));
  const low = items.filter(i => i.threshold > 0 && i.qty > 0 && i.qty <= i.threshold).sort((a, b) => (a.qty / a.threshold) - (b.qty / b.threshold));
  const healthy = items.filter(i => !(i.threshold > 0 && i.qty <= i.threshold)).sort((a, b) => a.name.localeCompare(b.name));
  if (items.length === 0) return <EmptyState text="No inventory items found." />;
  return (
    <div>
      <StockGroup label="Out of Stock" dot="bg-red-400" labelCls="text-red-400" items={outOfStock} valueColor="text-red-400" />
      <StockGroup label="Low Stock" dot="bg-amber-400" labelCls="text-amber-400" items={low} valueColor="text-amber-400" />
      <StockGroup label="In Stock" dot="bg-green-400" labelCls="text-green-400" items={healthy} valueColor="text-white" />
    </div>
  );
}

function StockGroup({ label, dot, labelCls, items, valueColor }: {
  label: string; dot: string; labelCls: string; items: StockItem[]; valueColor: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[#2a2f3e] bg-[#1a1f2e]/60">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <span className={`text-xs font-bold ${labelCls}`}>{items.length}</span>
      </div>
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between px-6 py-3.5 border-b border-[#2a2f3e]/40">
          <div>
            <p className="text-sm font-medium text-white">{item.name}</p>
            {item.threshold > 0 && <p className="text-xs text-gray-500 mt-0.5">Reorder at {item.threshold}{item.unit ? ` ${item.unit}` : ""}</p>}
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold ${valueColor}`}>{item.qty === 0 ? "OUT" : item.qty}</p>
            {item.unit && item.qty > 0 && <p className="text-xs text-gray-500">{item.unit}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Requests ─────────────────────────────────────────────────────────────────

function RequestsPanel({ requests }: { requests: RequestItem[] }) {
  const sorted = [...requests].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 50);
  if (sorted.length === 0) return <EmptyState text="No recent requests." />;
  return (
    <div className="divide-y divide-[#2a2f3e]">
      {sorted.map(req => (
        <div key={req.id} className="flex items-center gap-4 px-6 py-4">
          <div className="w-9 h-9 rounded-full bg-[#35B2FF]/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[#35B2FF]">{req.submittedBy.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{req.submittedBy}</p>
            <p className="text-xs text-gray-500">{req.itemCount} item{req.itemCount !== 1 ? "s" : ""} · {req.timestamp.toLocaleDateString()}</p>
          </div>
          <StatusBadge status={req.status} />
        </div>
      ))}
    </div>
  );
}

// ── Equipment ─────────────────────────────────────────────────────────────────

function EquipmentPanel({ equipment }: { equipment: EquipmentItem[] }) {
  if (equipment.length === 0) return <EmptyState text="No equipment found." />;
  const inRepair  = equipment.filter(e => e.status === "inRepair");
  const checkedOut = equipment.filter(e => e.status === "checkedOut");
  const available  = equipment.filter(e => e.status === "available");
  const other      = equipment.filter(e => !["inRepair","checkedOut","available"].includes(e.status));
  return (
    <div>
      <EqGroup label="In Repair"   count={inRepair.length}   dot="bg-red-400"     labelCls="text-red-400"      items={inRepair} />
      <EqGroup label="Checked Out" count={checkedOut.length} dot="bg-[#35B2FF]"   labelCls="text-[#35B2FF]"    items={checkedOut} />
      <EqGroup label="Available"   count={available.length}  dot="bg-green-400"   labelCls="text-green-400"    items={available} />
      <EqGroup label="Other"       count={other.length}      dot="bg-gray-500"    labelCls="text-gray-400"     items={other} />
    </div>
  );
}

function EqGroup({ label, count, dot, labelCls, items }: {
  label: string; count: number; dot: string; labelCls: string; items: EquipmentItem[];
}) {
  if (count === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[#2a2f3e] bg-[#1a1f2e]/60">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <span className={`text-xs font-bold ${labelCls}`}>{count}</span>
      </div>
      {items.map(item => (
        <div key={item.id} className="flex items-center justify-between px-6 py-3.5 border-b border-[#2a2f3e]/40">
          <p className="text-sm font-medium text-white">{item.name}</p>
          <StatusBadge status={item.status} />
        </div>
      ))}
    </div>
  );
}

// ── Fleet ─────────────────────────────────────────────────────────────────────

function FleetPanel({ vehicles }: { vehicles: VehicleItem[] }) {
  if (vehicles.length === 0) return <EmptyState text="No vehicles found." />;
  const sorted = [...vehicles].sort((a, b) => {
    const aAttn = a.condition === "poor" || a.condition === "fair";
    const bAttn = b.condition === "poor" || b.condition === "fair";
    if (aAttn !== bAttn) return aAttn ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return (
    <div className="divide-y divide-[#2a2f3e]">
      {sorted.map(v => (
        <div key={v.id} className="flex items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium text-white">{v.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{v.driverName ?? "Unassigned"}</p>
          </div>
          <ConditionBadge condition={v.condition} />
        </div>
      ))}
    </div>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────

function OrdersPanel({ orders }: { orders: POItem[] }) {
  if (orders.length === 0) return <EmptyState text="No pending purchase orders." />;
  const now = new Date();
  const sorted = [...orders].sort((a, b) => {
    const aO = a.expectedDate ? a.expectedDate < now : false;
    const bO = b.expectedDate ? b.expectedDate < now : false;
    if (aO !== bO) return aO ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  return (
    <div className="divide-y divide-[#2a2f3e]">
      {sorted.map(po => {
        const overdue = po.expectedDate ? po.expectedDate < now : false;
        return (
          <div key={po.id} className="px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white truncate mr-3">{po.vendor}</p>
              <StatusBadge status={overdue ? "Overdue" : po.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {po.expectedDate && (
                <p className={`text-xs ${overdue ? "text-red-400" : "text-gray-500"}`}>
                  {overdue ? "Overdue · " : "Expected · "}{po.expectedDate.toLocaleDateString()}
                </p>
              )}
              {po.itemCount > 0 && <p className="text-xs text-gray-500">{po.itemCount} items</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Team Usage ────────────────────────────────────────────────────────────────

function TeamUsagePanel({ employees }: { employees: { name: string; count: number }[] }) {
  if (employees.length === 0) return <EmptyState text="No activity in this period." />;
  const max = employees[0]?.count ?? 1;
  return (
    <div className="p-6 space-y-5">
      {employees.map((emp, i) => (
        <div key={emp.name} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 w-4 text-right shrink-0">{i + 1}</span>
          <div className="w-8 h-8 rounded-full bg-violet-400/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-violet-400">{emp.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{emp.name}</p>
            <div className="mt-1.5 h-1.5 bg-[#2a2f3e] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${(emp.count / max) * 100}%` }} />
            </div>
          </div>
          <span className="text-sm font-bold text-gray-300 shrink-0">{emp.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Issues ────────────────────────────────────────────────────────────────────

function IssuesPanel({ atRiskItems, equipment, orders }: {
  atRiskItems: StockItem[];
  equipment: EquipmentItem[];
  orders: POItem[];
}) {
  const now = new Date();
  const outOfStock = atRiskItems.filter(i => i.qty === 0);
  const inRepair   = equipment.filter(e => e.status === "inRepair");
  const overduePOs = orders.filter(po => po.expectedDate && po.expectedDate < now);

  if (outOfStock.length + inRepair.length + overduePOs.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-green-400/15 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-white font-semibold">All Clear</p>
        <p className="text-gray-500 text-sm mt-1">No open issues right now.</p>
      </div>
    );
  }

  return (
    <div>
      {outOfStock.length > 0 && (
        <IssueSection label="Out of Stock" dot="bg-red-400" labelCls="text-red-400" count={outOfStock.length}>
          {outOfStock.map(item => (
            <div key={item.id} className="flex items-center justify-between px-6 py-3 border-b border-[#2a2f3e]/40">
              <p className="text-sm text-white">{item.name}</p>
              <span className="text-xs font-bold text-red-400">OUT</span>
            </div>
          ))}
        </IssueSection>
      )}
      {inRepair.length > 0 && (
        <IssueSection label="Equipment in Repair" dot="bg-amber-400" labelCls="text-amber-400" count={inRepair.length}>
          {inRepair.map(item => (
            <div key={item.id} className="flex items-center justify-between px-6 py-3 border-b border-[#2a2f3e]/40">
              <p className="text-sm text-white">{item.name}</p>
              <span className="text-xs font-bold text-amber-400">In Repair</span>
            </div>
          ))}
        </IssueSection>
      )}
      {overduePOs.length > 0 && (
        <IssueSection label="Overdue Orders" dot="bg-orange-400" labelCls="text-orange-400" count={overduePOs.length}>
          {overduePOs.map(po => (
            <div key={po.id} className="flex items-center justify-between px-6 py-3 border-b border-[#2a2f3e]/40">
              <p className="text-sm text-white">{po.vendor}</p>
              <span className="text-xs text-orange-400">{po.expectedDate?.toLocaleDateString()}</span>
            </div>
          ))}
        </IssueSection>
      )}
    </div>
  );
}

function IssueSection({ label, dot, labelCls, count, children }: {
  label: string; dot: string; labelCls: string; count: number; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[#2a2f3e] bg-[#1a1f2e]/60">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <span className={`text-xs font-bold ${labelCls}`}>{count}</span>
      </div>
      {children}
    </div>
  );
}

// ── Warehouses ────────────────────────────────────────────────────────────────

function WarehousesPanel({ warehouses }: { warehouses: { id: string; name: string; location?: string }[] }) {
  if (warehouses.length === 0) return <EmptyState text="No warehouses found." />;
  return (
    <div className="divide-y divide-[#2a2f3e]">
      {warehouses.map(wh => (
        <div key={wh.id} className="flex items-center gap-3 px-6 py-4">
          <div className="w-9 h-9 rounded-lg bg-teal-400/10 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">{wh.name}</p>
            {wh.location && <p className="text-xs text-gray-500 mt-0.5">{wh.location}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return <p className="text-gray-500 text-sm px-6 py-10 text-center">{text}</p>;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-amber-400/15 text-amber-400";
  if (s === "available" || s.includes("complet") || s.includes("receiv")) cls = "bg-green-400/15 text-green-400";
  else if (s === "inrepair" || s === "overdue" || s === "out") cls = "bg-red-400/15 text-red-400";
  else if (s === "checkedout" || s === "assigned" || s === "pending") cls = "bg-[#35B2FF]/15 text-[#35B2FF]";
  const label = status === "checkedOut" ? "Assigned" : status === "inRepair" ? "In Repair" : status === "available" ? "Available" : status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function ConditionBadge({ condition }: { condition?: string }) {
  if (!condition) return <span className="text-xs text-gray-500">—</span>;
  const cls: Record<string, string> = {
    excellent: "bg-green-400/15 text-green-400",
    good:      "bg-[#35B2FF]/15 text-[#35B2FF]",
    fair:      "bg-amber-400/15 text-amber-400",
    poor:      "bg-red-400/15 text-red-400",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls[condition] ?? "bg-gray-400/15 text-gray-400"}`}>
      {condition.charAt(0).toUpperCase() + condition.slice(1)}
    </span>
  );
}
