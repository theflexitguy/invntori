"use client";

import { useEffect, useState, use, useCallback } from "react";
import {
  doc, getDoc, collection, getDocs, query, where, orderBy,
  writeBatch, updateDoc, addDoc, Timestamp, deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import type { Vehicle, VehicleAssignment, VehicleMaintenance, Employee } from "@/lib/types";

const CONDITION_OPTS = ["excellent", "good", "fair", "poor"] as const;
const conditionVariant: Record<string, "green" | "blue" | "yellow" | "red"> = {
  excellent: "green", good: "blue", fair: "yellow", poor: "red",
};

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
  if (!vehicle) return <div className="p-8 text-center text-gray-500">Vehicle not found.</div>;

  return (
    <div className="p-6 xl:p-8 w-full max-w-3xl">
      <Link href="/fleet" className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1 mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Fleet
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-white">{vehicle.name}</h2>
            {vehicle.isRetired
              ? <Badge variant="gray">Retired</Badge>
              : vehicle.condition && <Badge variant={conditionVariant[vehicle.condition] ?? "gray"}>{vehicle.condition}</Badge>}
          </div>
          <p className="text-gray-400 mt-1 text-sm">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "No details"}</p>
        </div>
        {user?.isAdmin && (
          <button onClick={() => setShowEdit(true)} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#2a2f3e] text-gray-400 hover:text-white hover:border-[#35B2FF]/40 transition-colors">
            Edit
          </button>
        )}
      </div>

      {vehicle.isRetired && (
        <div className="mb-4 bg-gray-500/10 border border-gray-500/20 rounded-xl px-5 py-3 text-sm text-gray-400">
          This vehicle is retired and no longer in service.
        </div>
      )}

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-6 mb-4">
        <h3 className="text-sm font-semibold text-white mb-4">Vehicle Info</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <InfoRow label="License Plate" value={vehicle.licensePlate} />
          <InfoRow label="VIN" value={vehicle.vin} />
          <InfoRow label="Color" value={vehicle.color} />
          <InfoRow label="Condition" value={vehicle.condition} />
          <InfoRow label="Assigned Driver" value={vehicle.currentDriverName} />
          <InfoRow label="Notes" value={vehicle.notes} span />
        </dl>
      </div>

      {/* Custom Fields */}
      {(Object.keys(vehicle.customFields ?? {}).length > 0 || user?.isAdmin) && (
        <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Custom Fields</h3>
            {user?.isAdmin && (
              <button onClick={() => setShowCustomFields(true)} className="text-xs text-[#35B2FF] hover:opacity-80 transition-opacity">Edit Fields</button>
            )}
          </div>
          {Object.keys(vehicle.customFields ?? {}).length === 0 ? (
            <p className="text-xs text-gray-500">No custom fields yet. Click Edit Fields to add some.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              {Object.entries(vehicle.customFields ?? {}).map(([key, value]) => (
                <InfoRow key={key} label={key} value={value} />
              ))}
            </dl>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {user?.isAdmin && (
        <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {!vehicle.isRetired && (
              <>
                <Btn onClick={() => setShowAssign(true)} disabled={acting} color="blue">
                  {vehicle.currentDriverName ? "Reassign Driver" : "Assign Driver"}
                </Btn>
                {vehicle.currentDriverName && (
                  <Btn onClick={() => assignDriver(null, "")} disabled={acting} color="yellow">Unassign Driver</Btn>
                )}
                <Btn onClick={() => setShowMaintenance(true)} disabled={acting} color="green">Log Maintenance</Btn>
                <Btn onClick={() => setShowRetire(true)} disabled={acting} color="red">Retire Vehicle</Btn>
              </>
            )}
            {vehicle.isRetired && (
              <Btn onClick={unretireVehicle} disabled={acting} color="blue">Reactivate Vehicle</Btn>
            )}
          </div>
        </div>
      )}

      <Section title="Driver History" count={assignments.length}>
        {assignments.length === 0 ? (
          <p className="text-gray-500 text-sm px-6 py-4">No driver assignments</p>
        ) : assignments.map((a) => (
          <div key={a.id} className="px-6 py-3.5 border-t border-[#2a2f3e] first:border-0 text-sm">
            <p className="text-white font-medium">{a.employeeName}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {formatDate(a.assignedAt)} {a.unassignedAt ? `→ ${formatDate(a.unassignedAt)}` : "· Current"}
            </p>
            {a.notes && <p className="text-gray-500 text-xs">{a.notes}</p>}
          </div>
        ))}
      </Section>

      <Section title="Maintenance" count={maintenance.length}>
        {maintenance.length === 0 ? (
          <p className="text-gray-500 text-sm px-6 py-4">No maintenance records</p>
        ) : maintenance.map((m) => (
          <div key={m.id} className="px-6 py-3.5 border-t border-[#2a2f3e] first:border-0 text-sm">
            <div className="flex justify-between">
              <p className="text-white font-medium">{m.type}</p>
              {m.cost !== undefined && <span className="text-gray-400 text-xs">{m.cost.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>}
            </div>
            {m.description && <p className="text-gray-400 text-xs mt-0.5">{m.description}</p>}
            <p className="text-gray-500 text-xs mt-0.5">{formatDate(m.performedAt)}{m.performedByName ? ` · ${m.performedByName}` : ""}</p>
          </div>
        ))}
      </Section>

      {showAssign && (
        <AssignDriverModal vehicleName={vehicle.name} employees={employees} currentUID={vehicle.currentDriverUID} onSave={assignDriver} onClose={() => setShowAssign(false)} saving={acting} />
      )}
      {showMaintenance && (
        <MaintenanceModal vehicleName={vehicle.name} onSave={logMaintenance} onClose={() => setShowMaintenance(false)} saving={acting} />
      )}
      {showEdit && (
        <EditVehicleModal vehicle={vehicle} onSave={editVehicle} onClose={() => setShowEdit(false)} saving={acting} />
      )}
      {showRetire && (
        <ConfirmModal title="Retire Vehicle" message={`Mark "${vehicle.name}" as retired? The current driver assignment will be closed.`} confirmLabel="Retire" danger onConfirm={retireVehicle} onClose={() => setShowRetire(false)} confirming={acting} />
      )}
      {showCustomFields && (
        <CustomFieldsModal fields={vehicle.customFields ?? {}} onSave={saveCustomFields} onClose={() => setShowCustomFields(false)} saving={acting} />
      )}
    </div>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function Btn({ onClick, disabled, color, children }: { onClick: () => void; disabled: boolean; color: "blue"|"green"|"yellow"|"red"; children: React.ReactNode }) {
  const c = { blue: "bg-[#35B2FF]/10 text-[#35B2FF] border-[#35B2FF]/20 hover:bg-[#35B2FF]/20", green: "bg-green-400/10 text-green-400 border-green-400/20 hover:bg-green-400/20", yellow: "bg-amber-400/10 text-amber-400 border-amber-400/20 hover:bg-amber-400/20", red: "bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20" };
  return <button onClick={onClick} disabled={disabled} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${c[color]}`}>{children}</button>;
}

function InfoRow({ label, value, span }: { label: string; value?: string | number | null; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-white">{value ?? "—"}</dd>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-[#2a2f3e] flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-gray-500">({count})</span>
      </div>
      {children}
    </div>
  );
}

function formatDate(ts: { toDate?: () => Date; seconds?: number } | null | undefined): string {
  if (!ts) return "—";
  try { const d = typeof ts === "object" && "toDate" in ts && ts.toDate ? ts.toDate() : new Date((ts as { seconds: number }).seconds * 1000); return d.toLocaleDateString(); }
  catch { return "—"; }
}

// ─── Modals ──────────────────────────────────────────────────────────────────

const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AssignDriverModal({ vehicleName, employees, currentUID, onSave, onClose, saving }: { vehicleName: string; employees: Employee[]; currentUID?: string; onSave: (e: Employee | null, notes: string) => void; onClose: () => void; saving: boolean }) {
  const [selected, setSelected] = useState<Employee | null>(employees.find((e) => e.id === currentUID) ?? employees[0] ?? null);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const filtered = employees.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal title="Assign Driver" onClose={onClose}>
      <p className="text-sm text-gray-400 mb-3">{vehicleName}</p>
      <input type="search" placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} mb-3`} />
      <div className="max-h-44 overflow-y-auto space-y-1 mb-3">
        {filtered.map((emp) => (
          <button key={emp.id} onClick={() => setSelected(emp)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${selected?.id === emp.id ? "bg-[#35B2FF]/15 text-white" : "text-gray-400 hover:bg-white/[0.04]"}`}>
            <span>{emp.name}</span>
            {selected?.id === emp.id && <svg className="w-4 h-4 text-[#35B2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
          </button>
        ))}
        {filtered.length === 0 && <p className="text-gray-500 text-sm px-3 py-2">No employees found</p>}
      </div>
      <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none h-16 mb-4`} />
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
        <button onClick={() => onSave(selected, notes)} disabled={!selected || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Assign"}</button>
      </div>
    </Modal>
  );
}

function MaintenanceModal({ vehicleName, onSave, onClose, saving }: { vehicleName: string; onSave: (type: string, desc: string, cost: string) => void; onClose: () => void; saving: boolean }) {
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  return (
    <Modal title="Log Maintenance" onClose={onClose}>
      <p className="text-sm text-gray-400 mb-3">{vehicleName}</p>
      <div className="space-y-3 mb-4">
        <div><label className="block text-xs text-gray-500 mb-1">Type (e.g. Oil Change, Tire Rotation)</label><input value={type} onChange={(e) => setType(e.target.value)} className={inputCls} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Description (optional)</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none h-16`} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Cost (optional)</label><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} placeholder="0.00" /></div>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
        <button onClick={() => onSave(type, description, cost)} disabled={!type.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-green-400/10 text-green-400 border border-green-400/20 hover:bg-green-400/20 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Log"}</button>
      </div>
    </Modal>
  );
}

function EditVehicleModal({ vehicle, onSave, onClose, saving }: { vehicle: Vehicle; onSave: (f: { name: string; make: string; model: string; year: string; vin: string; licensePlate: string; color: string; condition: string; notes: string }) => void; onClose: () => void; saving: boolean }) {
  const [f, setF] = useState({ name: vehicle.name, make: vehicle.make ?? "", model: vehicle.model ?? "", year: String(vehicle.year ?? ""), vin: vehicle.vin ?? "", licensePlate: vehicle.licensePlate ?? "", color: vehicle.color ?? "", condition: vehicle.condition ?? "good", notes: vehicle.notes ?? "" });
  const upd = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((prev) => ({ ...prev, [k]: e.target.value }));
  return (
    <Modal title="Edit Vehicle" onClose={onClose}>
      <div className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
        {(["name","make","model","year","vin","licensePlate","color"] as const).map((k) => (
          <div key={k}><label className="block text-xs text-gray-500 mb-1 capitalize">{k === "licensePlate" ? "License Plate" : k === "vin" ? "VIN" : k}</label><input value={f[k]} onChange={upd(k)} className={inputCls} /></div>
        ))}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Condition</label>
          <select value={f.condition} onChange={upd("condition")} className={`${inputCls} appearance-none`}>
            {CONDITION_OPTS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div><label className="block text-xs text-gray-500 mb-1">Notes</label><textarea value={f.notes} onChange={upd("notes")} className={`${inputCls} resize-none h-16`} /></div>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
        <button onClick={() => onSave(f)} disabled={!f.name.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose, confirming }: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void; confirming: boolean }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-gray-400 mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
        <button onClick={onConfirm} disabled={confirming} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${danger ? "bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/25" : "bg-[#35B2FF]/15 text-[#35B2FF] border-[#35B2FF]/20 hover:bg-[#35B2FF]/25"}`}>{confirming ? "…" : confirmLabel}</button>
      </div>
    </Modal>
  );
}

function CustomFieldsModal({ fields, onSave, onClose, saving }: { fields: Record<string, string>; onSave: (f: Record<string, string>) => void; onClose: () => void; saving: boolean }) {
  const [entries, setEntries] = useState<{ key: string; value: string }[]>(
    Object.entries(fields).map(([key, value]) => ({ key, value }))
  );
  const [keyError, setKeyError] = useState("");

  function addRow() { setEntries((prev) => [...prev, { key: "", value: "" }]); }
  function removeRow(i: number) { setEntries((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, field: "key" | "value", val: string) {
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }

  function handleSave() {
    const keys = entries.map((e) => e.key.trim()).filter(Boolean);
    if (new Set(keys).size !== keys.length) { setKeyError("Duplicate field names are not allowed."); return; }
    const result: Record<string, string> = {};
    for (const { key, value } of entries) {
      if (key.trim()) result[key.trim()] = value.trim();
    }
    onSave(result);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">Custom Fields</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
          {entries.length === 0 && (
            <p className="text-xs text-gray-500 py-2">No custom fields yet. Click + Add Field below.</p>
          )}
          {entries.map((entry, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={entry.key} onChange={(e) => updateRow(i, "key", e.target.value)} placeholder="Field name" className="flex-1 bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#35B2FF]" />
              <input value={entry.value} onChange={(e) => updateRow(i, "value", e.target.value)} placeholder="Value" className="flex-1 bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#35B2FF]" />
              <button onClick={() => removeRow(i)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
        <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-[#35B2FF] hover:opacity-80 transition-opacity mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Field
        </button>
        {keyError && <p className="text-red-400 text-xs mb-3">{keyError}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save Fields"}
          </button>
        </div>
      </div>
    </div>
  );
}
