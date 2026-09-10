"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
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
    <div className="p-6 xl:p-8 w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Equipment</h2>
          <p className="text-gray-400 mt-1 text-sm">{filtered.length} items</p>
        </div>
        {user?.isAdmin && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Equipment
          </button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg p-1 w-fit flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              statusFilter === tab.key ? "bg-[#35B2FF]/20 text-[#35B2FF]" : "text-gray-500 hover:text-white"
            }`}
          >
            {tab.label}
            {counts[tab.key] !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === tab.key ? "bg-[#35B2FF]/30" : "bg-white/5"}`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <input
          type="search"
          placeholder="Search by name, category, or serial…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] w-72"
        />
      </div>

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2f3e]">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Serial #</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Holder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2f3e]">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No equipment found</td></tr>
            ) : (
              filtered.map((eq) => (
                <tr key={eq.id} className={`hover:bg-white/[0.02] transition-colors ${eq.status === "retired" ? "opacity-50" : ""}`}>
                  <td className="px-6 py-3.5">
                    <Link href={`/equipment/${eq.id}`} className="font-medium text-white hover:text-[#35B2FF] transition-colors">
                      {eq.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-gray-400">{eq.category ?? "—"}</td>
                  <td className="px-6 py-3.5 text-gray-400 font-mono text-xs">{eq.serialNumber ?? "—"}</td>
                  <td className="px-6 py-3.5">
                    <Badge variant={statusVariant[eq.status] ?? "gray"}>{statusLabel[eq.status] ?? eq.status}</Badge>
                  </td>
                  <td className="px-6 py-3.5 text-gray-400">{eq.currentHolderName ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

  const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

  async function handleSave() {
    setSaving(true);
    try { await onSave(name, category, serial, notes); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">Add Equipment</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-3 mb-5">
          <div><label className="block text-xs text-gray-500 mb-1">Name *</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Backpack Sprayer" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Category *</label><input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="e.g. Sprayer, Tool, Ladder" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Serial Number</label><input value={serial} onChange={(e) => setSerial(e.target.value)} className={inputCls} placeholder="Optional" /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none h-16`} placeholder="Optional" /></div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || !category.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Add Equipment"}
          </button>
        </div>
      </div>
    </div>
  );
}
