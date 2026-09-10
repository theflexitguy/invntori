"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Equipment, EquipmentRepair } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseFirestoreDate(
  value: Timestamp | { seconds: number; nanoseconds?: number } | string | Date | null | undefined
): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatDate(value: Parameters<typeof parseFirestoreDate>[0]): string {
  const d = parseFirestoreDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: Parameters<typeof parseFirestoreDate>[0]): string {
  const d = parseFirestoreDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

type FilterTab = "open" | "all" | "resolved";

const OPEN_STATUSES = new Set(["reported", "approved", "inProgress"]);
const RESOLVED_STATUSES = new Set(["completed", "rejected"]);

// ── Status config ─────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  pill: string;
  glow: string;
  dot: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  reported: {
    label: "Reported",
    pill: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.25)]",
    dot: "bg-amber-400",
  },
  approved: {
    label: "Approved",
    pill: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    glow: "shadow-[0_0_8px_rgba(59,130,246,0.25)]",
    dot: "bg-blue-400",
  },
  inProgress: {
    label: "In Progress",
    pill: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    glow: "shadow-[0_0_8px_rgba(249,115,22,0.25)]",
    dot: "bg-orange-400",
  },
  completed: {
    label: "Completed",
    pill: "bg-green-500/15 text-green-400 border border-green-500/30",
    glow: "shadow-[0_0_8px_rgba(34,197,94,0.25)]",
    dot: "bg-green-400",
  },
  rejected: {
    label: "Rejected",
    pill: "bg-gray-500/15 text-gray-400 border border-gray-500/30",
    glow: "",
    dot: "bg-gray-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.reported;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.pill} ${cfg.glow}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Rejection modal ───────────────────────────────────────────────────────────

function RejectModal({
  repair,
  onConfirm,
  onClose,
}: {
  repair: EquipmentRepair;
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (!note.trim()) {
      setError("A response note is required when rejecting.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm(note.trim());
    } catch {
      setError("Failed to reject. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white text-lg">Reject Repair Request</h3>
            <p className="text-gray-400 text-sm mt-0.5">{repair.equipmentName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors mt-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Response Note <span className="text-red-400">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain why this repair request is being rejected…"
            rows={4}
            className="w-full bg-[#0f1117] border border-[#2a2f3e] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/60 resize-none transition-colors"
            autoFocus
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm border border-[#2a2f3e] text-gray-400 hover:text-white hover:border-[#3a3f4e] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!note.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Rejecting…" : "Reject Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Repair card ───────────────────────────────────────────────────────────────

function RepairCard({
  repair,
  equipment,
  onApprove,
  onReject,
  onComplete,
}: {
  repair: EquipmentRepair;
  equipment: Equipment | undefined;
  onApprove: () => Promise<void>;
  onReject: () => void;
  onComplete: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actioning, setActioning] = useState<"approve" | "complete" | null>(null);

  const isOpen = OPEN_STATUSES.has(repair.status);
  const isResolved = RESOLVED_STATUSES.has(repair.status);

  const descTruncated =
    !expanded && repair.description.length > 120
      ? repair.description.slice(0, 120) + "…"
      : repair.description;

  async function handleApprove() {
    setActioning("approve");
    try {
      await onApprove();
    } finally {
      setActioning(null);
    }
  }

  async function handleComplete() {
    setActioning("complete");
    try {
      await onComplete();
    } finally {
      setActioning(null);
    }
  }

  return (
    <div
      className={`bg-[#1a1f2e] border rounded-2xl overflow-hidden transition-all duration-200 ${
        isOpen
          ? "border-[#2a2f3e] hover:border-[#35B2FF]/30"
          : "border-[#1e2230] opacity-75 hover:opacity-90"
      }`}
    >
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h3 className="font-semibold text-white text-base leading-tight truncate">
                {repair.equipmentName}
              </h3>
              {equipment?.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#35B2FF]/10 text-[#35B2FF] border border-[#35B2FF]/20 shrink-0">
                  {equipment.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Reported by {repair.reportedByName}</span>
              <span className="text-gray-600">·</span>
              <span>{formatDate(repair.reportedAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={repair.status} />
            <button
              onClick={() => setExpanded((v) => !v)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                expanded
                  ? "bg-[#35B2FF]/15 text-[#35B2FF]"
                  : "bg-white/5 text-gray-500 hover:text-white hover:bg-white/10"
              }`}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Description preview */}
        <p className="text-sm text-gray-400 mt-3 leading-relaxed">{descTruncated}</p>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-[#2a2f3e] bg-[#151a26] px-5 py-5 space-y-4">
          {/* Full description */}
          {repair.description.length > 120 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Full Description
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">{repair.description}</p>
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Reported</p>
              <p className="text-gray-300">{formatDateTime(repair.reportedAt)}</p>
            </div>
            {repair.reviewedAt && (
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Reviewed</p>
                <p className="text-gray-300">{formatDateTime(repair.reviewedAt)}</p>
              </div>
            )}
            {repair.reviewedByName && (
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Reviewed by</p>
                <p className="text-gray-300">{repair.reviewedByName}</p>
              </div>
            )}
            {repair.resolvedAt && (
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Resolved</p>
                <p className="text-gray-300">{formatDateTime(repair.resolvedAt)}</p>
              </div>
            )}
          </div>

          {/* Response note */}
          {repair.responseNote && (
            <div className="bg-[#0f1117] border border-[#2a2f3e] rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Admin Response
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">{repair.responseNote}</p>
            </div>
          )}

          {/* Action buttons */}
          {repair.status === "reported" && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleApprove}
                disabled={actioning !== null}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/30 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actioning === "approve" ? (
                  <Spinner size={14} />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {actioning === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                onClick={onReject}
                disabled={actioning !== null}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </button>
            </div>
          )}

          {(repair.status === "approved" || repair.status === "inProgress") && (
            <div className="pt-1">
              <button
                onClick={handleComplete}
                disabled={actioning !== null}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actioning === "complete" ? (
                  <Spinner size={14} />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {actioning === "complete" ? "Marking Complete…" : "Mark as Completed"}
              </button>
            </div>
          )}

          {isResolved && !repair.responseNote && !repair.reviewedByName && (
            <p className="text-xs text-gray-600 italic pt-1">No additional notes recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: FilterTab }) {
  const messages: Record<FilterTab, { icon: string; title: string; body: string }> = {
    open: {
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      title: "No open repairs",
      body: "All equipment is in good shape. Open repairs will appear here when reported.",
    },
    all: {
      icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
      title: "No repair records",
      body: "Equipment repair records will appear here once submitted by your team.",
    },
    resolved: {
      icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
      title: "No resolved repairs",
      body: "Completed and rejected repair requests will be archived here.",
    },
  };

  const { icon, title, body } = messages[tab];

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1a1f2e] border border-[#2a2f3e] flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <p className="text-white font-semibold mb-1">{title}</p>
      <p className="text-gray-500 text-sm max-w-xs">{body}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EquipmentRepairsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [repairs, setRepairs] = useState<EquipmentRepair[]>([]);
  const [equipmentMap, setEquipmentMap] = useState<Map<string, Equipment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("open");
  const [rejectTarget, setRejectTarget] = useState<EquipmentRepair | null>(null);

  // Admin guard
  useEffect(() => {
    if (user && !user.isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;

    const [repairSnap, equipSnap] = await Promise.all([
      getDocs(collection(db, "companies", cid, "equipmentRepairs")),
      getDocs(collection(db, "companies", cid, "equipment")),
    ]);

    const repairList: EquipmentRepair[] = repairSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<EquipmentRepair, "id">),
    }));

    // Sort: open first, then by reportedAt descending
    repairList.sort((a, b) => {
      const aOpen = OPEN_STATUSES.has(a.status) ? 0 : 1;
      const bOpen = OPEN_STATUSES.has(b.status) ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      const aTime = parseFirestoreDate(a.reportedAt)?.getTime() ?? 0;
      const bTime = parseFirestoreDate(b.reportedAt)?.getTime() ?? 0;
      return bTime - aTime;
    });

    const eMap = new Map<string, Equipment>();
    equipSnap.docs.forEach((d) => {
      eMap.set(d.id, { id: d.id, ...(d.data() as Omit<Equipment, "id">) });
    });

    setRepairs(repairList);
    setEquipmentMap(eMap);
    setLoading(false);
  }, [user?.companyID]);

  useEffect(() => {
    load();
  }, [load]);

  // Filtered list
  const filtered = useMemo(() => {
    return repairs.filter((r) => {
      if (activeTab === "open") return OPEN_STATUSES.has(r.status);
      if (activeTab === "resolved") return RESOLVED_STATUSES.has(r.status);
      return true;
    });
  }, [repairs, activeTab]);

  const openCount = useMemo(
    () => repairs.filter((r) => OPEN_STATUSES.has(r.status)).length,
    [repairs]
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleApprove(repair: EquipmentRepair) {
    if (!user?.companyID || !repair.id) return;
    const cid = user.companyID;
    const now = Timestamp.now();
    const reviewedByName = user.displayName ?? user.email ?? "Admin";

    await updateDoc(doc(db, "companies", cid, "equipmentRepairs", repair.id), {
      status: "approved",
      reviewedAt: now,
      reviewedByName,
    });

    // Set equipment status to inRepair if not already
    const equip = equipmentMap.get(repair.equipmentID);
    if (equip && equip.status !== "inRepair" && repair.equipmentID) {
      await updateDoc(doc(db, "companies", cid, "equipment", repair.equipmentID), {
        status: "inRepair",
      });
      setEquipmentMap((prev) => {
        const next = new Map(prev);
        const e = next.get(repair.equipmentID);
        if (e) next.set(repair.equipmentID, { ...e, status: "inRepair" });
        return next;
      });
    }

    setRepairs((prev) =>
      prev.map((r) =>
        r.id === repair.id
          ? { ...r, status: "approved", reviewedAt: now, reviewedByName }
          : r
      )
    );
  }

  async function handleReject(repair: EquipmentRepair, responseNote: string) {
    if (!user?.companyID || !repair.id) return;
    const cid = user.companyID;
    const now = Timestamp.now();
    const reviewedByName = user.displayName ?? user.email ?? "Admin";

    await updateDoc(doc(db, "companies", cid, "equipmentRepairs", repair.id), {
      status: "rejected",
      reviewedAt: now,
      reviewedByName,
      responseNote,
    });

    // If equipment is inRepair and no other open repairs exist, set back to available
    const equip = equipmentMap.get(repair.equipmentID);
    if (equip?.status === "inRepair" && repair.equipmentID) {
      const otherOpenRepairs = repairs.filter(
        (r) =>
          r.id !== repair.id &&
          r.equipmentID === repair.equipmentID &&
          OPEN_STATUSES.has(r.status)
      );
      if (otherOpenRepairs.length === 0) {
        await updateDoc(doc(db, "companies", cid, "equipment", repair.equipmentID), {
          status: "available",
        });
        setEquipmentMap((prev) => {
          const next = new Map(prev);
          const e = next.get(repair.equipmentID);
          if (e) next.set(repair.equipmentID, { ...e, status: "available" });
          return next;
        });
      }
    }

    setRepairs((prev) =>
      prev.map((r) =>
        r.id === repair.id
          ? { ...r, status: "rejected", reviewedAt: now, reviewedByName, responseNote }
          : r
      )
    );
    setRejectTarget(null);
  }

  async function handleComplete(repair: EquipmentRepair) {
    if (!user?.companyID || !repair.id) return;
    const cid = user.companyID;
    const now = Timestamp.now();

    await updateDoc(doc(db, "companies", cid, "equipmentRepairs", repair.id), {
      status: "completed",
      resolvedAt: now,
    });

    // Set equipment status back to available
    if (repair.equipmentID) {
      await updateDoc(doc(db, "companies", cid, "equipment", repair.equipmentID), {
        status: "available",
      });
      setEquipmentMap((prev) => {
        const next = new Map(prev);
        const e = next.get(repair.equipmentID);
        if (e) next.set(repair.equipmentID, { ...e, status: "available" });
        return next;
      });
    }

    setRepairs((prev) =>
      prev.map((r) =>
        r.id === repair.id ? { ...r, status: "completed", resolvedAt: now } : r
      )
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!user?.isAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: "open", label: "Open", count: openCount },
    { id: "all", label: "All", count: repairs.length },
    { id: "resolved", label: "Resolved", count: repairs.filter((r) => RESOLVED_STATUSES.has(r.status)).length },
  ];

  return (
    <div className="p-6 xl:p-8 w-full max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-1">
        <Link
          href="/admin"
          className="text-gray-500 hover:text-white transition-colors text-sm"
        >
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
        <span className="text-sm text-white">Equipment Repairs</span>
      </div>

      {/* Header */}
      <div className="mt-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Equipment Repairs</h2>
            <p className="text-gray-400 mt-1 text-sm">
              {openCount > 0 ? (
                <>
                  <span className="text-amber-400 font-medium">{openCount}</span>
                  {" open repair"}{openCount !== 1 ? "s" : ""} requiring attention
                </>
              ) : (
                "No open repairs — all clear"
              )}
            </p>
          </div>

          {openCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-semibold text-amber-400">{openCount} Open</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/25 shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? "bg-[#35B2FF]/20 text-[#35B2FF]"
                    : "bg-white/5 text-gray-500"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Repair list */}
      {filtered.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="space-y-3">
          {filtered.map((repair) => (
            <RepairCard
              key={repair.id}
              repair={repair}
              equipment={equipmentMap.get(repair.equipmentID)}
              onApprove={() => handleApprove(repair)}
              onReject={() => setRejectTarget(repair)}
              onComplete={() => handleComplete(repair)}
            />
          ))}
        </div>
      )}

      {/* Rejection modal */}
      {rejectTarget && (
        <RejectModal
          repair={rejectTarget}
          onConfirm={(note) => handleReject(rejectTarget, note)}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
