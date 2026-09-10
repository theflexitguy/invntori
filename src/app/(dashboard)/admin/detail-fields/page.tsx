"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import type { DetailField } from "@/lib/types";

export default function DetailFieldsPage() {
  const { user } = useAuth();
  const [fields, setFields] = useState<DetailField[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<DetailField | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DetailField | null>(null);
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
    const snap = await getDocs(collection(db, "companies", user.companyID, "detailFields"));
    setFields(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<DetailField, "id">) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setLoading(false);
  }

  function openAdd() {
    setFormValue("");
    setFormError("");
    setEditItem(null);
    setShowAdd(true);
  }

  function openEdit(field: DetailField) {
    setFormValue(field.name);
    setFormError("");
    setEditItem(field);
    setShowAdd(true);
  }

  async function handleSave() {
    if (!user?.companyID || !formValue.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      if (editItem?.id) {
        await updateDoc(doc(db, "companies", user.companyID, "detailFields", editItem.id), { name: formValue.trim() });
        setFields((prev) => prev.map((f) => f.id === editItem.id ? { ...f, name: formValue.trim() } : f).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const docRef = await addDoc(collection(db, "companies", user.companyID, "detailFields"), { name: formValue.trim() });
        setFields((prev) => [...prev, { id: docRef.id, name: formValue.trim() }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowAdd(false);
      setEditItem(null);
    } catch {
      setFormError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(field: DetailField) {
    if (!user?.companyID || !field.id) return;
    setDeleting(true);
    try {
      const cid = user.companyID;
      const fieldKey = field.name;
      const CHUNK = 400;

      // Cascade: remove this key from all products.details
      const productSnap = await getDocs(collection(db, "companies", cid, "products"));
      const affectedProducts = productSnap.docs.filter((d) => {
        const det = d.data().details;
        return det && typeof det === "object" && fieldKey in (det as Record<string, unknown>);
      });
      for (let i = 0; i < affectedProducts.length; i += CHUNK) {
        const batch = writeBatch(db);
        affectedProducts.slice(i, i + CHUNK).forEach((d) => {
          const details = { ...(d.data().details as Record<string, unknown>) };
          delete details[fieldKey];
          batch.update(d.ref, { details });
        });
        await batch.commit();
      }

      // Cascade: remove from all warehouse inventory items
      const whSnap = await getDocs(collection(db, "companies", cid, "warehouses"));
      for (const wh of whSnap.docs) {
        const invSnap = await getDocs(collection(db, "companies", cid, "warehouses", wh.id, "inventory"));
        const affectedInv = invSnap.docs.filter((d) => {
          const det = d.data().details;
          return det && typeof det === "object" && fieldKey in (det as Record<string, unknown>);
        });
        for (let i = 0; i < affectedInv.length; i += CHUNK) {
          const batch = writeBatch(db);
          affectedInv.slice(i, i + CHUNK).forEach((d) => {
            const details = { ...(d.data().details as Record<string, unknown>) };
            delete details[fieldKey];
            batch.update(d.ref, { details });
          });
          await batch.commit();
        }
      }

      // Delete the field definition itself
      await deleteDoc(doc(db, "companies", cid, "detailFields", field.id));
      setFields((prev) => prev.filter((f) => f.id !== field.id));
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
        <span className="text-sm text-white">Detail Fields</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6 mt-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Detail Fields</h2>
          <p className="text-gray-400 mt-1 text-sm">{fields.length} fields · Custom fields shown on inventory items</p>
        </div>
        {user?.isAdmin && (
          <button onClick={openAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Field
          </button>
        )}
      </div>

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        {fields.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">No detail fields yet. Add one to show custom data on inventory items.</p>
        ) : (
          <div className="divide-y divide-[#2a2f3e]">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded bg-[#2a2f3e] flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm0 7a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm0 7a1 1 0 011-1h10a1 1 0 010 2H4a1 1 0 01-1-1z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-white">{field.name}</p>
                </div>
                {user?.isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(field)} className="px-3 py-2 text-xs rounded-lg text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors">Edit</button>
                    <button onClick={() => setConfirmDelete(field)} className="px-3 py-2 text-xs rounded-lg text-red-400 hover:bg-red-400/10 active:bg-red-400/20 transition-colors">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade" onClick={() => setShowAdd(false)}>
          <div className="animate-sheet bg-[#1a1f2e] border border-[#2a2f3e] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+var(--safe-bottom))] sm:pb-6 w-full sm:max-w-sm sm:m-4 max-h-[92dvh] overflow-y-auto scroll-touch" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-white">{editItem ? "Edit Field" : "Add Detail Field"}</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mb-5">
              <label className="block text-xs text-gray-500 mb-1">Field Name *</label>
              <input
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className={inputCls}
                placeholder="e.g. EPA Number, Mix Ratio"
                autoFocus
              />
              {formError && <p className="text-red-400 text-xs mt-1">{formError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!formValue.trim() || saving} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
                {saving ? "Saving…" : editItem ? "Save Changes" : "Add Field"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade" onClick={() => setConfirmDelete(null)}>
          <div className="animate-sheet bg-[#1a1f2e] border border-[#2a2f3e] rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+var(--safe-bottom))] sm:pb-6 w-full sm:max-w-sm sm:m-4 max-h-[92dvh] overflow-y-auto scroll-touch" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-white mb-2">Delete &quot;{confirmDelete.name}&quot;?</h4>
            <p className="text-sm text-gray-400 mb-5">
              This field will be removed from all products and inventory items that use it. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting} className="flex-1 py-3 sm:py-2 rounded-xl sm:rounded-lg text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete & Cascade"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
