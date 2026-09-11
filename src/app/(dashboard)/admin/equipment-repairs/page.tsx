"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { collection, getDocs, updateDoc, doc, writeBatch, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { useRouter } from "next/navigation";
import { NavBarRight } from "@/components/layout/NavBarSlot";
import {
  LargeTitle,
  Group,
  Pill,
  SegmentedControl,
  NavCircleButton,
  ActionRow,
  type Tint,
} from "@/components/ui/ios";
import { RepairRequestSheet, type RepairDecision } from "./RepairRequestSheet";
import { FilterCircleIcon, PersonIcon, ClockIcon, DocIcon } from "@/components/layout/nav";
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
  rejected: "Denied",
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

// ── Repair card ─────────────────────────────────────────────────────────────

function RepairCard({
  repair,
  equipment,
  onReview,
  onComplete,
}: {
  repair: EquipmentRepair;
  equipment: Equipment | undefined;
  onReview: () => void;
  onComplete: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actioning, setActioning] = useState(false);
  const needsReview = repair.status === "reported";

  async function complete() {
    setActioning(true);
    try {
      await onComplete();
    } finally {
      setActioning(false);
    }
  }

  return (
    <Group className={`p-4 ${RESOLVED_STATUSES.has(repair.status) ? "opacity-70" : ""}`}>
      <button
        onClick={() => (needsReview ? onReview() : setExpanded((v) => !v))}
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

      {needsReview && (
        <div className="-mx-4 mt-3 border-t border-[#38383A]/70">
          <ActionRow Icon={DocIcon} label="Review Request" onClick={onReview} last />
        </div>
      )}

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
          {repair.replacementEquipmentName && (
            <p className="text-[15px] text-[rgba(235,235,245,0.6)]">
              Replacement issued · {repair.replacementEquipmentName}
            </p>
          )}
          {repair.responseNote && (
            <div className="bg-[#2C2C2E] rounded-[10px] px-4 py-3">
              <p className="text-[13px] text-[rgba(235,235,245,0.6)] mb-1">Admin response</p>
              <p className="text-[15px] text-white leading-snug">{repair.responseNote}</p>
            </div>
          )}

          {(repair.status === "approved" || repair.status === "inProgress") && (
            <button
              onClick={complete}
              disabled={actioning}
              className="w-full py-3 rounded-[14px] text-[17px] font-semibold bg-[#30D158]/15 text-[#30D158] active:bg-[#30D158]/25 transition-colors disabled:opacity-40"
            >
              {actioning ? "Marking Complete…" : "Mark as Completed"}
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
  const [reviewTarget, setReviewTarget] = useState<EquipmentRepair | null>(null);

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

  const availableEquipment = useMemo(
    () => [...equipmentMap.values()].filter((e) => e.status === "available"),
    [equipmentMap]
  );

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

  /**
   * One write for the whole review: the repair's outcome, the equipment's new
   * state and — when a substitute is handed over — its checkout to the person
   * who reported the fault.
   */
  async function handleDecision(repair: EquipmentRepair, decision: RepairDecision) {
    if (!user?.companyID || !repair.id) return;
    const cid = user.companyID;
    const now = Timestamp.now();
    const reviewedByName = user.displayName ?? user.email ?? "Admin";
    const { approve, note, replacement } = decision;
    const status = approve ? "approved" : "rejected";

    const batch = writeBatch(db);

    batch.update(doc(db, "companies", cid, "equipmentRepairs", repair.id), {
      status,
      reviewedAt: now,
      reviewedByName,
      ...(note ? { responseNote: note } : {}),
      ...(replacement
        ? { replacementEquipmentID: replacement.id, replacementEquipmentName: replacement.name }
        : {}),
    });

    const equip = equipmentMap.get(repair.equipmentID);
    const equipmentPatch = new Map<string, Partial<Equipment>>();

    if (approve) {
      if (repair.equipmentID && equip && equip.status !== "inRepair") {
        batch.update(doc(db, "companies", cid, "equipment", repair.equipmentID), {
          status: "inRepair",
        });
        equipmentPatch.set(repair.equipmentID, { status: "inRepair" });
      }

      if (replacement?.id) {
        batch.update(doc(db, "companies", cid, "equipment", replacement.id), {
          status: "checkedOut",
          currentHolderUID: repair.reportedByUID,
          currentHolderName: repair.reportedByName,
          currentCheckedOutAt: now,
        });
        equipmentPatch.set(replacement.id, {
          status: "checkedOut",
          currentHolderUID: repair.reportedByUID,
          currentHolderName: repair.reportedByName,
          currentCheckedOutAt: now,
        });
        batch.set(doc(collection(db, "companies", cid, "equipmentCheckouts")), {
          equipmentID: replacement.id,
          equipmentName: replacement.name,
          employeeUID: repair.reportedByUID,
          employeeName: repair.reportedByName,
          checkedOutAt: now,
          notes: `Replacement for ${repair.equipmentName}`,
        });
      }
    } else if (equip?.status === "inRepair" && repair.equipmentID) {
      // Nothing else outstanding against it, so put it back in service
      const otherOpen = repairs.filter(
        (r) =>
          r.id !== repair.id &&
          r.equipmentID === repair.equipmentID &&
          OPEN_STATUSES.has(r.status)
      );
      if (otherOpen.length === 0) {
        batch.update(doc(db, "companies", cid, "equipment", repair.equipmentID), {
          status: "available",
        });
        equipmentPatch.set(repair.equipmentID, { status: "available" });
      }
    }

    await batch.commit();

    if (equipmentPatch.size > 0) {
      setEquipmentMap((prev) => {
        const next = new Map(prev);
        equipmentPatch.forEach((patch, id) => {
          const e = next.get(id);
          if (e) next.set(id, { ...e, ...patch });
        });
        return next;
      });
    }

    setRepairs((prev) =>
      prev.map((r) =>
        r.id === repair.id
          ? {
              ...r,
              status,
              reviewedAt: now,
              reviewedByName,
              ...(note ? { responseNote: note } : {}),
            }
          : r
      )
    );
    setReviewTarget(null);
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
              onReview={() => setReviewTarget(repair)}
              onComplete={() => handleComplete(repair)}
            />
          ))}
        </div>
      )}

      {reviewTarget && (
        <RepairRequestSheet
          repair={reviewTarget}
          equipment={equipmentMap.get(reviewTarget.equipmentID)}
          availableEquipment={availableEquipment}
          formatDateTime={formatDateTime}
          onDecide={(d) => handleDecision(reviewTarget, d)}
          onClose={() => setReviewTarget(null)}
        />
      )}
    </div>
  );
}
