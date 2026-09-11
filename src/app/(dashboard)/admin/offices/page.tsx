"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { FormSheet } from "@/components/ui/FormSheet";
import {
  LargeTitle, Group, InfoCard, NavCircleButton, FieldLabel, fieldCls,
} from "@/components/ui/ios";
import { NavBarRight } from "@/components/layout/NavBarSlot";
import { PlusIcon } from "@/components/ui/PageHeader";
import { ChevronRightIcon, SyncIcon, BuildingIcon } from "@/components/layout/nav";
import type { Office, Warehouse } from "@/lib/types";

const COLOR_OPTIONS = [
  "#30D158", "#64D2FF", "#0A84FF", "#FF9F0A", "#FF453A", "#BF5AF2", "#FF375F", "#5E5CE6",
];

export default function OfficesPage() {
  const { user } = useAuth();
  const [offices, setOffices] = useState<Office[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Office | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [colorHex, setColorHex] = useState(COLOR_OPTIONS[0]);
  const [fieldroutesID, setFieldroutesID] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [officeSnap, whSnap] = await Promise.all([
      getDocs(collection(db, "companies", cid, "offices")),
      getDocs(collection(db, "companies", cid, "warehouses")),
    ]);
    setOffices(
      officeSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Office, "id">) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setWarehouses(whSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Warehouse, "id">) })));
    setLoading(false);
  }, [user?.companyID]);

  useEffect(() => {
    if (user?.companyID) load();
  }, [user?.companyID, load]);

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
    if (!user?.companyID || !name.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const parsedFr = parseInt(fieldroutesID, 10);
      const data: Record<string, unknown> = {
        name: name.trim(),
        address: address.trim() || null,
        colorHex,
        fieldroutesOfficeID: !isNaN(parsedFr) ? parsedFr : null,
      };
      if (editItem?.id) {
        await updateDoc(doc(db, "companies", user.companyID, "offices", editItem.id), data);
      } else {
        await addDoc(collection(db, "companies", user.companyID, "offices"), data);
      }
      setShowForm(false);
      await load();
    } catch {
      setFormError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user?.companyID || !editItem?.id) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "companies", user.companyID, "offices", editItem.id));
      setShowForm(false);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      {user?.isAdmin && (
        <NavBarRight>
          <NavCircleButton label="Add office" onClick={openAdd}>
            <PlusIcon className="w-[17px] h-[17px]" />
          </NavCircleButton>
        </NavBarRight>
      )}

      <LargeTitle
        title="Offices"
        subtitle={`${offices.length} ${offices.length === 1 ? "Office" : "Offices"}`}
      />

      {offices.length === 0 ? (
        <div className="bg-[#1C1C1E] rounded-[14px] px-6 py-12 text-center text-[15px] text-[rgba(235,235,245,0.6)]">
          No offices yet. Add one to get started.
        </div>
      ) : (
        <Group>
          {offices.map((office, i) => {
            const count = warehouses.filter((w) => w.officeID === office.id).length;
            return (
              <button
                key={office.id}
                onClick={() => user?.isAdmin && openEdit(office)}
                className="w-full flex items-stretch pl-4 text-left active:bg-white/[0.06] transition-colors"
              >
                <span className="flex items-center pr-3 shrink-0">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: office.colorHex ?? "#0A84FF" }}
                  />
                </span>
                <span
                  className={`flex-1 min-w-0 flex items-center gap-3 pr-3.5 py-3 ${
                    i === offices.length - 1 ? "" : "border-b border-[#38383A]/70"
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[17px] font-semibold text-white leading-snug break-words">
                      {office.name}
                    </span>
                    <span className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-0.5 text-[15px] text-[rgba(235,235,245,0.6)]">
                      {office.fieldroutesOfficeID != null && (
                        <span className="flex items-center gap-1.5">
                          <SyncIcon className="w-4 h-4 shrink-0" />
                          FR Office {office.fieldroutesOfficeID}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <BuildingIcon className="w-4 h-4 shrink-0" />
                        {count} warehouse{count === 1 ? "" : "s"}
                      </span>
                    </span>
                    {office.address && (
                      <span className="block text-[15px] text-[rgba(235,235,245,0.6)] leading-snug">
                        {office.address}
                      </span>
                    )}
                  </span>
                  {user?.isAdmin && (
                    <ChevronRightIcon className="w-[14px] h-[14px] text-[rgba(235,235,245,0.3)] shrink-0" />
                  )}
                </span>
              </button>
            );
          })}
        </Group>
      )}

      <div className="mt-6">
        <InfoCard title="Office Access Control">
          Assign employees to offices in Manage Employees. Assign warehouses to offices when adding
          or editing a warehouse. Admins always see all offices.
        </InfoCard>
      </div>

      {showForm && (
        <FormSheet
          title={editItem ? "Edit Office" : "Add Office"}
          onCancel={() => setShowForm(false)}
          onSave={handleSave}
          saveDisabled={!name.trim()}
          saving={saving}
        >
          <div className="space-y-5">
            <div>
              <FieldLabel>Office Name</FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldCls}
                placeholder="e.g. Central AR"
                autoFocus
              />
            </div>
            <div>
              <FieldLabel>Address</FieldLabel>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={fieldCls}
                placeholder="e.g. 11928 Callis Rd"
              />
            </div>
            <div>
              <FieldLabel>Color</FieldLabel>
              <div className="flex gap-3 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColorHex(c)}
                    aria-label={`Colour ${c}`}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      colorHex === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#1C1C1E]" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>FieldRoutes Office ID</FieldLabel>
              <input
                value={fieldroutesID}
                onChange={(e) => setFieldroutesID(e.target.value)}
                inputMode="numeric"
                className={fieldCls}
                placeholder="Optional"
              />
            </div>

            {formError && <p className="text-[#FF453A] text-[15px]">{formError}</p>}

            {editItem && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full py-3.5 rounded-[12px] text-[17px] font-medium bg-[#FF453A]/15 text-[#FF453A] active:bg-[#FF453A]/25 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete Office"}
              </button>
            )}
          </div>
        </FormSheet>
      )}
    </div>
  );
}
