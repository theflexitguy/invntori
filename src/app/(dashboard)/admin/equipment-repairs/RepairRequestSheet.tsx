"use client";

import { useMemo, useState } from "react";
import { DetailSheet } from "@/components/ui/FormSheet";
import {
  CaptionHeader,
  SectionHeader,
  Group,
  DetailRow,
  StackedRow,
  ActionRow,
  Switch,
  SearchField,
} from "@/components/ui/ios";
import { CheckCircleOutlineIcon, XCircleIcon, CheckCircleIcon } from "@/components/layout/nav";
import type { Equipment, EquipmentRepair } from "@/lib/types";

export interface RepairDecision {
  approve: boolean;
  note: string;
  replacement: Equipment | null;
}

/**
 * The native Repair Request review sheet: the request as submitted, a note
 * back to the reporter, an optional replacement drawn from the same category,
 * and the approve / deny decision.
 */
export function RepairRequestSheet({
  repair,
  equipment,
  availableEquipment,
  formatDateTime,
  onDecide,
  onClose,
}: {
  repair: EquipmentRepair;
  equipment?: Equipment;
  /** Equipment that is free to hand over right now. */
  availableEquipment: Equipment[];
  formatDateTime: (v: EquipmentRepair["reportedAt"]) => string;
  onDecide: (d: RepairDecision) => Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [assignReplacement, setAssignReplacement] = useState(false);
  const [replacementID, setReplacementID] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [working, setWorking] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState("");

  const category = equipment?.category ?? "";

  // The native sheet only ever offers same-category replacements
  const candidates = useMemo(() => {
    const sameCategory = availableEquipment.filter(
      (e) => e.id !== repair.equipmentID && (e.category ?? "") === category
    );
    const q = search.trim().toLowerCase();
    if (!q) return sameCategory;
    return sameCategory.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.serialNumber?.toLowerCase().includes(q) ?? false)
    );
  }, [availableEquipment, repair.equipmentID, category, search]);

  const replacement = candidates.find((e) => e.id === replacementID) ?? null;

  async function decide(approve: boolean) {
    if (!approve && !note.trim()) {
      setError("A note is required when denying a repair request.");
      return;
    }
    setError("");
    setWorking(approve ? "approve" : "deny");
    try {
      await onDecide({
        approve,
        note: note.trim(),
        replacement: approve && assignReplacement ? replacement : null,
      });
    } catch {
      setError("Failed to save the decision. Please try again.");
      setWorking(null);
    }
  }

  return (
    <DetailSheet title="Repair Request" onClose={onClose}>
      <Group tone="elevated" className="mb-6">
        <DetailRow label="Equipment" value={repair.equipmentName} />
        <DetailRow label="Category" value={category || "Uncategorized"} />
        <DetailRow label="Submitted By" value={repair.reportedByName} />
        <DetailRow label="Submitted" value={formatDateTime(repair.reportedAt)} nowrap />
        <StackedRow label="Problem" value={repair.description} last />
      </Group>

      <SectionHeader tone="secondary">Response</SectionHeader>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setError("");
        }}
        placeholder={`Note to ${repair.reportedByName}`}
        rows={4}
        className="w-full bg-[#2C2C2E] rounded-[12px] px-4 py-3 text-[17px] text-white placeholder-[rgba(235,235,245,0.3)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF] resize-none mb-6"
      />

      <SectionHeader tone="secondary">Replacement</SectionHeader>
      <Group tone="elevated" className="mb-6">
        <div className="pl-4">
          <div className="flex items-center gap-3 pr-4 py-3.5 border-b border-[#38383A]/70">
            <span className="flex-1 min-w-0 text-[17px] text-white">Assign Replacement</span>
            <Switch
              checked={assignReplacement}
              onChange={(v) => {
                setAssignReplacement(v);
                if (!v) setReplacementID(null);
              }}
              label="Assign replacement"
            />
          </div>
        </div>

        {!assignReplacement ? (
          <p className="px-4 py-3.5 text-[17px] text-[rgba(235,235,245,0.6)]">
            {repair.reportedByName} keeps working without a substitute.
          </p>
        ) : candidates.length === 0 && !search ? (
          <p className="px-4 py-3.5 text-[17px] text-[rgba(235,235,245,0.6)]">
            No available equipment in this category.
          </p>
        ) : (
          <div className="px-4 py-3">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search replacements"
              shape="pill"
              tone="elevated"
            />
            <div className="mt-3 max-h-[38vh] overflow-y-auto scroll-touch">
              {candidates.length === 0 ? (
                <p className="py-2 text-[17px] text-[rgba(235,235,245,0.6)]">
                  Nothing matches “{search}”.
                </p>
              ) : (
                candidates.map((e, i) => (
                  <button
                    key={e.id}
                    onClick={() => setReplacementID(e.id === replacementID ? null : e.id!)}
                    className={`w-full flex items-center gap-3 py-3 text-left ${
                      i === candidates.length - 1 ? "" : "border-b border-[#38383A]/70"
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[17px] text-white break-words">{e.name}</span>
                      {e.serialNumber && (
                        <span className="block text-[15px] text-[rgba(235,235,245,0.6)]">
                          {e.serialNumber}
                        </span>
                      )}
                    </span>
                    {e.id === replacementID && (
                      <CheckCircleIcon className="w-[22px] h-[22px] text-[#0A84FF] shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </Group>

      <SectionHeader tone="secondary">Decision</SectionHeader>
      <Group tone="elevated">
        <ActionRow
          Icon={CheckCircleOutlineIcon}
          iconTint="green"
          labelTint="green"
          label={working === "approve" ? "Approving…" : "Approve Request"}
          onClick={() => decide(true)}
          disabled={working !== null}
        />
        <ActionRow
          Icon={XCircleIcon}
          iconTint="blue"
          labelTint="white"
          label={working === "deny" ? "Denying…" : "Deny Request"}
          onClick={() => decide(false)}
          disabled={working !== null}
          last
        />
      </Group>

      {error ? (
        <p className="text-[15px] text-[#FF453A] mt-3 px-1">{error}</p>
      ) : (
        <div className="mt-3">
          <CaptionHeader uppercase={false}>
            A note is required when denying a repair request.
          </CaptionHeader>
        </div>
      )}
    </DetailSheet>
  );
}
