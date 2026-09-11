"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { FormSheet } from "@/components/ui/FormSheet";
import {
  LargeTitle, Group, NavCircleButton, FieldLabel, fieldCls, ChipSelect,
} from "@/components/ui/ios";
import { NavBarRight } from "@/components/layout/NavBarSlot";
import { PlusIcon } from "@/components/ui/PageHeader";
import { ChevronRightIcon, WarehouseIcon } from "@/components/layout/nav";
import type { Warehouse, Office } from "@/lib/types";

export default function WarehousesPage() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Warehouse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [officeID, setOfficeID] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [whSnap, officeSnap] = await Promise.all([
      getDocs(collection(db, "companies", cid, "warehouses")),
      getDocs(collection(db, "companies", cid, "offices")),
    ]);
    setWarehouses(
      whSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Warehouse, "id">) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setOffices(
      officeSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Office, "id">) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setLoading(false);
  }, [user?.companyID]);

  useEffect(() => {
    if (user?.companyID) load();
  }, [user?.companyID, load]);

  function openAdd() {
    setName("");
    setLocation("");
    setOfficeID(null);
    setFormError("");
    setConfirmDelete(false);
    setEditItem(null);
    setShowForm(true);
  }

  function openEdit(wh: Warehouse) {
    setName(wh.name);
    setLocation(wh.location ?? "");
    setOfficeID(wh.officeID ?? null);
    setFormError("");
    setConfirmDelete(false);
    setEditItem(wh);
    setShowForm(true);
  }

  async function handleSave() {
    if (!user?.companyID || !name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const data = {
        name: name.trim(),
        location: location.trim() || null,
        officeID: officeID ?? null,
      };
      if (editItem?.id) {
        await updateDoc(doc(db, "companies", user.companyID, "warehouses", editItem.id), data);
      } else {
        await addDoc(collection(db, "companies", user.companyID, "warehouses"), data);
      }
      setShowForm(false);
      await load();
    } catch {
      setFormError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  /** Deleting a warehouse also clears its inventory subcollection. */
  async function handleDelete() {
    if (!user?.companyID || !editItem?.id) return;
    setDeleting(true);
    try {
      const cid = user.companyID;
      const invSnap = await getDocs(
        collection(db, "companies", cid, "warehouses", editItem.id, "inventory")
      );
      if (!invSnap.empty) {
        const batch = writeBatch(db);
        invSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, "companies", cid, "warehouses", editItem.id));
      setShowForm(false);
      await load();
    } catch {
      setFormError("Failed to delete.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  const officeName = (id?: string | null) => offices.find((o) => o.id === id)?.name;
  const officeColor = (id?: string | null) => offices.find((o) => o.id === id)?.colorHex;

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-2xl">
      {user?.isAdmin && (
        <NavBarRight>
          <NavCircleButton label="Add warehouse" onClick={openAdd}>
            <PlusIcon className="w-[17px] h-[17px]" />
          </NavCircleButton>
        </NavBarRight>
      )}

      <LargeTitle
        title="Warehouses"
        subtitle={`${warehouses.length} ${warehouses.length === 1 ? "Warehouse" : "Warehouses"}`}
      />

      {warehouses.length === 0 ? (
        <div className="bg-[#1C1C1E] rounded-[14px] px-6 py-12 text-center text-[15px] text-[rgba(235,235,245,0.6)]">
          No warehouses yet. Add one to get started.
        </div>
      ) : (
        <Group>
          {warehouses.map((wh, i) => (
            <button
              key={wh.id}
              onClick={() => user?.isAdmin && openEdit(wh)}
              className="w-full flex items-stretch pl-4 text-left active:bg-white/[0.06] transition-colors"
            >
              <span className="flex items-center pr-3 shrink-0">
                <WarehouseIcon className="w-[22px] h-[22px] text-[#0A84FF]" />
              </span>
              <span
                className={`flex-1 min-w-0 flex items-center gap-3 pr-3.5 py-3 ${
                  i === warehouses.length - 1 ? "" : "border-b border-[#38383A]/70"
                }`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[17px] font-semibold text-white leading-snug break-words">
                    {wh.name}
                  </span>
                  {wh.location && (
                    <span className="block text-[15px] text-[rgba(235,235,245,0.6)] leading-snug break-words">
                      {wh.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 mt-0.5 text-[15px] text-[rgba(235,235,245,0.6)]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: officeColor(wh.officeID) ?? "rgba(235,235,245,0.3)" }}
                    />
                    {officeName(wh.officeID) ?? "Unassigned"}
                  </span>
                </span>
                {user?.isAdmin && (
                  <ChevronRightIcon className="w-[14px] h-[14px] text-[rgba(235,235,245,0.3)] shrink-0" />
                )}
              </span>
            </button>
          ))}
        </Group>
      )}

      {showForm && (
        <FormSheet
          title={editItem ? "Edit Warehouse" : "New Warehouse"}
          onCancel={() => setShowForm(false)}
          onSave={handleSave}
          saveDisabled={!name.trim()}
          saving={saving}
        >
          <div className="space-y-5">
            <div>
              <FieldLabel>Warehouse Name</FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldCls}
                placeholder="e.g. Bentonville"
                autoFocus
              />
            </div>
            <div>
              <FieldLabel>Location</FieldLabel>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={fieldCls}
                placeholder="e.g. 11928 Callis Rd, Bentonville, AR 72712"
              />
            </div>
            <div>
              <FieldLabel>Office Assignment</FieldLabel>
              <ChipSelect
                value={officeID}
                onChange={setOfficeID}
                options={[
                  { value: null, label: "Unassigned" },
                  ...offices.map((o) => ({
                    value: o.id!,
                    label: o.name,
                    dot: o.colorHex ?? "#0A84FF",
                  })),
                ]}
              />
            </div>

            {formError && <p className="text-[#FF453A] text-[15px]">{formError}</p>}

            {editItem && (
              <div className="pt-1">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full py-3.5 rounded-[12px] text-[17px] font-medium bg-[#FF453A]/15 text-[#FF453A] active:bg-[#FF453A]/25 transition-colors"
                  >
                    Delete Warehouse
                  </button>
                ) : (
                  <div className="bg-[#FF453A]/10 rounded-[12px] p-4">
                    <p className="text-[15px] text-white mb-3 leading-snug">
                      Delete “{editItem.name}” and all of its inventory records? This cannot be
                      undone.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-2.5 rounded-[10px] text-[15px] text-white bg-white/10 active:bg-white/15 transition-colors"
                      >
                        Keep
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 py-2.5 rounded-[10px] text-[15px] font-semibold text-white bg-[#FF453A] active:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </FormSheet>
      )}
    </div>
  );
}
