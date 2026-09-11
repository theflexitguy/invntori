"use client";

import { useEffect, useState, use, useCallback } from "react";
import { doc, getDoc, collection, getDocs, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { LargeTitle, CardSection, InfoRow, Switch } from "@/components/ui/ios";
import {
  PersonIcon, PersonGroupIcon, PeopleIcon, EnvelopeIcon, BuildingIcon, FieldsIcon,
  SlidersIcon,
} from "@/components/layout/nav";
import { EditEmployeeSheet } from "./EditEmployeeSheet";
import { PERMISSION_KEYS } from "@/lib/permissions";
import type { Employee, Office } from "@/lib/types";


export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    if (!user?.companyID) return;
    const cid = user.companyID;
    const [empDoc, officeSnap] = await Promise.all([
      getDoc(doc(db, "companies", cid, "Employees", id)),
      getDocs(collection(db, "companies", cid, "offices")),
    ]);
    if (empDoc.exists()) {
      setEmployee({ id: empDoc.id, ...(empDoc.data() as Omit<Employee, "id">) });
    }
    setOffices(officeSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Office, "id">) })));
    setLoading(false);
  }, [user?.companyID, id]);

  useEffect(() => {
    if (user?.companyID) load();
  }, [user?.companyID, load]);

  async function toggleActive() {
    if (!user?.companyID || !employee?.id) return;
    setActing(true);
    setError(null);
    try {
      const next = employee.isActive === false;
      await updateDoc(doc(db, "companies", user.companyID, "Employees", employee.id), {
        isActive: next,
      });
      setEmployee((prev) => (prev ? { ...prev, isActive: next } : prev));
    } catch {
      setError("Failed to update status.");
    } finally {
      setActing(false);
    }
  }

  async function saveEdit(patch: Partial<Employee>) {
    if (!user?.companyID || !employee?.id) return;
    const payload: Record<string, unknown> = { ...patch };
    // Firestore rejects `undefined`; clear the field instead.
    if (patch.fieldroutesEmployeeID === undefined) payload.fieldroutesEmployeeID = deleteField();
    await updateDoc(doc(db, "companies", user.companyID, "Employees", employee.id), payload);
    setEmployee((prev) => (prev ? { ...prev, ...patch } : prev));
    setShowEdit(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;
  }
  if (!employee) {
    return (
      <div className="px-4 py-10 text-center text-[17px] text-[rgba(235,235,245,0.6)]">
        Employee not found.
      </div>
    );
  }

  const isActive = employee.isActive !== false;
  const assigned = offices.filter((o) => employee.officeIDs?.includes(o.id!));
  const grantedPermissions = PERMISSION_KEYS.filter((p) =>
    employee.managePermissions?.includes(p.key)
  );
  const customFields = Object.entries(employee.customFields ?? {});

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      <LargeTitle title="Employee Details" />

      {user?.isAdmin && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setShowEdit(true)}
            className="py-3 rounded-[12px] text-[17px] font-medium bg-[#0A84FF]/15 text-[#0A84FF] active:bg-[#0A84FF]/25 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={toggleActive}
            disabled={acting}
            className={`py-3 rounded-[12px] text-[17px] font-medium transition-colors disabled:opacity-50 ${
              isActive
                ? "bg-[#FF9F0A]/15 text-[#FF9F0A] active:bg-[#FF9F0A]/25"
                : "bg-[#30D158]/15 text-[#30D158] active:bg-[#30D158]/25"
            }`}
          >
            {acting ? "…" : isActive ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      )}

      {error && <p className="text-[#FF453A] text-[15px] mb-4">{error}</p>}

      <div className="space-y-4">
        <CardSection Icon={PersonIcon} title="Employee Info">
          <InfoRow
            Icon={PersonIcon}
            label={employee.name}
            trailing={
              <span className="flex items-center gap-1.5 shrink-0">
                <span className={`w-2 h-2 rounded-full ${isActive ? "bg-[#30D158]" : "bg-[rgba(235,235,245,0.3)]"}`} />
                <span className={`text-[15px] ${isActive ? "text-[#30D158]" : "text-[rgba(235,235,245,0.6)]"}`}>
                  {isActive ? "Active" : "Inactive"}
                </span>
              </span>
            }
          />
          <InfoRow Icon={EnvelopeIcon} label={employee.email ?? "No email"} />
          <InfoRow
            Icon={PersonGroupIcon}
            iconClass="text-[#BF5AF2]"
            label="Admin"
            trailing={<Switch checked={!!employee.isAdmin} onChange={() => setShowEdit(true)} label="Admin" />}
          />
          <InfoRow
            Icon={PeopleIcon}
            iconClass="text-[#30D158]"
            label="Manager"
            trailing={<Switch checked={!!employee.isManager} onChange={() => setShowEdit(true)} label="Manager" />}
          />
        </CardSection>

        <CardSection Icon={BuildingIcon} title="Office Assignment">
          {assigned.length === 0 ? (
            <p className="text-[15px] text-[rgba(235,235,245,0.3)] text-center py-1">
              No offices assigned
            </p>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {assigned.map((o) => (
                <span key={o.id} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: o.colorHex ?? "#0A84FF" }}
                  />
                  <span className="text-[17px] text-white">{o.name}</span>
                </span>
              ))}
            </div>
          )}
        </CardSection>

        <CardSection Icon={FieldsIcon} title="Custom Fields">
          {customFields.length === 0 ? (
            <p className="text-[15px] text-[rgba(235,235,245,0.3)] text-center py-1">
              No custom fields
            </p>
          ) : (
            <div className="space-y-1">
              {customFields.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-[15px] text-[rgba(235,235,245,0.6)] min-w-0 break-words">{key}</span>
                  <span className="text-[17px] text-white text-right min-w-0 break-words">{value}</span>
                </div>
              ))}
            </div>
          )}
        </CardSection>

        <CardSection Icon={SlidersIcon} title="Manager Permissions">
          {!employee.isManager ? (
            <p className="text-[15px] text-[rgba(235,235,245,0.3)] text-center py-1">
              This employee is not a Manager.
            </p>
          ) : grantedPermissions.length === 0 ? (
            <p className="text-[15px] text-[rgba(235,235,245,0.3)] text-center py-1">
              No permissions granted.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {grantedPermissions.map((p) => (
                <span
                  key={p.key}
                  className="px-2.5 py-1 rounded-full bg-[#0A84FF]/15 text-[#0A84FF] text-[13px] font-medium"
                >
                  {p.label}
                </span>
              ))}
            </div>
          )}
        </CardSection>
      </div>

      {showEdit && (
        <EditEmployeeSheet
          employee={employee}
          offices={offices}
          onSave={saveEdit}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
