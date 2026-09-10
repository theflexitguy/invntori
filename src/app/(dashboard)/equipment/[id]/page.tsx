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
import type { Equipment, EquipmentCheckout, EquipmentRepair, Employee } from "@/lib/types";

const statusVariant: Record<string, "green" | "blue" | "yellow" | "red" | "gray"> = {
  available: "green", checkedOut: "blue", inRepair: "yellow", retired: "gray",
};
const statusLabel: Record<string, string> = {
  available: "Available", checkedOut: "Checked Out", inRepair: "In Repair", retired: "Retired",
};

export default function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [checkouts, setCheckouts] = useState<EquipmentCheckout[]>([]);
  const [repairs, setRepairs] = useState<EquipmentRepair[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRetire, setShowRetire] = useState(false);

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [eqDoc, checkSnap, repairSnap] = await Promise.all([
      getDoc(doc(db, "companies", cid, "equipment", id)),
      getDocs(query(collection(db, "companies", cid, "equipmentCheckouts"), where("equipmentID", "==", id), orderBy("checkedOutAt", "desc"))),
      getDocs(query(collection(db, "companies", cid, "equipmentRepairs"), where("equipmentID", "==", id), orderBy("reportedAt", "desc"))),
    ]);
    if (eqDoc.exists()) setEquipment({ id: eqDoc.id, ...(eqDoc.data() as Omit<Equipment, "id">) });
    setCheckouts(checkSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EquipmentCheckout, "id">) })));
    setRepairs(repairSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EquipmentRepair, "id">) })));
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

  const activeCheckout = checkouts.find((c) => !c.returnedAt);
  const openRepair = repairs.find((r) => r.status !== "completed" && r.status !== "rejected");
  const canReturn = equipment?.status === "checkedOut" && (equipment?.currentHolderUID === user?.uid || user?.isAdmin);

  async function assignToEmployee(emp: Employee, notes: string) {
    if (!user?.companyID || !equipment?.id) return;
    setActing(true); setError(null);
    try {
      const cid = user.companyID;
      const now = Timestamp.now();
      const batch = writeBatch(db);
      const openSnap = await getDocs(query(collection(db, "companies", cid, "equipmentCheckouts"), where("equipmentID", "==", equipment.id)));
      openSnap.docs.forEach((d) => { if (!d.data().returnedAt) batch.update(d.ref, { returnedAt: now }); });
      const checkoutRef = doc(collection(db, "companies", cid, "equipmentCheckouts"));
      const checkoutData: Record<string, unknown> = { equipmentID: equipment.id, equipmentName: equipment.name, employeeUID: emp.id, employeeName: emp.name, checkedOutAt: now };
      if (notes.trim()) checkoutData.notes = notes.trim();
      batch.set(checkoutRef, checkoutData);
      batch.update(doc(db, "companies", cid, "equipment", equipment.id!), { status: "checkedOut", currentHolderUID: emp.id, currentHolderName: emp.name, currentCheckedOutAt: now });
      await batch.commit();
      setEquipment((prev) => prev ? { ...prev, status: "checkedOut", currentHolderUID: emp.id, currentHolderName: emp.name, currentCheckedOutAt: now } : prev);
      setShowAssign(false);
      await load();
    } catch { setError("Failed to assign equipment."); }
    finally { setActing(false); }
  }

  async function returnEquipment() {
    if (!user?.companyID || !equipment?.id || !activeCheckout?.id) return;
    setActing(true); setError(null);
    try {
      const cid = user.companyID;
      const now = Timestamp.now();
      const batch = writeBatch(db);
      batch.update(doc(db, "companies", cid, "equipmentCheckouts", activeCheckout.id!), { returnedAt: now });
      batch.update(doc(db, "companies", cid, "equipment", equipment.id!), { status: "available", currentHolderUID: deleteField(), currentHolderName: deleteField(), currentCheckedOutAt: deleteField() });
      await batch.commit();
      setEquipment((prev) => prev ? { ...prev, status: "available", currentHolderUID: undefined, currentHolderName: undefined, currentCheckedOutAt: undefined } : prev);
      await load();
    } catch { setError("Failed to return equipment."); }
    finally { setActing(false); }
  }

  async function reportRepair(description: string) {
    if (!user?.companyID || !equipment?.id) return;
    setActing(true); setError(null);
    try {
      const cid = user.companyID;
      await addDoc(collection(db, "companies", cid, "equipmentRepairs"), { equipmentID: equipment.id, equipmentName: equipment.name, reportedByUID: user.uid, reportedByName: user.displayName ?? user.email ?? "", description: description.trim(), status: "reported", reportedAt: Timestamp.now() });
      await updateDoc(doc(db, "companies", cid, "equipment", equipment.id!), { status: "inRepair" });
      setEquipment((prev) => prev ? { ...prev, status: "inRepair" } : prev);
      setShowReport(false);
      await load();
    } catch { setError("Failed to report repair."); }
    finally { setActing(false); }
  }

  async function resolveRepair() {
    if (!user?.companyID || !equipment?.id || !openRepair?.id) return;
    setActing(true); setError(null);
    try {
      const cid = user.companyID;
      const now = Timestamp.now();
      const batch = writeBatch(db);
      batch.update(doc(db, "companies", cid, "equipmentRepairs", openRepair.id!), { status: "completed", resolvedAt: now });
      batch.update(doc(db, "companies", cid, "equipment", equipment.id!), { status: "available" });
      await batch.commit();
      setEquipment((prev) => prev ? { ...prev, status: "available" } : prev);
      await load();
    } catch { setError("Failed to resolve repair."); }
    finally { setActing(false); }
  }

  async function retireEquipment() {
    if (!user?.companyID || !equipment?.id) return;
    setActing(true); setError(null);
    try {
      const cid = user.companyID;
      const now = Timestamp.now();
      const batch = writeBatch(db);
      const snap = await getDocs(query(collection(db, "companies", cid, "equipmentCheckouts"), where("equipmentID", "==", equipment.id)));
      snap.docs.forEach((d) => { if (!d.data().returnedAt) batch.update(d.ref, { returnedAt: now }); });
      batch.update(doc(db, "companies", cid, "equipment", equipment.id!), { status: "retired", currentHolderUID: deleteField(), currentHolderName: deleteField(), currentCheckedOutAt: deleteField() });
      await batch.commit();
      setEquipment((prev) => prev ? { ...prev, status: "retired", currentHolderUID: undefined, currentHolderName: undefined, currentCheckedOutAt: undefined } : prev);
      setShowRetire(false);
      await load();
    } catch { setError("Failed to retire equipment."); }
    finally { setActing(false); }
  }

  async function unretireEquipment() {
    if (!user?.companyID || !equipment?.id) return;
    setActing(true); setError(null);
    try {
      await updateDoc(doc(db, "companies", user.companyID, "equipment", equipment.id!), { status: "available" });
      setEquipment((prev) => prev ? { ...prev, status: "available" } : prev);
    } catch { setError("Failed to reactivate."); }
    finally { setActing(false); }
  }

  async function editEquipment(name: string, category: string, serialNumber: string, notes: string) {
    if (!user?.companyID || !equipment?.id) return;
    setActing(true); setError(null);
    try {
      await updateDoc(doc(db, "companies", user.companyID, "equipment", equipment.id!), {
        name: name.trim(), category: category.trim(),
        serialNumber: serialNumber.trim() || deleteField(),
        notes: notes.trim() || deleteField(),
      });
      setEquipment((prev) => prev ? { ...prev, name: name.trim(), category: category.trim(), serialNumber: serialNumber.trim() || undefined, notes: notes.trim() || undefined } : prev);
      setShowEdit(false);
    } catch { setError("Failed to update."); }
    finally { setActing(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  if (!equipment) return <div className="p-8 text-center text-gray-500">Equipment not found.</div>;

  const checkedOutSince = equipment.currentCheckedOutAt
    ? ("toDate" in equipment.currentCheckedOutAt ? (equipment.currentCheckedOutAt as { toDate: () => Date }).toDate() : new Date((equipment.currentCheckedOutAt as { seconds: number }).seconds * 1000)).toLocaleDateString()
    : null;

  return (
    <div className="p-6 xl:p-8 w-full max-w-3xl">
      <Link href="/equipment" className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1 mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Equipment
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-white">{equipment.name}</h2>
            <Badge variant={statusVariant[equipment.status] ?? "gray"}>{statusLabel[equipment.status] ?? equipment.status}</Badge>
          </div>
          {equipment.category && <p className="text-gray-400 mt-1 text-sm">{equipment.category}</p>}
        </div>
        {user?.isAdmin && (
          <button onClick={() => setShowEdit(true)} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#2a2f3e] text-gray-400 hover:text-white hover:border-[#35B2FF]/40 transition-colors">
            Edit
          </button>
        )}
      </div>

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-6 mb-4">
        <h3 className="text-sm font-semibold text-white mb-4">Details</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <InfoRow label="Serial Number" value={equipment.serialNumber} />
          <InfoRow label="Checked Out To" value={equipment.currentHolderName} />
          {checkedOutSince && <InfoRow label="Since" value={checkedOutSince} />}
          <InfoRow label="Notes" value={equipment.notes} span />
        </dl>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-white mb-3">Actions</h3>
        <div className="flex flex-wrap gap-2">
          {user?.isAdmin && equipment.status !== "inRepair" && equipment.status !== "retired" && (
            <Btn onClick={() => setShowAssign(true)} disabled={acting} color="blue">
              {equipment.status === "checkedOut" ? "Reassign" : "Assign to Employee"}
            </Btn>
          )}
          {canReturn && activeCheckout && (
            <Btn onClick={returnEquipment} disabled={acting} color="green">Return Equipment</Btn>
          )}
          {equipment.status !== "retired" && !openRepair && (
            <Btn onClick={() => setShowReport(true)} disabled={acting} color="yellow">Report Issue</Btn>
          )}
          {openRepair && equipment.status !== "retired" && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-400/10 text-orange-400 border border-orange-400/20">
              Repair {openRepair.status}
            </span>
          )}
          {user?.isAdmin && equipment.status === "inRepair" && openRepair && (
            <Btn onClick={resolveRepair} disabled={acting} color="green">Mark Repair Complete</Btn>
          )}
          {user?.isAdmin && (
            equipment.status === "retired"
              ? <Btn onClick={unretireEquipment} disabled={acting} color="blue">Reactivate</Btn>
              : <Btn onClick={() => setShowRetire(true)} disabled={acting} color="red">Retire</Btn>
          )}
        </div>
      </div>

      <Section title="Assignment History" count={checkouts.length}>
        {checkouts.length === 0 ? (
          <p className="text-gray-500 text-sm px-6 py-4">No checkout history</p>
        ) : checkouts.map((c) => (
          <div key={c.id} className="px-6 py-3.5 border-t border-[#2a2f3e] first:border-0 text-sm">
            <p className="text-white font-medium">{c.employeeName}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {formatDate(c.checkedOutAt)} {c.returnedAt ? `→ ${formatDate(c.returnedAt)}` : "· Still out"}
            </p>
            {c.notes && <p className="text-gray-500 text-xs">{c.notes}</p>}
          </div>
        ))}
      </Section>

      <Section title="Repair History" count={repairs.length}>
        {repairs.length === 0 ? (
          <p className="text-gray-500 text-sm px-6 py-4">No repair history</p>
        ) : repairs.map((r) => (
          <div key={r.id} className="px-6 py-3.5 border-t border-[#2a2f3e] first:border-0 text-sm">
            <div className="flex justify-between items-start gap-2">
              <p className="text-white font-medium">{r.description}</p>
              <RepairBadge status={r.status} />
            </div>
            <p className="text-gray-500 text-xs mt-0.5">By {r.reportedByName} · {formatDate(r.reportedAt)}</p>
            {r.responseNote && <p className="text-gray-400 text-xs mt-0.5">{r.responseNote}</p>}
          </div>
        ))}
      </Section>

      {showAssign && (
        <AssignModal title={equipment.status === "checkedOut" ? "Reassign Equipment" : "Assign Equipment"} itemName={equipment.name} employees={employees} currentUID={equipment.currentHolderUID} onSave={assignToEmployee} onClose={() => setShowAssign(false)} saving={acting} />
      )}
      {showReport && (
        <ReportModal itemName={equipment.name} onSave={reportRepair} onClose={() => setShowReport(false)} saving={acting} />
      )}
      {showEdit && (
        <EditEquipmentModal equipment={equipment} onSave={editEquipment} onClose={() => setShowEdit(false)} saving={acting} />
      )}
      {showRetire && (
        <ConfirmModal title="Retire Equipment" message={`Mark "${equipment.name}" as retired? Any active assignment will be closed. History is preserved.`} confirmLabel="Retire" danger onConfirm={retireEquipment} onClose={() => setShowRetire(false)} confirming={acting} />
      )}
    </div>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function Btn({ onClick, disabled, color, children }: { onClick: () => void; disabled: boolean; color: "blue"|"green"|"yellow"|"red"; children: React.ReactNode }) {
  const c = { blue: "bg-[#35B2FF]/10 text-[#35B2FF] border-[#35B2FF]/20 hover:bg-[#35B2FF]/20", green: "bg-green-400/10 text-green-400 border-green-400/20 hover:bg-green-400/20", yellow: "bg-amber-400/10 text-amber-400 border-amber-400/20 hover:bg-amber-400/20", red: "bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20" };
  return <button onClick={onClick} disabled={disabled} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${c[color]}`}>{children}</button>;
}

function InfoRow({ label, value, span }: { label: string; value?: string | null; span?: boolean }) {
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

function RepairBadge({ status }: { status: string }) {
  const m: Record<string, string> = { reported: "bg-red-400/15 text-red-400", approved: "bg-blue-400/15 text-[#35B2FF]", rejected: "bg-gray-400/15 text-gray-400", inProgress: "bg-orange-400/15 text-orange-400", completed: "bg-green-400/15 text-green-400" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${m[status] ?? "bg-gray-400/15 text-gray-400"}`}>{status}</span>;
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

function AssignModal({ title, itemName, employees, currentUID, onSave, onClose, saving }: { title: string; itemName: string; employees: Employee[]; currentUID?: string; onSave: (e: Employee, notes: string) => void; onClose: () => void; saving: boolean }) {
  const [selected, setSelected] = useState<Employee | null>(employees.find((e) => e.id === currentUID) ?? employees[0] ?? null);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const filtered = employees.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-gray-400 mb-3">{itemName}</p>
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
        <button onClick={() => selected && onSave(selected, notes)} disabled={!selected || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Assign"}</button>
      </div>
    </Modal>
  );
}

function ReportModal({ itemName, onSave, onClose, saving }: { itemName: string; onSave: (d: string) => void; onClose: () => void; saving: boolean }) {
  const [description, setDescription] = useState("");
  return (
    <Modal title="Report Issue" onClose={onClose}>
      <p className="text-sm text-gray-400 mb-3">{itemName}</p>
      <textarea placeholder="Describe the issue or what needs repair…" value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-none h-24 mb-4`} />
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
        <button onClick={() => onSave(description)} disabled={!description.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 transition-colors disabled:opacity-50">{saving ? "Submitting…" : "Submit"}</button>
      </div>
    </Modal>
  );
}

function EditEquipmentModal({ equipment, onSave, onClose, saving }: { equipment: Equipment; onSave: (n: string, c: string, s: string, notes: string) => void; onClose: () => void; saving: boolean }) {
  const [name, setName] = useState(equipment.name);
  const [category, setCategory] = useState(equipment.category ?? "");
  const [serialNumber, setSerialNumber] = useState(equipment.serialNumber ?? "");
  const [notes, setNotes] = useState(equipment.notes ?? "");
  return (
    <Modal title="Edit Equipment" onClose={onClose}>
      <div className="space-y-3 mb-4">
        {[["Name", name, setName], ["Category", category, setCategory], ["Serial Number", serialNumber, setSerialNumber]].map(([label, val, setter]) => (
          <div key={label as string}>
            <label className="block text-xs text-gray-500 mb-1">{label as string}</label>
            <input value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className={inputCls} />
          </div>
        ))}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none h-20`} />
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
        <button onClick={() => onSave(name, category, serialNumber, notes)} disabled={!name.trim() || !category.trim() || saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
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
