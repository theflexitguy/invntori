"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import type { Vehicle } from "@/lib/types";

const CONDITION_OPTS = ["excellent", "good", "fair", "poor"] as const;
type VehicleCondition = (typeof CONDITION_OPTS)[number];

const conditionVariant: Record<string, "green" | "blue" | "yellow" | "red"> = {
  excellent: "green", good: "blue", fair: "yellow", poor: "red",
};
const conditionLabel: Record<string, string> = {
  excellent: "Excellent", good: "Good", fair: "Fair", poor: "Poor",
};

export default function FleetPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "vehicles"));
    setVehicles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, "id">) })).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }

  async function addVehicle(fields: { name: string; make: string; model: string; year: number; vin: string; licensePlate: string; color: string; condition: VehicleCondition; notes: string }) {
    if (!user?.companyID) return;
    const data: Record<string, unknown> = {
      name: fields.name.trim(), make: fields.make.trim(), model: fields.model.trim(), year: fields.year, condition: fields.condition, createdAt: Timestamp.now(),
    };
    if (fields.vin.trim()) data.vin = fields.vin.trim();
    if (fields.licensePlate.trim()) data.licensePlate = fields.licensePlate.trim();
    if (fields.color.trim()) data.color = fields.color.trim();
    if (fields.notes.trim()) data.notes = fields.notes.trim();
    const docRef = await addDoc(collection(db, "companies", user.companyID, "vehicles"), data);
    setVehicles((prev) => [...prev, { id: docRef.id, ...(data as Omit<Vehicle, "id">) }].sort((a, b) => a.name.localeCompare(b.name)));
    setShowAdd(false);
  }

  const filtered = useMemo(() => vehicles.filter((v) => {
    if (!showRetired && v.isRetired) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!v.name.toLowerCase().includes(q) && !v.make?.toLowerCase().includes(q) && !v.model?.toLowerCase().includes(q) && !v.licensePlate?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [vehicles, search, showRetired]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  return (
    <div className="p-6 xl:p-8 w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Fleet</h2>
          <p className="text-gray-400 mt-1 text-sm">{filtered.length} vehicles</p>
        </div>
        {user?.isAdmin && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Vehicle
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input type="search" placeholder="Search by name, make, model, or plate…" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] w-72" />
        <button onClick={() => setShowRetired((v) => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showRetired ? "bg-gray-500/20 border-gray-500/40 text-gray-300" : "bg-transparent border-[#2a2f3e] text-gray-500 hover:text-gray-300"}`}>
          {showRetired ? "Hiding Retired" : "Show Retired"}
        </button>
      </div>

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2f3e]">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Year / Make / Model</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">License</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Driver</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Condition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2f3e]">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No vehicles found</td></tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className={`hover:bg-white/[0.02] transition-colors ${v.isRetired ? "opacity-50" : ""}`}>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <Link href={`/fleet/${v.id}`} className="font-medium text-white hover:text-[#35B2FF] transition-colors">{v.name}</Link>
                      {v.isRetired && <Badge variant="gray">Retired</Badge>}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-gray-400">{[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-6 py-3.5 text-gray-400 font-mono text-xs">{v.licensePlate ?? "—"}</td>
                  <td className="px-6 py-3.5 text-gray-400">{v.currentDriverName ?? "Unassigned"}</td>
                  <td className="px-6 py-3.5">
                    {v.isRetired ? <Badge variant="gray">Retired</Badge> : v.condition ? <Badge variant={conditionVariant[v.condition] ?? "gray"}>{conditionLabel[v.condition] ?? v.condition}</Badge> : <span className="text-gray-600">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && <AddVehicleModal onSave={addVehicle} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddVehicleModal({ onSave, onClose }: {
  onSave: (f: { name: string; make: string; model: string; year: number; vin: string; licensePlate: string; color: string; condition: VehicleCondition; notes: string }) => Promise<void>;
  onClose: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(String(currentYear));
  const [vin, setVin] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [color, setColor] = useState("");
  const [condition, setCondition] = useState<VehicleCondition>("good");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

  async function handleSave() {
    const yearNum = parseInt(year);
    if (!yearNum || yearNum < 1900 || yearNum > currentYear + 1) { setError("Enter a valid year."); return; }
    setSaving(true);
    try { await onSave({ name, make, model, year: yearNum, vin, licensePlate, color, condition, notes }); }
    catch { setError("Failed to save."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">Add Vehicle</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3">
          {[["Name / Nickname", name, setName, true], ["Make", make, setMake, true], ["Model", model, setModel, true]].map(([label, val, setter, req]) => (
            <div key={label as string}><label className="block text-xs text-gray-500 mb-1">{label as string}{req ? " *" : ""}</label><input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className={inputCls} /></div>
          ))}
          <div><label className="block text-xs text-gray-500 mb-1">Year *</label><input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} /></div>
          {[["VIN", vin, setVin], ["License Plate", licensePlate, setLicensePlate], ["Color", color, setColor]].map(([label, val, setter]) => (
            <div key={label as string}><label className="block text-xs text-gray-500 mb-1">{label as string}</label><input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className={inputCls} placeholder="Optional" /></div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Condition</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value as VehicleCondition)} className={`${inputCls} appearance-none`}>
              {CONDITION_OPTS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none h-16`} placeholder="Optional" /></div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5 pt-4 border-t border-[#2a2f3e]">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || !make.trim() || !model.trim() || !year.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Add Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}
