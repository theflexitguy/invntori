"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import type { Employee } from "@/lib/types";

const PERMISSION_KEYS = [
  { key: "manageInventory",      label: "Manage Inventory" },
  { key: "manageRequests",       label: "Manage Requests" },
  { key: "managePurchaseOrders", label: "Manage Purchase Orders" },
  { key: "manageEquipment",      label: "Manage Equipment" },
  { key: "manageFleet",          label: "Manage Fleet" },
  { key: "manageEmployees",      label: "Manage Employees" },
  { key: "deleteProducts",       label: "Delete Products" },
  { key: "deleteEquipment",      label: "Delete Equipment" },
  { key: "deleteFleet",          label: "Delete Fleet Vehicles" },
  { key: "deleteEmployees",      label: "Delete Employees" },
] as const;

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const snap = await getDocs(collection(db, "companies", user.companyID, "Employees"));
    setEmployees(
      snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Employee, "id">) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    );
    setLoading(false);
  }

  async function toggleActive(emp: Employee) {
    if (!user?.companyID || !emp.id) return;
    setToggling(emp.id);
    try {
      const newState = !emp.isActive;
      await updateDoc(doc(db, "companies", user.companyID, "Employees", emp.id), { isActive: newState });
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, isActive: newState } : e));
      if (selected?.id === emp.id) setSelected({ ...selected, isActive: newState });
    } finally {
      setToggling(null);
    }
  }

  async function saveEmployeeEdit(emp: Employee, isAdmin: boolean, isManager: boolean, permissions: string[]) {
    if (!user?.companyID || !emp.id) return;
    await updateDoc(doc(db, "companies", user.companyID, "Employees", emp.id), {
      isAdmin,
      isManager: isAdmin ? false : isManager,
      managePermissions: permissions,
    });
    const updated = { ...emp, isAdmin, isManager: isAdmin ? false : isManager, managePermissions: permissions };
    setEmployees((prev) => prev.map((e) => e.id === emp.id ? updated : e));
    if (selected?.id === emp.id) setSelected(updated);
    setEditing(null);
  }

  const { active, inactive } = useMemo(() => {
    const q = search.toLowerCase();
    const match = (e: Employee) =>
      !q || e.name.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q);
    return {
      active: employees.filter((e) => e.isActive !== false && match(e)),
      inactive: employees.filter((e) => e.isActive === false && match(e)),
    };
  }, [employees, search]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }

  return (
    <div className="p-6 xl:p-8 w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Employees</h2>
        <p className="text-gray-400 mt-1 text-sm">{active.length} active · {inactive.length} inactive</p>
      </div>

      <div className="mb-5">
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] w-72"
        />
      </div>

      <div className="space-y-6">
        <Section title="Active" count={active.length}>
          {active.map((emp) => (
            <EmployeeRow
              key={emp.id}
              emp={emp}
              isAdmin={user?.isAdmin ?? false}
              toggling={toggling === emp.id}
              onSelect={() => setSelected(emp)}
              onToggle={() => toggleActive(emp)}
            />
          ))}
        </Section>

        {inactive.length > 0 && (
          <Section title="Inactive" count={inactive.length}>
            {inactive.map((emp) => (
              <EmployeeRow
                key={emp.id}
                emp={emp}
                isAdmin={user?.isAdmin ?? false}
                toggling={toggling === emp.id}
                onSelect={() => setSelected(emp)}
                onToggle={() => toggleActive(emp)}
              />
            ))}
          </Section>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#35B2FF]/20 flex items-center justify-center">
                  <span className="font-semibold text-[#35B2FF]">{selected.name[0].toUpperCase()}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{selected.name}</p>
                    <span className={`w-2 h-2 rounded-full ${selected.isActive !== false ? "bg-green-400" : "bg-gray-500"}`} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{selected.email ?? "No email"}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <DetailRow label="Role">
                <div className="flex gap-2">
                  {selected.isAdmin && <Badge variant="red">Admin</Badge>}
                  {selected.isManager && !selected.isAdmin && <Badge variant="purple">Manager</Badge>}
                  {!selected.isAdmin && !selected.isManager && <Badge variant="gray">Employee</Badge>}
                </div>
              </DetailRow>
              <DetailRow label="Status">
                <span className={selected.isActive !== false ? "text-green-400" : "text-gray-500"}>
                  {selected.isActive !== false ? "Active" : "Inactive"}
                </span>
              </DetailRow>
              {selected.managePermissions && selected.managePermissions.length > 0 && (
                <DetailRow label="Permissions">
                  <span className="text-gray-400 text-xs">{selected.managePermissions.length} granted</span>
                </DetailRow>
              )}
            </div>

            {user?.isAdmin && (
              <div className="mt-6 pt-5 border-t border-[#2a2f3e] space-y-2">
                <button
                  onClick={() => { setEditing(selected); setSelected(null); }}
                  className="w-full py-2.5 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors"
                >
                  Edit Role & Permissions
                </button>
                <button
                  onClick={() => toggleActive(selected)}
                  disabled={toggling === selected.id}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    selected.isActive !== false
                      ? "bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25"
                      : "bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25"
                  }`}
                >
                  {selected.isActive !== false ? "Deactivate Employee" : "Reactivate Employee"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditEmployeeModal
          emp={editing}
          onSave={saveEmployeeEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
      <div className="px-6 py-3 border-b border-[#2a2f3e] flex items-center gap-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
        <span className="text-xs text-gray-600">({count})</span>
      </div>
      <div className="divide-y divide-[#2a2f3e]">{children}</div>
    </div>
  );
}

function EmployeeRow({ emp, isAdmin, toggling, onSelect, onToggle }: {
  emp: Employee; isAdmin: boolean; toggling: boolean;
  onSelect: () => void; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
      <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onSelect}>
        <div className="w-8 h-8 rounded-full bg-[#35B2FF]/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-[#35B2FF]">{emp.name[0].toUpperCase()}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-white truncate">{emp.name}</p>
            {emp.isAdmin && <Badge variant="red">Admin</Badge>}
            {emp.isManager && !emp.isAdmin && <Badge variant="purple">Manager</Badge>}
          </div>
          <p className="text-xs text-gray-500 truncate">{emp.email ?? "—"}</p>
        </div>
      </button>
      {isAdmin && (
        <button
          onClick={onToggle}
          disabled={toggling}
          className={`ml-3 shrink-0 px-3 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
            emp.isActive !== false
              ? "border-[#2a2f3e] text-gray-500 hover:text-red-400 hover:border-red-400/30"
              : "border-green-500/20 text-green-400 hover:bg-green-500/10"
          }`}
        >
          {emp.isActive !== false ? "Deactivate" : "Reactivate"}
        </button>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2a2f3e] last:border-0">
      <span className="text-gray-500">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function EditEmployeeModal({ emp, onSave, onClose }: {
  emp: Employee;
  onSave: (emp: Employee, isAdmin: boolean, isManager: boolean, permissions: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [isAdmin, setIsAdmin] = useState(emp.isAdmin ?? false);
  const [isManager, setIsManager] = useState(emp.isManager ?? false);
  const [permissions, setPermissions] = useState<Set<string>>(new Set(emp.managePermissions ?? []));
  const [saving, setSaving] = useState(false);

  function togglePerm(key: string) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try { await onSave(emp, isAdmin, isAdmin ? false : isManager, Array.from(permissions)); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-6 w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-white">Edit {emp.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Role &amp; Permissions</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Role */}
          <div className="bg-[#0d1117] border border-[#2a2f3e] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</p>
            <ToggleRow label="Admin" description="Full access to all features" checked={isAdmin} onChange={setIsAdmin} />
            {!isAdmin && (
              <ToggleRow label="Manager" description="Elevated access based on permissions below" checked={isManager} onChange={setIsManager} />
            )}
          </div>

          {/* Permissions (only for managers, not admins) */}
          {!isAdmin && (
            <div className="bg-[#0d1117] border border-[#2a2f3e] rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Manager Permissions</p>
              {PERMISSION_KEYS.map(({ key, label }) => (
                <ToggleRow key={key} label={label} checked={permissions.has(key)} onChange={() => togglePerm(key)} />
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-[#2a2f3e]">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-[#2a2f3e] text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-white">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-5.5 rounded-full transition-colors mt-0.5 ${checked ? "bg-[#35B2FF]" : "bg-[#2a2f3e]"}`}
        style={{ height: "22px" }}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
