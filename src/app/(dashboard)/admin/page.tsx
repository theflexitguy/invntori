"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { adminSections } from "@/components/layout/nav";
import { Group, GroupRow, SectionHeader } from "@/components/ui/ios";
import { AccountBar } from "@/components/layout/AccountBar";

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !user.isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (!user?.isAdmin) return null;

  return (
    <div className="px-4 sm:px-6 xl:px-8 pt-1 pb-6 w-full max-w-2xl">
      <AccountBar />

      <div className="space-y-7 mt-6">
        {adminSections.map((section) => (
          <section key={section.label}>
            <SectionHeader>{section.label}</SectionHeader>
            <Group>
              {section.items.map((item, i) => (
                <GroupRow
                  key={item.href}
                  href={item.href}
                  Icon={item.Icon}
                  label={item.label}
                  last={i === section.items.length - 1}
                />
              ))}
            </Group>
          </section>
        ))}
      </div>
    </div>
  );
}
