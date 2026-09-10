"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import type { UnitType } from "@/lib/types";

export default function UnitTypesPage() {
  const { user } = useAuth();
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<UnitType | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UnitType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formValue, setFormValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "unittypes"));
    setUnitTypes(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<UnitType, "id">) }))
        .sort((a, b) => a.unitname.localeCompare(b.unitname))
    );
    setLoading(false);
  }

  function openAdd() {
    setFormValue("");
    setFormError("");
    setEditItem(null);
    setShowAdd(true);
  }

  function openEdit(ut: UnitType) {
    setFormValue(ut.unitname);
    setFormError("");
    setEditItem(ut);
    setShowAdd(true);
  }

  async function handleSave() {
    if (!user?.companyID || !formValue.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      if (editItem?.id) {
        await updateDoc(doc(db, "companies", user.companyID, "unittypes", editItem.id), { unitname: formValue.trim() });
        setUnitTypes((prev) => prev.map((u) => u.id === editItem.id ? { ...u, unitname: formValue.trim() } : u).sort((a, b) => a.unitname.localeCompare(b.unitname)));
      } else {
        const docRef = await addDoc(collection(db, "companies", user.companyID, "unittypes"), { unitname: formValue.trim() });
        setUnitTypes((prev) => [...prev, { id: docRef.id, unitname: formValue.trim() }].sort((a, b) => a.unitname.localeCompare(b.unitname)));
      }
      setShowAdd(false);
      setEditItem(null);
    } catch {
      setFormError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ut: UnitType) {
    if (!user?.companyID || !ut.id) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "companies", user.companyID, "unittypes", ut.id));
      setUnitTypes((prev) => prev.filter((u) => u.id !== ut.id));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const inputCls = "w-full bg-[#2C2C2E] border border-[#2C2C2E] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]";

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm">Admin</Link>
        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-sm text-white">Unit Types</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6 mt-4">
        <div>
          <h1 className="ios-large-title text-white">Unit Types</h1>
          <p className="text-[rgba(235,235,245,0.6)] mt-1 text-[15px]">{unitTypes.length} units</p>
        </div>
        {user?.isAdmin && (
          <button onClick={openAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Unit Type
          </button>
        )}
      </div>

      <div className="bg-[#1C1C1E] rounded-[14px] overflow-hidden">
        {unitTypes.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">No unit types yet. Add one to get started.</p>
        ) : (
          <div className="divide-y divide-[#38383A]">
            {unitTypes.map((ut) => (
              <div key={ut.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                <p className="text-sm font-medium text-white">{ut.unitname}</p>
                {user?.isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(ut)} className="px-3 py-2 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors">Edit</button>
                    <button onClick={() => setConfirmDelete(ut)} className="px-3 py-2 text-xs rounded-lg text-red-400 hover:bg-red-400/10 active:bg-red-400/20 transition-colors">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade" onClick={() => setShowAdd(false)}>
          <div className="animate-sheet bg-[#1C1C1E] border border-[#2C2C2E] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+var(--safe-bottom))] sm:pb-6 w-full sm:max-w-sm sm:m-4 max-h-[92dvh] overflow-y-auto scroll-touch" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">{editItem ? "Edit Unit Type" : "Add Unit Type"}</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mb-5">
              <label className="block text-xs text-gray-500 mb-1">Unit Name *</label>
              <input
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className={inputCls}
                placeholder="e.g. oz, gallon, bag"
                autoFocus
              />
              {formError && <p className="text-red-400 text-xs mt-1">{formError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm border border-[#2C2C2E] text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!formValue.trim() || saving} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors disabled:opacity-50">
                {saving ? "Saving…" : editItem ? "Save Changes" : "Add Unit Type"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade" onClick={() => setConfirmDelete(null)}>
          <div className="animate-sheet bg-[#1C1C1E] border border-[#2C2C2E] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+var(--safe-bottom))] sm:pb-6 w-full sm:max-w-sm sm:m-4 max-h-[92dvh] overflow-y-auto scroll-touch" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-white mb-2">Delete &quot;{confirmDelete.unitname}&quot;?</h4>
            <p className="text-sm text-gray-400 mb-5">This unit type will be removed. Existing inventory items using this unit will not be affected.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm border border-[#2C2C2E] text-gray-400 hover:text-white transition-colors">Cancel</button>
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
