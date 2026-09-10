"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Sheet, SheetActions, PrimaryButton } from "@/components/ui/Sheet";
import { PageHeader, HeaderButton, PlusIcon } from "@/components/ui/PageHeader";
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

const statusVariant: Record<string, "green" | "blue" | "yellow" | "red" | "gray"> = {
  available: "green",
  checkedOut: "blue",
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
      <PageHeader
        title="Equipment"
        subtitle={`${filtered.length} items`}
        actions={
          user?.isAdmin ? (
            <HeaderButton onClick={() => setShowAdd(true)}>
              <PlusIcon />
              Add Equipment
            </HeaderButton>
          ) : undefined
        }
      />

      {/* Status filter tabs */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 mb-3 overflow-x-auto no-scrollbar">
        <div className="inline-flex gap-1 bg-[#1C1C1E] rounded-[14px] p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.key ? "bg-[#0A84FF]/20 text-[#0A84FF]" : "text-gray-500 hover:text-white"
              }`}
            >
              {tab.label}
              {counts[tab.key] !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? "bg-[#0A84FF]/30" : "bg-white/5"}`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search name, category, or serial…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 bg-[#1C1C1E] rounded-[14px] sm:rounded-lg px-4 py-2.5 sm:py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]"
        />
      </div>

      <div className="bg-[#1C1C1E] rounded-[14px] overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-500 text-sm">No equipment found</p>
        ) : (
          <div className="divide-y divide-[#38383A]">
            {filtered.map((eq) => (
              <Link
                key={eq.id}
                href={`/equipment/${eq.id}`}
                className={`flex items-center gap-3 px-4 sm:px-6 py-3.5 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors ${
                  eq.status === "retired" ? "opacity-50" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm break-words">{eq.name}</span>
                    <Badge variant={statusVariant[eq.status] ?? "gray"}>{statusLabel[eq.status] ?? eq.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {[eq.category, eq.serialNumber && `SN ${eq.serialNumber}`].filter(Boolean).join(" · ") || "No details"}
                  </p>
                  {eq.currentHolderName && (
                    <p className="text-xs text-[#0A84FF]/80 mt-0.5 truncate">Held by {eq.currentHolderName}</p>
                  )}
                </div>
                <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

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
