"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import {
  mainNav,
  adminSections,
  ADMIN_PATHS,
  isActivePath,
  ChevronDownIcon,
  AdminIcon,
  SignOutIcon,
} from "./nav";

/** Desktop sidebar. Phones use the floating tab bar instead. */
export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const isAdminPath = ADMIN_PATHS.some((p) => isActivePath(pathname, p));
  const [adminOpen, setAdminOpen] = useState(isAdminPath);

  useEffect(() => {
    if (isAdminPath) setAdminOpen(true);
  }, [isAdminPath]);

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-full bg-[#000000] border-r border-[#1C1C1E]">
      {/* Logo */}
      <div className="px-5 pt-[calc(1rem+var(--safe-top))] pb-4 flex items-center gap-3 shrink-0">
        <Image src="/logo.png" alt="" width={32} height={32} className="rounded-lg shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-white tracking-tight leading-none">invntori</h1>
          {user?.companyID && (
            <p className="text-xs text-[rgba(235,235,245,0.6)] mt-0.5 truncate">{user.companyID}</p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto scroll-touch">
        {mainNav.map(({ href, label, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium transition-colors ${
                active
                  ? "bg-[#0A84FF]/15 text-[#0A84FF]"
                  : "text-[rgba(235,235,245,0.6)] hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-[22px] h-[22px] shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Admin — only shown to admins */}
        {user?.isAdmin && (
          <div className="pt-1">
            <button
              onClick={() => setAdminOpen((v) => !v)}
              aria-expanded={adminOpen}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] font-medium transition-colors ${
                isAdminPath
                  ? "bg-[#0A84FF]/15 text-[#0A84FF]"
                  : "text-[rgba(235,235,245,0.6)] hover:text-white hover:bg-white/5"
              }`}
            >
              <AdminIcon className="w-[22px] h-[22px] shrink-0" />
              <span className="flex-1 text-left">Admin</span>
              <ChevronDownIcon
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
              />
            </button>

            {adminOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-[#2C2C2E] space-y-3 py-1">
                {adminSections.map((section) => (
                  <div key={section.label}>
                    <p className="text-[10px] font-semibold text-[rgba(235,235,245,0.3)] uppercase tracking-wider px-3 mb-1">
                      {section.label}
                    </p>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                              active
                                ? "bg-[#0A84FF]/15 text-[#0A84FF]"
                                : "text-[rgba(235,235,245,0.6)] hover:text-white hover:bg-white/5"
                            }`}
                          >
                            <item.Icon className="w-4 h-4 shrink-0 opacity-80" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-[#1C1C1E] shrink-0 pb-safe">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 rounded-full bg-[#0A84FF]/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-[#0A84FF]">
              {(user?.displayName ?? user?.email ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.displayName ?? "User"}</p>
            <p className="text-xs text-[rgba(235,235,245,0.6)] truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-[rgba(235,235,245,0.6)] hover:text-white hover:bg-white/5 transition-colors"
        >
          <SignOutIcon />
          Sign out
        </button>
      </div>
    </aside>
  );
}
