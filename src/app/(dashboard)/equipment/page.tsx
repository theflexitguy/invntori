"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Sheet, SheetActions, PrimaryButton } from "@/components/ui/Sheet";
import { PlusIcon } from "@/components/ui/PageHeader";
import { LargeTitle, SearchField, Group, Pill, NavCircleButton, type Tint } from "@/components/ui/ios";
import { NavBarLeft, NavBarRight } from "@/components/layout/NavBarSlot";
import { FilterCircleIcon, ChevronRightIcon, equipmentGlyph } from "@/components/layout/nav";
import Link from "next/link";
import type { Equipment } from "@/lib/types";

type StatusFilter = "All" | "available" | "checkedOut" | "inRepair" | "retired";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "All", label: "All" },
  { key: "available", label: "Available" },
  { key: "checkedOut", label: "Checked Out" },
  { key: "inRepair", label: "In Repair" },
  { key: "retired", label: "Retired" },
];

const statusTint: Record<string, Tint> = {
  available: "green",
  checkedOut: "orange",
  inRepair: "yellow",
  retired: "gray",
};

const statusLabel: Record<string, string> = {
  available: "Available",
  checkedOut: "Checked Out",
  inRepair: "In Repair",
  retired: "Retired",
};

export default function EquipmentPage() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "equipment"));
    let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Equipment, "id">) }));

    // Non-admins only see their own checked-out equipment
    if (!user.isAdmin) {
      items = items.filter((e) => e.currentHolderUID === user.uid);
    }

    setEquipment(items.sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }

  async function addEquipment(name: string, category: string, serialNumber: string, notes: string) {
    if (!user?.companyID) return;
    const data: Record<string, unknown> = { name: name.trim(), category: category.trim(), status: "available", createdAt: Timestamp.now() };
    if (serialNumber.trim()) data.serialNumber = serialNumber.trim();
    if (notes.trim()) data.notes = notes.trim();
    const docRef = await addDoc(collection(db, "companies", user.companyID, "equipment"), data);
    setEquipment((prev) => [...prev, { id: docRef.id, ...(data as Omit<Equipment, "id">) }].sort((a, b) => a.name.localeCompare(b.name)));
    setShowAdd(false);
  }

  const filtered = useMemo(() => {
    return equipment.filter((e) => {
      if (statusFilter !== "All" && e.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) &&
            !e.category?.toLowerCase().includes(q) &&
            !e.serialNumber?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [equipment, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: equipment.length };
    equipment.forEach((e) => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [equipment]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      {/* Nav bar controls, the way the native Equipment tab carries them */}
      <NavBarLeft>
        <NavCircleButton
          label={filtersOpen ? "Hide filters" : "Show filters"}
          onClick={() => setFiltersOpen((v) => !v)}
          tint={statusFilter === "All" ? "white" : "blue"}
        >
          <FilterCircleIcon className="w-[22px] h-[22px]" />
        </NavCircleButton>
      </NavBarLeft>
      {user?.isAdmin && (
        <NavBarRight>
          <NavCircleButton label="Add equipment" onClick={() => setShowAdd(true)}>
            <PlusIcon className="w-[17px] h-[17px]" />
          </NavCircleButton>
        </NavBarRight>
      )}

      <LargeTitle title="Equipment" />

      <div className="mb-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search by name or category"
          shape="pill"
        />
      </div>

      {/* Status filter — collapsed behind the nav bar's filter button */}
      {filtersOpen && (
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 mb-3 overflow-x-auto no-scrollbar">
          <div className="inline-flex gap-1 bg-[#1C1C1E] rounded-[12px] p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
                  statusFilter === tab.key
                    ? "bg-[#0A84FF]/20 text-[#0A84FF]"
                    : "text-[rgba(235,235,245,0.6)]"
                }`}
              >
                {tab.label}
                {counts[tab.key] !== undefined && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                    statusFilter === tab.key ? "bg-[#0A84FF]/25" : "bg-white/10"
                  }`}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-[#1C1C1E] rounded-[14px] px-6 py-12 text-center text-[15px] text-[rgba(235,235,245,0.6)]">
          No equipment found
        </div>
      ) : (
        <Group>
          {filtered.map((eq, i) => {
            const Glyph = equipmentGlyph(eq.category);
            const checkedOut = eq.status === "checkedOut";
            return (
              <Link
                key={eq.id}
                href={`/equipment/${eq.id}`}
                className={`w-full flex items-stretch pl-4 active:bg-white/[0.06] transition-colors ${
                  eq.status === "retired" ? "opacity-50" : ""
                }`}
              >
                <span className="flex items-center pr-3 shrink-0">
                  <Glyph className="w-[24px] h-[24px] text-[#0A84FF]" />
                </span>
                <span
                  className={`flex-1 min-w-0 flex items-center gap-3 pr-3.5 py-3 ${
                    i === filtered.length - 1 ? "" : "border-b border-[#38383A]/70"
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[17px] font-semibold text-white leading-snug break-words">
                      {eq.name}
                    </span>
                    <span className="block text-[15px] text-[rgba(235,235,245,0.6)] leading-snug">
                      {eq.category ?? "Uncategorized"}
                    </span>
                    {checkedOut && eq.currentHolderName && (
                      <span className="block text-[15px] text-[#FF9F0A] leading-snug">
                        With {eq.currentHolderName}
                      </span>
                    )}
                  </span>
                  <Pill tint={statusTint[eq.status] ?? "gray"}>
                    {statusLabel[eq.status] ?? eq.status}
                  </Pill>
                  <ChevronRightIcon className="w-[14px] h-[14px] text-[rgba(235,235,245,0.3)] shrink-0" />
                </span>
              </Link>
            );
          })}
        </Group>
      )}

      {showAdd && <AddEquipmentModal onSave={addEquipment} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddEquipmentModal({ onSave, onClose }: { onSave: (name: string, category: string, serial: string, notes: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [serial, setSerial] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const inputCls = "w-full bg-[#2C2C2E] border border-[#2C2C2E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]";

  async function handleSave() {
    setSaving(true);
    try { await onSave(name, category, serial, notes); }
    finally { setSaving(false); }
  }

  return (
    <Sheet
      title="Add Equipment"
      onClose={onClose}
      footer={
        <SheetActions onCancel={onClose}>
          <PrimaryButton onClick={handleSave} disabled={!name.trim() || !category.trim() || saving}>
            {saving ? "Saving…" : "Add Equipment"}
          </PrimaryButton>
        </SheetActions>
      }
    >
      <div className="space-y-3">
        <div><label className="block text-xs text-gray-500 mb-1">Name *</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Backpack Sprayer" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Category *</label><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="e.g. Sprayer, Tool, Ladder" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Serial Number</label><input value={serial} onChange={(e) => setSerial(e.target.value)} className={inputCls} placeholder="Optional" /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none h-20`} placeholder="Optional" /></div>
      </div>
    </Sheet>
  );
}
