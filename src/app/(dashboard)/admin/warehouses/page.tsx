"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import type { Warehouse } from "@/lib/types";

export default function WarehousesPage() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Warehouse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "warehouses"));
    setWarehouses(
      snap.docs
        .map((d) => ({ id: d.id, name: d.data().name, location: d.data().location ?? "" }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setLoading(false);
  }

  function openAdd() {
    setName("");
    setLocation("");
    setFormError("");
    setEditItem(null);
    setShowForm(true);
  }

  function openEdit(wh: Warehouse) {
    setName(wh.name);
    setLocation(wh.location ?? "");
    setFormError("");
    setEditItem(wh);
    setShowForm(true);
  }

  async function handleSave() {
    if (!user?.companyID || !name.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const whName = name.trim();
      const whLocation = location.trim() || undefined;
      if (editItem?.id) {
        await updateDoc(doc(db, "companies", user.companyID, "warehouses", editItem.id), { name: whName, location: whLocation });
        setWarehouses((prev) => prev.map((w) => w.id === editItem.id ? { ...w, name: whName, location: whLocation } : w).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const docRef = await addDoc(collection(db, "companies", user.companyID, "warehouses"), { name: whName, location: whLocation });
        setWarehouses((prev) => [...prev, { id: docRef.id, name: whName, location: whLocation }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowForm(false);
      setEditItem(null);
    } catch {
      setFormError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-[#2C2C2E] border border-[#2C2C2E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]";

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm">Admin</Link>
        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-sm text-white">Warehouses</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6 mt-4">
        <div>
          <h1 className="ios-large-title text-white">Warehouses</h1>
          <p className="text-[rgba(235,235,245,0.6)] mt-1 text-[15px]">{warehouses.length} warehouses</p>
        </div>
        {user?.isAdmin && (
          <button onClick={openAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Warehouse
          </button>
        )}
      </div>

      <div className="bg-[#1C1C1E] rounded-[14px] overflow-hidden">
        {warehouses.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">No warehouses yet. Add one to get started.</p>
        ) : (
          <div className="divide-y divide-[#38383A]">
            {warehouses.map((wh) => (
              <div key={wh.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-white">{wh.name}</p>
                  {wh.location && <p className="text-xs text-gray-500 mt-0.5">{wh.location}</p>}
                </div>
                {user?.isAdmin && (
                  <button onClick={() => openEdit(wh)} className="px-3 py-2 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors">Edit</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade" onClick={() => setShowForm(false)}>
          <div className="animate-sheet bg-[#1C1C1E] border border-[#2C2C2E] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+var(--safe-bottom))] sm:pb-6 w-full sm:max-w-sm sm:m-4 max-h-[92dvh] overflow-y-auto scroll-touch" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">{editItem ? "Edit Warehouse" : "Add Warehouse"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Main Warehouse" autoFocus />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="e.g. 123 Main St" />
              </div>
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm border border-[#2C2C2E] text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors disabled:opacity-50">
                {saving ? "Saving…" : editItem ? "Save Changes" : "Add Warehouse"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
