"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import type { Office } from "@/lib/types";

const COLOR_OPTIONS = [
  "#35B2FF", "#34D399", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#F97316", "#06B6D4",
];

export default function OfficesPage() {
  const { user } = useAuth();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Office | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Office | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [colorHex, setColorHex] = useState(COLOR_OPTIONS[0]);
  const [fieldroutesID, setFieldroutesID] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "offices"));
    setOffices(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Office, "id">) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setLoading(false);
  }

  function openAdd() {
    setName("");
    setAddress("");
    setColorHex(COLOR_OPTIONS[0]);
    setFieldroutesID("");
    setFormError("");
    setEditItem(null);
    setShowForm(true);
  }

  function openEdit(office: Office) {
    setName(office.name);
    setAddress(office.address ?? "");
    setColorHex(office.colorHex ?? COLOR_OPTIONS[0]);
    setFieldroutesID(office.fieldroutesOfficeID != null ? String(office.fieldroutesOfficeID) : "");
    setFormError("");
    setEditItem(office);
    setShowForm(true);
  }

  async function handleSave() {
    if (!user?.companyID || !name.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const data: Record<string, unknown> = { name: name.trim() };
      if (address.trim()) data.address = address.trim();
      if (colorHex) data.colorHex = colorHex;
      const frID = parseInt(fieldroutesID);
      if (!isNaN(frID) && frID > 0) data.fieldroutesOfficeID = frID;

      if (editItem?.id) {
        await updateDoc(doc(db, "companies", user.companyID, "offices", editItem.id), data);
        setOffices((prev) => prev.map((o) => o.id === editItem.id ? { ...o, ...data } as Office : o).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const docRef = await addDoc(collection(db, "companies", user.companyID, "offices"), data);
        setOffices((prev) => [...prev, { id: docRef.id, ...data } as Office].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowForm(false);
      setEditItem(null);
    } catch {
      setFormError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(office: Office) {
    if (!user?.companyID || !office.id) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "companies", user.companyID, "offices", office.id));
      setOffices((prev) => prev.filter((o) => o.id !== office.id));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  return (
    <div className="p-4 sm:p-6 xl:p-8 w-full max-w-2xl pb-8">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm">Admin</Link>
        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-sm text-white">Offices</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6 mt-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Offices</h2>
          <p className="text-gray-400 mt-1 text-sm">{offices.length} offices</p>
        </div>
        {user?.isAdmin && (
          <button onClick={openAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Office
          </button>
        )}
      </div>

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        {offices.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">No offices yet. Add one to get started.</p>
        ) : (
          <div className="divide-y divide-[#2a2f3e]">
            {offices.map((office) => (
              <div key={office.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: office.colorHex ?? "#35B2FF" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{office.name}</p>
                  {office.address && <p className="text-xs text-gray-500 mt-0.5">{office.address}</p>}
                  {office.fieldroutesOfficeID != null && (
                    <p className="text-xs text-gray-600 mt-0.5">FieldRoutes ID: {office.fieldroutesOfficeID}</p>
                  )}
                </div>
                {user?.isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(office)} className="px-3 py-2 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors">Edit</button>
                    <button onClick={() => setConfirmDelete(office)} className="px-3 py-2 text-xs rounded-lg text-red-400 hover:bg-red-400/10 active:bg-red-400/20 transition-colors">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade" onClick={() => setShowForm(false)}>
          <div className="animate-sheet bg-[#1a1f2e] border border-[#2a2f3e] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+var(--safe-bottom))] sm:pb-6 w-full sm:max-w-md sm:m-4 max-h-[92dvh] overflow-y-auto scroll-touch" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">{editItem ? "Edit Office" : "Add Office"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Office Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Main Office" autoFocus />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Address</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="e.g. 123 Main St, City, State" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColorHex(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${colorHex === c ? "scale-110 ring-2 ring-white/40 ring-offset-1 ring-offset-[#1a1f2e]" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">FieldRoutes Office ID</label>
                <input type="number" value={fieldroutesID} onChange={(e) => setFieldroutesID(e.target.value)} className={inputCls} placeholder="Optional" />
              </div>
              {formError && <p className="text-red-400 text-xs">{formError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
                {saving ? "Saving…" : editItem ? "Save Changes" : "Add Office"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade" onClick={() => setConfirmDelete(null)}>
          <div className="animate-sheet bg-[#1a1f2e] border border-[#2a2f3e] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+var(--safe-bottom))] sm:pb-6 w-full sm:max-w-sm sm:m-4 max-h-[92dvh] overflow-y-auto scroll-touch" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-white mb-2">Delete &quot;{confirmDelete.name}&quot;?</h4>
            <p className="text-sm text-gray-400 mb-5">This office will be removed. Warehouses and employees linked to this office will not be affected.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
