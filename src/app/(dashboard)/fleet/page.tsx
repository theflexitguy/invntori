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
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      <PageHeader
        title="Fleet"
        subtitle={`${filtered.length} vehicles`}
        actions={
          user?.isAdmin ? (
            <HeaderButton onClick={() => setShowAdd(true)}>
              <PlusIcon />
              Add Vehicle
            </HeaderButton>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mb-4 sm:items-center">
        <input type="search" placeholder="Search name, make, model, or plate…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-72 bg-[#1C1C1E] rounded-[14px] sm:rounded-lg px-4 py-2.5 sm:py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]" />
        <button onClick={() => setShowRetired((v) => !v)} className={`self-start shrink-0 whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${showRetired ? "bg-gray-500/20 border-gray-500/40 text-gray-300" : "bg-transparent border-[#2C2C2E] text-gray-500 hover:text-gray-300"}`}>
          {showRetired ? "Hiding Retired" : "Show Retired"}
        </button>
      </div>

      <div className="bg-[#1C1C1E] rounded-[14px] overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-500 text-sm">No vehicles found</p>
        ) : (
          <div className="divide-y divide-[#38383A]">
            {filtered.map((v) => (
              <Link
                key={v.id}
                href={`/fleet/${v.id}`}
                className={`flex items-center gap-3 px-4 sm:px-6 py-3.5 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors ${v.isRetired ? "opacity-50" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm break-words">{v.name}</span>
                    {v.isRetired ? (
                      <Badge variant="gray">Retired</Badge>
                    ) : v.condition ? (
                      <Badge variant={conditionVariant[v.condition] ?? "gray"}>{conditionLabel[v.condition] ?? v.condition}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {[[v.year, v.make, v.model].filter(Boolean).join(" "), v.licensePlate].filter(Boolean).join(" · ") || "No details"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {v.currentDriverName ? (
                      <span className="text-[#0A84FF]/80">Driver: {v.currentDriverName}</span>
                    ) : (
                      "Unassigned"
                    )}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
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

  const inputCls = "w-full bg-[#2C2C2E] border border-[#2C2C2E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]";

  async function handleSave() {
    const yearNum = parseInt(year);
    if (!yearNum || yearNum < 1900 || yearNum > currentYear + 1) { setError("Enter a valid year."); return; }
    setSaving(true);
    try { await onSave({ name, make, model, year: yearNum, vin, licensePlate, color, condition, notes }); }
    catch { setError("Failed to save."); }
    finally { setSaving(false); }
  }

  return (
    <Sheet
      title="Add Vehicle"
      onClose={onClose}
      footer={
        <SheetActions onCancel={onClose}>
          <PrimaryButton onClick={handleSave} disabled={!name.trim() || !make.trim() || !model.trim() || !year.trim() || saving}>
            {saving ? "Saving…" : "Add Vehicle"}
          </PrimaryButton>
        </SheetActions>
      }
    >
      <div className="space-y-3">
          {[["Name / Nickname", name, setName, true], ["Make", make, setMake, true], ["Model", model, setModel, true]].map(([label, val, setter, req]) => (
            <div key={label as string}><label className="block text-xs text-gray-500 mb-1">{label as string}{req ? " *" : ""}</label><input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className={inputCls} /></div>
          ))}
          <div><label className="block text-xs text-gray-500 mb-1">Year *</label><input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} /></div>
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
    </Sheet>
  );
}
