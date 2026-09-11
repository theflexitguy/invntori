"use client";

import { useAuth } from "@/context/AuthContext";
import { AccountBar } from "@/components/layout/AccountBar";
import { Group, GroupRow, SectionHeader, LargeTitle } from "@/components/ui/ios";
import { BoxIcon, RequestsIcon, ToolsIcon, SparklesIcon } from "@/components/layout/nav";

/** Account screen for non-admins — the tab bar's fifth slot. */
export default function AccountPage() {
  const { user } = useAuth();

  const role = user?.isAdmin ? "Admin" : user?.isManager ? "Manager" : "Employee";

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full">
      <LargeTitle title="Account" />
      <AccountBar />

      <div className="space-y-7 mt-6">
        <section>
          <SectionHeader>Details</SectionHeader>
          <Group>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5 border-b border-[#38383A]/60">
              <span className="text-[17px] text-white">Role</span>
              <span className="text-[17px] text-[rgba(235,235,245,0.6)]">{role}</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <span className="text-[17px] text-white">Company</span>
              <span className="text-[17px] text-[rgba(235,235,245,0.6)] truncate ml-4">
                {user?.companyID || "—"}
              </span>
            </div>
          </Group>
        </section>

        <section>
          <SectionHeader>Shortcuts</SectionHeader>
          <Group>
            <GroupRow href="/inventory" Icon={BoxIcon} label="Inventory" />
            <GroupRow href="/equipment" Icon={ToolsIcon} label="Equipment" />
            <GroupRow href="/requests" Icon={RequestsIcon} label="My Requests" />
            <GroupRow href="/chat" Icon={SparklesIcon} label="Ask invntori" last />
          </Group>
        </section>
      </div>
    </div>
  );
}
