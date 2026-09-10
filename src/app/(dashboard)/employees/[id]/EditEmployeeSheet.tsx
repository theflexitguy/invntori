"use client";

import { useState } from "react";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { Sheet } from "@/components/ui/Sheet";
import { CardSection, Switch } from "@/components/ui/ios";
import {
  PersonIcon, PersonGroupIcon, PeopleIcon, EnvelopeIcon, BuildingIcon,
  FieldsIcon, LinkIcon, SlidersIcon, CheckCircleIcon, CircleIcon,
} from "@/components/layout/nav";
import { PERMISSION_KEYS } from "@/lib/permissions";
import type { Employee, Office } from "@/lib/types";

const inputCls =
  "flex-1 min-w-0 bg-[#000000] rounded-[8px] px-3 py-2 text-[17px] text-white placeholder-[rgba(235,235,245,0.3)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]";

/** Modal editor mirroring the native Edit Employee sheet. */
export function EditEmployeeSheet({
  employee,
  offices,
  onSave,
  onClose,
}: {
  employee: Employee;
  offices: Office[];
  onSave: (patch: Partial<Employee>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email ?? "");
  const [isAdmin, setIsAdmin] = useState(!!employee.isAdmin);
  const [isManager, setIsManager] = useState(!!employee.isManager);
  const [officeIDs, setOfficeIDs] = useState<string[]>(employee.officeIDs ?? []);
  const [frID, setFrID] = useState(
    employee.fieldroutesEmployeeID != null ? String(employee.fieldroutesEmployeeID) : ""
  );
  const [permissions, setPermissions] = useState<Set<string>>(
    new Set(employee.managePermissions ?? [])
  );
  const [fields, setFields] = useState<{ key: string; value: string }[]>(
    Object.entries(employee.customFields ?? {}).map(([key, value]) => ({ key, value }))
  );
  const [saving, setSaving] = useState(false);
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  function toggleOffice(id: string) {
    setOfficeIDs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function togglePermission(key: string) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const customFields: Record<string, string> = {};
      for (const { key, value } of fields) {
        if (key.trim()) customFields[key.trim()] = value.trim();
      }
      const parsedFr = parseInt(frID, 10);
      await onSave({
        name: name.trim(),
        email: email.trim() || undefined,
        isAdmin,
        isManager: isAdmin ? false : isManager,
        officeIDs,
        managePermissions: isAdmin ? [] : Array.from(permissions),
        customFields,
        fieldroutesEmployeeID: !isNaN(parsedFr) && parsedFr >= 0 ? parsedFr : undefined,
      });
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    const target = email.trim();
    if (!target) return;
    setResetState("sending");
    try {
      await sendPasswordResetEmail(getAuth(), target);
      setResetState("sent");
    } catch {
      setResetState("error");
    }
  }

  return (
    <Sheet size="lg" onClose={onClose}>
      <div className="sticky top-0 z-10 -mx-5 sm:-mx-6 px-5 sm:px-6 pt-1 pb-3 bg-[#1C1C1E] flex items-center justify-between gap-3">
        <button
          onClick={onClose}
          className="bg-[#2C2C2E] rounded-full px-4 py-2 text-[15px] font-medium text-[#FF453A] active:opacity-70 transition-opacity"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-[#2C2C2E] rounded-full px-4 py-2 text-[15px] font-semibold text-white active:opacity-70 transition-opacity disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <h2 className="ios-large-title text-white mb-4">Edit Employee</h2>

      <div className="space-y-4">
        <CardSection Icon={PersonIcon} title="Employee Info">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <PersonIcon className="w-[19px] h-[19px] text-white shrink-0" />
              <label className="text-[17px] text-white shrink-0">Name:</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-center gap-3">
              <EnvelopeIcon className="w-[19px] h-[19px] text-white shrink-0" />
              <label className="text-[17px] text-white shrink-0">Email:</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                className={inputCls}
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <PersonGroupIcon className="w-[19px] h-[19px] text-[#BF5AF2] shrink-0" />
              <span className="text-[17px] text-white flex-1 min-w-0">Admin (Full Access)</span>
              <Switch checked={isAdmin} onChange={setIsAdmin} label="Admin" />
            </div>
            <div className="flex items-center gap-3">
              <PeopleIcon className="w-[19px] h-[19px] text-[#30D158] shrink-0" />
              <span className="text-[17px] text-white flex-1 min-w-0">Manager (Custom Access)</span>
              <Switch
                checked={isManager && !isAdmin}
                onChange={setIsManager}
                label="Manager"
              />
            </div>
          </div>
        </CardSection>

        <CardSection Icon={BuildingIcon} title="Office Assignment">
          {offices.length === 0 ? (
            <p className="text-[15px] text-[rgba(235,235,245,0.3)] py-1">No offices configured.</p>
          ) : (
            <div className="space-y-1">
              {offices.map((o) => {
                const on = officeIDs.includes(o.id!);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleOffice(o.id!)}
                    className="w-full flex items-center gap-3 py-2 text-left"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: o.colorHex ?? "#0A84FF" }}
                    />
                    <span className="flex-1 min-w-0 text-[17px] text-white break-words">{o.name}</span>
                    {on ? (
                      <CheckCircleIcon className="w-[22px] h-[22px] text-[#0A84FF] shrink-0" />
                    ) : (
                      <CircleIcon className="w-[22px] h-[22px] text-[rgba(235,235,245,0.3)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardSection>

        <CardSection Icon={LinkIcon} title="FieldRoutes Integration">
          <div className="flex items-center gap-3">
            <span className="text-[17px] text-[rgba(235,235,245,0.6)] shrink-0">#</span>
            <label className="text-[17px] text-[rgba(235,235,245,0.6)] shrink-0">Employee ID:</label>
            <input
              value={frID}
              onChange={(e) => setFrID(e.target.value)}
              inputMode="numeric"
              placeholder="—"
              className={inputCls}
            />
          </div>
          <p className="text-[13px] text-[rgba(235,235,245,0.6)] mt-2 leading-snug">
            Links this employee to their FieldRoutes account for inventory auditing.
          </p>
        </CardSection>

        {!isAdmin && isManager && (
          <CardSection Icon={SlidersIcon} title="Manager Permissions">
            <div className="space-y-1">
              {PERMISSION_KEYS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => togglePermission(p.key)}
                  className="w-full flex items-center gap-3 py-2 text-left"
                >
                  <span className="flex-1 min-w-0 text-[17px] text-white">{p.label}</span>
                  {permissions.has(p.key) ? (
                    <CheckCircleIcon className="w-[22px] h-[22px] text-[#0A84FF] shrink-0" />
                  ) : (
                    <CircleIcon className="w-[22px] h-[22px] text-[rgba(235,235,245,0.3)] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </CardSection>
        )}

        <CardSection
          Icon={FieldsIcon}
          title="Custom Fields"
          action={
            <button
              onClick={() => setFields((prev) => [...prev, { key: "", value: "" }])}
              aria-label="Add custom field"
              className="w-6 h-6 rounded-full bg-[#30D158] text-black flex items-center justify-center active:opacity-70 transition-opacity"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          }
        >
          {fields.length === 0 ? (
            <p className="text-[15px] text-[rgba(235,235,245,0.3)] py-1">No custom fields.</p>
          ) : (
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={f.key}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
                    }
                    placeholder="Field name"
                    className={inputCls}
                  />
                  <input
                    value={f.value}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                    }
                    placeholder="Value"
                    className={inputCls}
                  />
                  <button
                    onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Remove field"
                    className="p-2 -mr-1 rounded-lg text-[rgba(235,235,245,0.3)] active:bg-white/5 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardSection>

        {error && <p className="text-[#FF453A] text-[15px]">{error}</p>}

        <button
          onClick={handleResetPassword}
          disabled={!email.trim() || resetState === "sending" || resetState === "sent"}
          className="text-[17px] text-[#FF453A] py-2 disabled:opacity-50"
        >
          {resetState === "sent"
            ? "Password reset email sent"
            : resetState === "sending"
              ? "Sending…"
              : resetState === "error"
                ? "Couldn't send — try again"
                : "Reset Password"}
        </button>
      </div>
    </Sheet>
  );
}
