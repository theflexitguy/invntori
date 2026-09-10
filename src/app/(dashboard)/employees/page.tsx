"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Sheet, SheetActions, PrimaryButton } from "@/components/ui/Sheet";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      <PageHeader
        title="Employees"
        subtitle={`${active.length} active · ${inactive.length} inactive`}
      />

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 bg-[#1C1C1E] rounded-[14px] sm:rounded-lg px-4 py-2.5 sm:py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]"
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
        <Sheet title={selected.name} subtitle={selected.email ?? "No email"} onClose={() => setSelected(null)}>
          <div>
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
              <div className="mt-6 pt-5 border-t border-[#2C2C2E] space-y-2">
                <button
                  onClick={() => { setEditing(selected); setSelected(null); }}
                  className="w-full py-3 rounded-xl text-sm font-medium bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/20 hover:bg-[#0A84FF]/25 transition-colors"
                >
                  Edit Role &amp; Permissions
                </button>
                <button
                  onClick={() => toggleActive(selected)}
                  disabled={toggling === selected.id}
                  className={`w-full py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
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
        </Sheet>
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
    <div className="bg-[#1C1C1E] rounded-[14px] overflow-hidden">
      <div className="px-4 sm:px-6 py-3 border-b border-[#2C2C2E] flex items-center gap-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
        <span className="text-xs text-gray-600">({count})</span>
      </div>
      <div className="divide-y divide-[#38383A]">{children}</div>
    </div>
  );
}

function EmployeeRow({ emp, isAdmin, toggling, onSelect, onToggle }: {
  emp: Employee; isAdmin: boolean; toggling: boolean;
  onSelect: () => void; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-white/[0.02] transition-colors">
      <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onSelect}>
        <div className="w-8 h-8 rounded-full bg-[#0A84FF]/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-[#0A84FF]">{emp.name[0].toUpperCase()}</span>
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
          className={`ml-2 shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
            emp.isActive !== false
              ? "border-[#2C2C2E] text-gray-500 hover:text-red-400 hover:border-red-400/30"
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
    <div className="flex items-center justify-between py-2 border-b border-[#2C2C2E] last:border-0">
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

  return (
    <Sheet
      title={`Edit ${emp.name}`}
      subtitle="Role & Permissions"
      onClose={onClose}
      footer={
        <SheetActions onCancel={onClose}>
          <PrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </PrimaryButton>
        </SheetActions>
      }
    >
      <div className="space-y-4">
          {/* Role */}
          <div className="bg-[#2C2C2E] border border-[#2C2C2E] rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</p>
            <ToggleRow label="Admin" description="Full access to all features" checked={isAdmin} onChange={setIsAdmin} />
            {!isAdmin && (
              <ToggleRow label="Manager" description="Elevated access based on permissions below" checked={isManager} onChange={setIsManager} />
            )}
          </div>

          {/* Permissions (only for managers, not admins) */}
          {!isAdmin && (
            <div className="bg-[#2C2C2E] border border-[#2C2C2E] rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Manager Permissions</p>
              {PERMISSION_KEYS.map(({ key, label }) => (
                <ToggleRow key={key} label={label} checked={permissions.has(key)} onChange={() => togglePerm(key)} />
              ))}
            </div>
          )}
      </div>
    </Sheet>
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
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`relative shrink-0 w-11 rounded-full transition-colors mt-0.5 ${checked ? "bg-[#0A84FF]" : "bg-[#3A3A3C]"}`}
        style={{ height: "26px" }}
      >
        <span className={`absolute top-0.5 w-[22px] h-[22px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[20px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
