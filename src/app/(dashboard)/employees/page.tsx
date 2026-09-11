"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { SearchField, SectionHeader } from "@/components/ui/ios";
import { NavBarTitle } from "@/components/layout/NavBarSlot";
import {
  ChevronRightIcon, PersonIcon, PersonGroupIcon, PeopleIcon,
} from "@/components/layout/nav";
import type { Employee } from "@/lib/types";

export default function EmployeesPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyID]);

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
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-2xl">
      {/* A pushed screen — inline title, like the native Manage Employees view */}
      <NavBarTitle>
        <h1 className="text-[17px] font-semibold text-white truncate">Manage Employees</h1>
      </NavBarTitle>

      <div className="mb-4 mt-1">
        <SearchField value={search} onChange={setSearch} placeholder="Search..." />
      </div>

      <EmployeeSection title="Active" employees={active} />
      {inactive.length > 0 && (
        <div className="mt-7">
          <EmployeeSection title="Inactive" employees={inactive} />
        </div>
      )}

      {active.length === 0 && inactive.length === 0 && (
        <p className="text-center text-[17px] text-[rgba(235,235,245,0.3)] py-16">
          No employees found.
        </p>
      )}
    </div>
  );
}

function EmployeeSection({ title, employees }: { title: string; employees: Employee[] }) {
  if (employees.length === 0) return null;
  return (
    <section>
      <SectionHeader>
        {title} ({employees.length})
      </SectionHeader>
      <div className="space-y-0">
        {employees.map((emp, i) => (
          <div key={emp.id}>
            <EmployeeCard emp={emp} />
            {i < employees.length - 1 && (
              <div className="border-t border-[#38383A]/70 my-3 ml-8" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Each employee is its own card with the chevron sitting outside it, matching
 * the native list.
 */
function EmployeeCard({ emp }: { emp: Employee }) {
  const RoleIcon = emp.isAdmin ? PersonGroupIcon : emp.isManager ? PeopleIcon : PersonIcon;
  const roleTint = emp.isAdmin
    ? "text-[#BF5AF2]"
    : emp.isManager
      ? "text-[#30D158]"
      : "text-[#0A84FF]";
  const roleLabel = emp.isAdmin ? "Admin" : emp.isManager ? "Manager" : "Employee";

  return (
    <Link href={`/employees/${emp.id}`} className="flex items-center gap-2 group">
      <div className="flex-1 min-w-0 flex items-center gap-3 bg-[#1C1C1E] rounded-[12px] px-4 py-3.5 group-active:bg-[#2C2C2E] transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-semibold text-white truncate">{emp.name}</p>
          <p className="text-[15px] text-[rgba(235,235,245,0.6)] truncate">{emp.email ?? "—"}</p>
        </div>
        <span title={roleLabel} className="shrink-0">
          <RoleIcon className={`w-[22px] h-[22px] ${roleTint}`} />
        </span>
      </div>
      <ChevronRightIcon className="w-[14px] h-[14px] text-[rgba(235,235,245,0.3)] shrink-0" />
    </Link>
  );
}
