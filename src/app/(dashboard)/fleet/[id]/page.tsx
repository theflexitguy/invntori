"use client";

import { useEffect, useState, use, useCallback } from "react";
import {
  doc, getDoc, collection, getDocs, query, where, orderBy,
  writeBatch, updateDoc, addDoc, Timestamp, deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Sheet } from "@/components/ui/Sheet";
import { FormSheet } from "@/components/ui/FormSheet";
import { NavBarRight, NavBarTitle } from "@/components/layout/NavBarSlot";
import {
  LargeTitle, SectionHeader, Group, DetailRow, ActionRow, Pill,
  NavCircleButton, SearchField, Field, fieldCls, PickerRow, type Tint,
} from "@/components/ui/ios";
import {
  PencilIcon, SlidersIcon, ToolsIcon, ArchiveBoxIcon,
  PersonBadgePlusIcon, PersonBadgeMinusIcon, CheckCircleIcon, TrashIcon, PlusCircleIcon,
} from "@/components/layout/nav";
import type { Vehicle, VehicleAssignment, VehicleMaintenance, Employee } from "@/lib/types";

const CONDITION_OPTS = ["excellent", "good", "fair", "poor"] as const;
const conditionTint: Record<string, Tint> = {
  excellent: "green", good: "blue", fair: "yellow", poor: "red",
};

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function formatDate(ts: { toDate?: () => Date; seconds?: number } | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = typeof ts === "object" && "toDate" in ts && ts.toDate
      ? ts.toDate()
      : new Date((ts as { seconds: number }).seconds * 1000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}

function formatDateTime(ts: { toDate?: () => Date; seconds?: number } | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = typeof ts === "object" && "toDate" in ts && ts.toDate
      ? ts.toDate()
      : new Date((ts as { seconds: number }).seconds * 1000);
    return `${formatDate(ts)} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  } catch { return "—"; }
}

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRetire, setShowRetire] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [vDoc, aSnap, mSnap] = await Promise.all([
      getDoc(doc(db, "companies", cid, "vehicles", id)),
      getDocs(query(collection(db, "companies", cid, "vehicleAssignments"), where("vehicleID", "==", id), orderBy("assignedAt", "desc"))),
      getDocs(query(collection(db, "companies", cid, "vehicleMaintenance"), where("vehicleID", "==", id), orderBy("performedAt", "desc"))),
    ]);
    if (vDoc.exists()) setVehicle({ id: vDoc.id, ...(vDoc.data() as Omit<Vehicle, "id">) });
    setAssignments(aSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleAssignment, "id">) })));
    setMaintenance(mSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleMaintenance, "id">) })));
    setLoading(false);
  }, [user, id]);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
    if (user.isAdmin) {
      getDocs(collection(db, "companies", user.companyID, "Employees")).then((snap) => {
        setEmployees(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }))
            .filter((e) => e.isActive !== false)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      });
    }
  }, [user, load]);

  async function assignDriver(emp: Employee | null, notes: string) {
    if (!user?.companyID || !vehicle?.id) return;
    setActing(true); setError(null);
    try {
      const cid = user.companyID;
      const now = Timestamp.now();
      const batch = writeBatch(db);

      // Close open assignments
      const openSnap = await getDocs(query(collection(db, "companies", cid, "vehicleAssignments"), where("vehicleID", "==", vehicle.id)));
      openSnap.docs.forEach((d) => { if (!d.data().unassignedAt) batch.update(d.ref, { unassignedAt: now }); });

      if (emp) {
        const assignRef = doc(collection(db, "companies", cid, "vehicleAssignments"));
        const data: Record<string, unknown> = { vehicleID: vehicle.id, vehicleName: vehicle.name, employeeUID: emp.id, employeeName: emp.name, assignedAt: now };
        if (notes.trim()) data.notes = notes.trim();
        batch.set(assignRef, data);
        batch.update(doc(db, "companies", cid, "vehicles", vehicle.id!), { currentDriverUID: emp.id, currentDriverName: emp.name, currentAssignedAt: now });
        setVehicle((prev) => prev ? { ...prev, currentDriverUID: emp.id, currentDriverName: emp.name, currentAssignedAt: now } : prev);
      } else {
        batch.update(doc(db, "companies", cid, "vehicles", vehicle.id!), { currentDriverUID: deleteField(), currentDriverName: deleteField(), currentAssignedAt: deleteField() });
        setVehicle((prev) => prev ? { ...prev, currentDriverUID: undefined, currentDriverName: undefined, currentAssignedAt: undefined } : prev);
      }

      await batch.commit();
      setShowAssign(false);
      await load();
    } catch { setError("Failed to update driver assignment."); }
    finally { setActing(false); }
  }

  async function logMaintenance(type: string, description: string, cost: string) {
    if (!user?.companyID || !vehicle?.id) return;
    setActing(true); setError(null);
    try {
      const cid = user.companyID;
      const data: Record<string, unknown> = { vehicleID: vehicle.id, vehicleName: vehicle.name, type: type.trim(), performedAt: Timestamp.now(), performedByName: user.displayName ?? user.email ?? "" };
      if (description.trim()) data.description = description.trim();
      if (cost.trim()) data.cost = parseFloat(cost);
      await addDoc(collection(db, "companies", cid, "vehicleMaintenance"), data);
      setShowMaintenance(false);
      await load();
    } catch { setError("Failed to log maintenance."); }
    finally { setActing(false); }
  }

  async function editVehicle(fields: { name: string; make: string; model: string; year: string; vin: string; licensePlate: string; color: string; condition: string; notes: string }) {
    if (!user?.companyID || !vehicle?.id) return;
    setActing(true); setError(null);
    try {
      const update: Record<string, unknown> = { name: fields.name.trim(), make: fields.make.trim(), model: fields.model.trim(), year: parseInt(fields.year) || 0, condition: fields.condition };
      update.vin = fields.vin.trim() || deleteField();
      update.licensePlate = fields.licensePlate.trim() || deleteField();
      update.color = fields.color.trim() || deleteField();
      update.notes = fields.notes.trim() || deleteField();
      await updateDoc(doc(db, "companies", user.companyID, "vehicles", vehicle.id!), update);
      setVehicle((prev) => prev ? { ...prev, name: fields.name.trim(), make: fields.make.trim(), model: fields.model.trim(), year: parseInt(fields.year) || prev.year, condition: fields.condition as Vehicle["condition"], vin: fields.vin.trim() || undefined, licensePlate: fields.licensePlate.trim() || undefined, color: fields.color.trim() || undefined, notes: fields.notes.trim() || undefined } : prev);
      setShowEdit(false);
    } catch { setError("Failed to update vehicle."); }
    finally { setActing(false); }
  }

  async function retireVehicle() {
    if (!user?.companyID || !vehicle?.id) return;
    setActing(true); setError(null);
    try {
      const cid = user.companyID;
      const now = Timestamp.now();
      const batch = writeBatch(db);
      const snap = await getDocs(query(collection(db, "companies", cid, "vehicleAssignments"), where("vehicleID", "==", vehicle.id)));
      snap.docs.forEach((d) => { if (!d.data().unassignedAt) batch.update(d.ref, { unassignedAt: now }); });
      batch.update(doc(db, "companies", cid, "vehicles", vehicle.id!), { isRetired: true, currentDriverUID: deleteField(), currentDriverName: deleteField(), currentAssignedAt: deleteField() });
      await batch.commit();
      setVehicle((prev) => prev ? { ...prev, isRetired: true, currentDriverUID: undefined, currentDriverName: undefined } : prev);
      setShowRetire(false);
      await load();
    } catch { setError("Failed to retire vehicle."); }
    finally { setActing(false); }
  }

  async function unretireVehicle() {
    if (!user?.companyID || !vehicle?.id) return;
    setActing(true); setError(null);
    try {
      await updateDoc(doc(db, "companies", user.companyID, "vehicles", vehicle.id!), { isRetired: false });
      setVehicle((prev) => prev ? { ...prev, isRetired: false } : prev);
    } catch { setError("Failed to reactivate vehicle."); }
    finally { setActing(false); }
  }

  async function saveCustomFields(fields: Record<string, string>) {
    if (!user?.companyID || !vehicle?.id) return;
    setActing(true); setError(null);
    try {
      await updateDoc(doc(db, "companies", user.companyID, "vehicles", vehicle.id!), { customFields: fields });
      setVehicle((prev) => prev ? { ...prev, customFields: fields } : prev);
      setShowCustomFields(false);
    } catch { setError("Failed to save custom fields."); }
    finally { setActing(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  if (!vehicle) return <div className="p-6 sm:p-8 text-center text-[17px] text-[rgba(235,235,245,0.6)]">Vehicle not found.</div>;

  const customFields = Object.entries(vehicle.customFields ?? {});
  const spec = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      <NavBarTitle fade>
        <span className="text-[17px] font-semibold text-white truncate">{vehicle.name}</span>
      </NavBarTitle>
      {user?.isAdmin && (
        <NavBarRight>
          <NavCircleButton label="Edit vehicle" onClick={() => setShowEdit(true)}>
            <PencilIcon className="w-[19px] h-[19px]" />
          </NavCircleButton>
        </NavBarRight>
      )}

      <LargeTitle
        title={vehicle.name}
        subtitle={spec || "No details"}
        action={
          vehicle.isRetired ? (
            <Pill tint="gray">Retired</Pill>
          ) : vehicle.condition ? (
            <Pill tint={conditionTint[vehicle.condition] ?? "gray"}>{cap(vehicle.condition)}</Pill>
          ) : undefined
        }
      />

      {vehicle.isRetired && (
        <p className="text-[15px] text-[rgba(235,235,245,0.6)] mb-4 px-1">
          This vehicle is retired and no longer in service.
        </p>
      )}

      <SectionHeader tone="secondary">Vehicle Info</SectionHeader>
      <Group className="mb-6">
        <DetailRow label="License Plate" value={vehicle.licensePlate ?? "—"} />
        <DetailRow label="VIN" value={vehicle.vin ?? "—"} />
        <DetailRow label="Color" value={vehicle.color ?? "—"} />
        <DetailRow label="Condition" value={vehicle.condition ? cap(vehicle.condition) : "—"} last={!vehicle.notes} />
        {vehicle.notes && <DetailRow label="Notes" value={vehicle.notes} last />}
      </Group>

      <SectionHeader tone="secondary">Current Assignment</SectionHeader>
      <Group className="mb-6">
        <DetailRow label="Driver" value={vehicle.currentDriverName ?? "Unassigned"} last={!vehicle.currentAssignedAt} />
        {vehicle.currentAssignedAt && (
          <DetailRow label="Assigned Since" value={formatDateTime(vehicle.currentAssignedAt)} nowrap last />
        )}
      </Group>

      <SectionHeader tone="secondary">Custom Fields</SectionHeader>
      <Group className="mb-6">
        {customFields.length === 0 ? (
          <p className={`px-4 py-3.5 text-[17px] text-[rgba(235,235,245,0.6)] ${user?.isAdmin ? "border-b border-[#38383A]/70" : ""}`}>
            No custom fields.
          </p>
        ) : (
          customFields.map(([key, value], i) => (
            <DetailRow key={key} label={key} value={value} last={!user?.isAdmin && i === customFields.length - 1} />
          ))
        )}
        {user?.isAdmin && (
          <ActionRow Icon={SlidersIcon} label="Edit Custom Fields" onClick={() => setShowCustomFields(true)} last />
        )}
      </Group>

      {error && <p className="text-[15px] text-[#FF453A] mb-4 px-1">{error}</p>}

      {user?.isAdmin && (
        <>
          <SectionHeader tone="secondary">Actions</SectionHeader>
          <Group className="mb-6">
            {vehicle.isRetired ? (
              <ActionRow Icon={CheckCircleIcon} iconTint="green" labelTint="green" label="Reactivate Vehicle" onClick={unretireVehicle} disabled={acting} last />
            ) : (
              <>
                <ActionRow
                  Icon={PersonBadgePlusIcon}
                  label={vehicle.currentDriverName ? "Reassign Driver" : "Assign Driver"}
                  onClick={() => setShowAssign(true)}
                  disabled={acting}
                />
                {vehicle.currentDriverName && (
                  <ActionRow Icon={PersonBadgeMinusIcon} iconTint="orange" labelTint="orange" label="Unassign Driver" onClick={() => assignDriver(null, "")} disabled={acting} />
                )}
                <ActionRow Icon={ToolsIcon} label="Log Maintenance" onClick={() => setShowMaintenance(true)} disabled={acting} />
                <ActionRow Icon={ArchiveBoxIcon} labelTint="red" label="Retire Vehicle" onClick={() => setShowRetire(true)} disabled={acting} last />
              </>
            )}
          </Group>
        </>
      )}

      <SectionHeader tone="secondary">Driver History</SectionHeader>
      <Group className="mb-6">
        {assignments.length === 0 ? (
          <p className="px-4 py-3.5 text-[17px] text-[rgba(235,235,245,0.6)]">No driver assignments yet.</p>
        ) : assignments.map((a, i) => (
          <div key={a.id} className="pl-4">
            <div className={`pr-4 py-3.5 ${i === assignments.length - 1 ? "" : "border-b border-[#38383A]/70"}`}>
              <p className="text-[17px] font-semibold text-white break-words">{a.employeeName}</p>
              <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-0.5">
                {formatDate(a.assignedAt)} to{" "}
                {a.unassignedAt
                  ? formatDate(a.unassignedAt)
                  : <span className="text-[#FF9F0A]">Currently assigned</span>}
              </p>
              {a.notes && <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-0.5 break-words">{a.notes}</p>}
            </div>
          </div>
        ))}
      </Group>

      <SectionHeader tone="secondary">Maintenance History</SectionHeader>
      <Group>
        {maintenance.length === 0 ? (
          <p className="px-4 py-3.5 text-[17px] text-[rgba(235,235,245,0.6)]">No maintenance records yet.</p>
        ) : maintenance.map((m, i) => (
          <div key={m.id} className="pl-4">
            <div className={`pr-4 py-3.5 ${i === maintenance.length - 1 ? "" : "border-b border-[#38383A]/70"}`}>
              <div className="flex items-baseline gap-3">
                <p className="flex-1 min-w-0 text-[17px] font-semibold text-white break-words">{m.type}</p>
                {m.cost !== undefined && (
                  <span className="text-[15px] text-[rgba(235,235,245,0.6)] shrink-0">
                    {m.cost.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                  </span>
                )}
              </div>
              {m.description && <p className="text-[15px] text-white mt-0.5 break-words">{m.description}</p>}
              <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-0.5">
                {formatDate(m.performedAt)}{m.performedByName ? ` · ${m.performedByName}` : ""}
              </p>
            </div>
          </div>
        ))}
      </Group>

      {showAssign && (
        <AssignDriverSheet vehicleName={vehicle.name} employees={employees} currentUID={vehicle.currentDriverUID} onSave={assignDriver} onClose={() => setShowAssign(false)} saving={acting} />
      )}
      {showMaintenance && (
        <MaintenanceSheet vehicleName={vehicle.name} onSave={logMaintenance} onClose={() => setShowMaintenance(false)} saving={acting} />
      )}
      {showEdit && (
        <EditVehicleSheet vehicle={vehicle} onSave={editVehicle} onClose={() => setShowEdit(false)} saving={acting} />
      )}
      {showRetire && (
        <ConfirmSheet title="Retire Vehicle" message={`Mark “${vehicle.name}” as retired? The current driver assignment will be closed.`} confirmLabel="Retire Vehicle" onConfirm={retireVehicle} onClose={() => setShowRetire(false)} confirming={acting} />
      )}
      {showCustomFields && (
        <CustomFieldsSheet fields={vehicle.customFields ?? {}} onSave={saveCustomFields} onClose={() => setShowCustomFields(false)} saving={acting} />
      )}
    </div>
  );
}

// ─── Sheets ──────────────────────────────────────────────────────────────────

function AssignDriverSheet({ vehicleName, employees, currentUID, onSave, onClose, saving }: {
  vehicleName: string; employees: Employee[]; currentUID?: string;
  onSave: (e: Employee | null, notes: string) => void; onClose: () => void; saving: boolean;
}) {
  const [selectedID, setSelectedID] = useState<string | null>(currentUID ?? null);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const filtered = employees.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()));
  const selected = employees.find((e) => e.id === selectedID) ?? null;

  return (
    <FormSheet
      title={currentUID ? "Reassign Driver" : "Assign Driver"}
      onCancel={onClose}
      onSave={() => onSave(selected, notes)}
      saveLabel="Assign"
      saveDisabled={!selected}
      saving={saving}
    >
      <p className="text-[15px] text-[rgba(235,235,245,0.6)] mb-4">{vehicleName}</p>

      <div className="mb-3">
        <SearchField value={search} onChange={setSearch} placeholder="Search employees" tone="elevated" />
      </div>

      <Group tone="elevated" className="mb-4 px-4">
        {filtered.length === 0 ? (
          <p className="py-3.5 text-[17px] text-[rgba(235,235,245,0.6)]">No employees found.</p>
        ) : filtered.map((emp, i) => (
          <button
            key={emp.id}
            onClick={() => setSelectedID(emp.id!)}
            className={`w-full flex items-center gap-3 py-3.5 text-left ${
              i === filtered.length - 1 ? "" : "border-b border-[#38383A]/70"
            }`}
          >
            <span className="flex-1 min-w-0 text-[17px] text-white break-words">{emp.name}</span>
            {selectedID === emp.id && <CheckCircleIcon className="w-[22px] h-[22px] text-[#0A84FF] shrink-0" />}
          </button>
        ))}
      </Group>

      <Field label="Notes (optional)">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fieldCls} resize-none h-20`} />
      </Field>
    </FormSheet>
  );
}

function MaintenanceSheet({ vehicleName, onSave, onClose, saving }: {
  vehicleName: string; onSave: (type: string, desc: string, cost: string) => void; onClose: () => void; saving: boolean;
}) {
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  return (
    <FormSheet title="Log Maintenance" onCancel={onClose} onSave={() => onSave(type, description, cost)} saveLabel="Log" saveDisabled={!type.trim()} saving={saving}>
      <p className="text-[15px] text-[rgba(235,235,245,0.6)] mb-4">{vehicleName}</p>
      <div className="space-y-4">
        <Field label="Type" hint="For example: Oil Change, Tire Rotation">
          <input value={type} onChange={(e) => setType(e.target.value)} className={fieldCls} />
        </Field>
        <Field label="Description (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${fieldCls} resize-none h-20`} />
        </Field>
        <Field label="Cost (optional)">
          <input type="number" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className={fieldCls} placeholder="0.00" />
        </Field>
      </div>
    </FormSheet>
  );
}

const VEHICLE_FIELDS = [
  ["name", "Name"], ["make", "Make"], ["model", "Model"], ["year", "Year"],
  ["vin", "VIN"], ["licensePlate", "License Plate"], ["color", "Color"],
] as const;

function EditVehicleSheet({ vehicle, onSave, onClose, saving }: {
  vehicle: Vehicle;
  onSave: (f: { name: string; make: string; model: string; year: string; vin: string; licensePlate: string; color: string; condition: string; notes: string }) => void;
  onClose: () => void; saving: boolean;
}) {
  const [f, setF] = useState({
    name: vehicle.name, make: vehicle.make ?? "", model: vehicle.model ?? "",
    year: String(vehicle.year ?? ""), vin: vehicle.vin ?? "", licensePlate: vehicle.licensePlate ?? "",
    color: vehicle.color ?? "", condition: vehicle.condition ?? "good", notes: vehicle.notes ?? "",
  });
  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  return (
    <FormSheet title="Edit Vehicle" onCancel={onClose} onSave={() => onSave(f)} saveDisabled={!f.name.trim()} saving={saving}>
      <div className="space-y-4">
        {VEHICLE_FIELDS.map(([k, label]) => (
          <Field key={k} label={label}>
            <input
              value={f[k]}
              onChange={(e) => set(k, e.target.value)}
              inputMode={k === "year" ? "numeric" : undefined}
              className={fieldCls}
            />
          </Field>
        ))}
        <div>
          <p className="text-[15px] text-[rgba(235,235,245,0.6)] mb-1.5">Condition</p>
          <Group tone="elevated">
            <PickerRow
              label="Condition"
              value={f.condition}
              onChange={(v) => set("condition", v)}
              options={CONDITION_OPTS.map((c) => ({ value: c, label: cap(c) }))}
              last
            />
          </Group>
        </div>
        <Field label="Notes">
          <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} className={`${fieldCls} resize-none h-20`} />
        </Field>
      </div>
    </FormSheet>
  );
}

function ConfirmSheet({ title, message, confirmLabel, onConfirm, onClose, confirming }: {
  title: string; message: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; confirming: boolean;
}) {
  return (
    <Sheet title={title} onClose={onClose} size="sm">
      <p className="text-[17px] text-[rgba(235,235,245,0.6)] mb-5 leading-snug">{message}</p>
      <button
        onClick={onConfirm}
        disabled={confirming}
        className="w-full py-3 rounded-[14px] text-[17px] font-semibold bg-[#FF453A]/15 text-[#FF453A] active:bg-[#FF453A]/25 transition-colors disabled:opacity-40"
      >
        {confirming ? "Working…" : confirmLabel}
      </button>
    </Sheet>
  );
}

function CustomFieldsSheet({ fields, onSave, onClose, saving }: {
  fields: Record<string, string>; onSave: (f: Record<string, string>) => void; onClose: () => void; saving: boolean;
}) {
  const [entries, setEntries] = useState<{ key: string; value: string }[]>(
    Object.entries(fields).map(([key, value]) => ({ key, value }))
  );
  const [keyError, setKeyError] = useState("");

  function updateRow(i: number, field: "key" | "value", val: string) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)));
    setKeyError("");
  }

  function handleSave() {
    const keys = entries.map((e) => e.key.trim()).filter(Boolean);
    if (new Set(keys).size !== keys.length) {
      setKeyError("Duplicate field names are not allowed.");
      return;
    }
    const result: Record<string, string> = {};
    for (const { key, value } of entries) {
      if (key.trim()) result[key.trim()] = value.trim();
    }
    onSave(result);
  }

  return (
    <FormSheet title="Custom Fields" onCancel={onClose} onSave={handleSave} saveLabel="Save Fields" saving={saving}>
      {entries.length === 0 && (
        <p className="text-[15px] text-[rgba(235,235,245,0.6)] mb-3">
          No custom fields yet. Add one below.
        </p>
      )}
      <div className="space-y-2 mb-3">
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input value={entry.key} onChange={(e) => updateRow(i, "key", e.target.value)} placeholder="Field name" className={`${fieldCls} flex-1 min-w-0`} />
            <input value={entry.value} onChange={(e) => updateRow(i, "value", e.target.value)} placeholder="Value" className={`${fieldCls} flex-1 min-w-0`} />
            <button
              onClick={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))}
              aria-label="Remove field"
              className="shrink-0 p-1 text-[#FF453A] active:opacity-60 transition-opacity"
            >
              <TrashIcon className="w-[19px] h-[19px]" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setEntries((prev) => [...prev, { key: "", value: "" }])}
        className="flex items-center gap-1.5 text-[17px] font-medium text-[#0A84FF] active:opacity-60 transition-opacity"
      >
        <PlusCircleIcon className="w-[20px] h-[20px]" />
        Add Field
      </button>
      {keyError && <p className="text-[15px] text-[#FF453A] mt-3">{keyError}</p>}
    </FormSheet>
  );
}
