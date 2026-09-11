"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { collection, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { useRouter } from "next/navigation";
import { NavBarRight } from "@/components/layout/NavBarSlot";
import { Sheet } from "@/components/ui/Sheet";
import {
  LargeTitle,
  Group,
  Pill,
  SegmentedControl,
  NavCircleButton,
  fieldCls,
  FieldLabel,
  type Tint,
} from "@/components/ui/ios";
import { FilterCircleIcon, PersonIcon, ClockIcon } from "@/components/layout/nav";
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
  return `${formatDate(value)} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

// ── Status ──────────────────────────────────────────────────────────────────

type FilterTab = "open" | "all" | "resolved";

const OPEN_STATUSES = new Set(["reported", "approved", "inProgress"]);
const RESOLVED_STATUSES = new Set(["completed", "rejected"]);

const STATUS_LABEL: Record<string, string> = {
  reported: "Reported",
  approved: "Approved",
  inProgress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
};

const STATUS_TINT: Record<string, Tint> = {
  reported: "red",
  approved: "blue",
  inProgress: "orange",
  completed: "green",
  rejected: "gray",
};

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "all", label: "All" },
  { value: "resolved", label: "Resolved" },
];

// ── Rejection sheet ─────────────────────────────────────────────────────────

function RejectSheet({
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
      setSaving(false);
    }
  }

  return (
    <Sheet title="Reject Repair Request" onClose={onClose} size="sm">
      <p className="text-[15px] text-[rgba(235,235,245,0.6)] mb-4">{repair.equipmentName}</p>
      <FieldLabel>Response Note</FieldLabel>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why is this request being rejected?"
        rows={4}
        className={`${fieldCls} resize-none`}
        autoFocus
      />
      {error && <p className="text-[15px] text-[#FF453A] mt-2">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={!note.trim() || saving}
        className="mt-4 w-full py-3 rounded-[14px] text-[17px] font-semibold bg-[#FF453A]/15 text-[#FF453A] active:bg-[#FF453A]/25 transition-colors disabled:opacity-40"
      >
        {saving ? "Rejecting…" : "Reject Request"}
      </button>
    </Sheet>
  );
}

// ── Repair card ─────────────────────────────────────────────────────────────

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

  async function run(kind: "approve" | "complete", fn: () => Promise<void>) {
    setActioning(kind);
    try {
      await fn();
    } finally {
      setActioning(null);
    }
  }

  return (
    <Group className={`p-4 ${RESOLVED_STATUSES.has(repair.status) ? "opacity-70" : ""}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left active:opacity-70 transition-opacity"
      >
        <div className="flex items-start gap-3">
          <h3 className="flex-1 min-w-0 text-[17px] font-semibold text-white break-words leading-snug">
            {repair.equipmentName}
          </h3>
          <Pill tint={STATUS_TINT[repair.status] ?? "gray"}>
            {STATUS_LABEL[repair.status] ?? repair.status}
          </Pill>
        </div>

        <p className="text-[17px] text-white mt-2 leading-snug break-words">{repair.description}</p>

        <div className="flex items-center gap-3 mt-3">
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            <PersonIcon className="w-[15px] h-[15px] text-[rgba(235,235,245,0.6)] shrink-0" />
            <span className="text-[15px] text-[rgba(235,235,245,0.6)] truncate">
              {repair.reportedByName}
            </span>
          </span>
          <span className="text-[15px] text-[rgba(235,235,245,0.6)] shrink-0">
            {formatDate(repair.reportedAt)}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[#38383A]/70 space-y-3">
          {equipment?.category && (
            <p className="text-[15px] text-[rgba(235,235,245,0.6)]">
              Category · {equipment.category}
            </p>
          )}

          <div className="flex items-center gap-1.5">
            <ClockIcon className="w-[14px] h-[14px] text-[rgba(235,235,245,0.6)]" />
            <span className="text-[15px] text-[rgba(235,235,245,0.6)]">
              Reported {formatDateTime(repair.reportedAt)}
            </span>
          </div>

          {repair.reviewedByName && (
            <p className="text-[15px] text-[rgba(235,235,245,0.6)]">
              Reviewed by {repair.reviewedByName}
              {repair.reviewedAt ? ` · ${formatDate(repair.reviewedAt)}` : ""}
            </p>
          )}
          {repair.resolvedAt && (
            <p className="text-[15px] text-[rgba(235,235,245,0.6)]">
              Resolved {formatDateTime(repair.resolvedAt)}
            </p>
          )}
          {repair.responseNote && (
            <div className="bg-[#2C2C2E] rounded-[10px] px-4 py-3">
              <p className="text-[13px] text-[rgba(235,235,245,0.6)] mb-1">Admin response</p>
              <p className="text-[15px] text-white leading-snug">{repair.responseNote}</p>
            </div>
          )}

          {repair.status === "reported" && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => run("approve", onApprove)}
                disabled={actioning !== null}
                className="flex-1 py-3 rounded-[14px] text-[17px] font-semibold bg-[#0A84FF]/15 text-[#0A84FF] active:bg-[#0A84FF]/25 transition-colors disabled:opacity-40"
              >
                {actioning === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                onClick={onReject}
                disabled={actioning !== null}
                className="flex-1 py-3 rounded-[14px] text-[17px] font-semibold bg-[#FF453A]/15 text-[#FF453A] active:bg-[#FF453A]/25 transition-colors disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          )}

          {(repair.status === "approved" || repair.status === "inProgress") && (
            <button
              onClick={() => run("complete", onComplete)}
              disabled={actioning !== null}
              className="w-full py-3 rounded-[14px] text-[17px] font-semibold bg-[#30D158]/15 text-[#30D158] active:bg-[#30D158]/25 transition-colors disabled:opacity-40"
            >
              {actioning === "complete" ? "Marking Complete…" : "Mark as Completed"}
            </button>
          )}
        </div>
      )}
    </Group>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function EquipmentRepairsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [repairs, setRepairs] = useState<EquipmentRepair[]>([]);
  const [equipmentMap, setEquipmentMap] = useState<Map<string, Equipment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("open");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<EquipmentRepair | null>(null);

  useEffect(() => {
    if (user && !user.isAdmin) router.replace("/dashboard");
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

    // Open first, then newest reported
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

  const filtered = useMemo(
    () =>
      repairs.filter((r) => {
        if (activeTab === "open") return OPEN_STATUSES.has(r.status);
        if (activeTab === "resolved") return RESOLVED_STATUSES.has(r.status);
        return true;
      }),
    [repairs, activeTab]
  );

  // ── Actions ───────────────────────────────────────────────────────────────

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
        r.id === repair.id ? { ...r, status: "approved", reviewedAt: now, reviewedByName } : r
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

    // Free the equipment again once nothing else is outstanding against it
    const equip = equipmentMap.get(repair.equipmentID);
    if (equip?.status === "inRepair" && repair.equipmentID) {
      const otherOpen = repairs.filter(
        (r) =>
          r.id !== repair.id &&
          r.equipmentID === repair.equipmentID &&
          OPEN_STATUSES.has(r.status)
      );
      if (otherOpen.length === 0) {
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
      prev.map((r) => (r.id === repair.id ? { ...r, status: "completed", resolvedAt: now } : r))
    );
  }

  if (!user?.isAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-3xl">
      <NavBarRight>
        <NavCircleButton
          label={filtersOpen ? "Hide filters" : "Show filters"}
          onClick={() => setFiltersOpen((v) => !v)}
          tint={activeTab === "open" ? "white" : "blue"}
        >
          <FilterCircleIcon className="w-[22px] h-[22px]" />
        </NavCircleButton>
      </NavBarRight>

      <LargeTitle title="Equipment Repairs" />

      {filtersOpen && (
        <div className="mb-4">
          <SegmentedControl value={activeTab} onChange={setActiveTab} options={FILTER_TABS} />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-[17px] text-[rgba(235,235,245,0.6)] py-16 text-center">
          {activeTab === "open" ? "No open repairs." : "No repair records."}
        </p>
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

      {rejectTarget && (
        <RejectSheet
          repair={rejectTarget}
          onConfirm={(note) => handleReject(rejectTarget, note)}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
