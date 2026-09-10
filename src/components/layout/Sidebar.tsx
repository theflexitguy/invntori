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
  ShieldIcon,
  SignOutIcon,
  CloseIcon,
} from "./nav";

/**
 * The navigation surface itself. Rendered twice: as the fixed desktop sidebar
 * and as the contents of the mobile slide-in drawer.
 */
export function NavPanel({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const isAdminPath = ADMIN_PATHS.some((p) => isActivePath(pathname, p));
  const [adminOpen, setAdminOpen] = useState(isAdminPath);

  useEffect(() => {
    if (isAdminPath) setAdminOpen(true);
  }, [isAdminPath]);

  return (
    <div className="flex flex-col h-full bg-[#0f1117]">
      {/* Logo */}
      <div className="px-5 pt-[calc(1rem+var(--safe-top))] pb-4 border-b border-[#1e2130] flex items-center gap-3 shrink-0">
        <Image src="/logo.png" alt="" width={32} height={32} className="rounded-lg shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black text-white tracking-tight leading-none">invntori</h1>
          {user?.companyID && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{user.companyID}</p>
          )}
        </div>
        {onNavigate && (
          <button
            onClick={onNavigate}
            aria-label="Close menu"
            className="lg:hidden -mr-2 p-2 rounded-lg text-gray-500 hover:text-white active:bg-white/5 transition-colors"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scroll-touch">
        {mainNav.map(({ href, label, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[#35B2FF]/10 text-[#35B2FF]"
                  : "text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}

        {/* Admin expandable section — only shown to admins */}
        {user?.isAdmin && (
          <div className="pt-1">
            <button
              onClick={() => setAdminOpen((v) => !v)}
              aria-expanded={adminOpen}
              className={`w-full flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isAdminPath
                  ? "bg-[#35B2FF]/10 text-[#35B2FF]"
                  : "text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10"
              }`}
            >
              <ShieldIcon className="w-5 h-5 shrink-0" />
              <span className="flex-1 text-left">Admin</span>
              <ChevronDownIcon
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
              />
            </button>

            {adminOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-[#2a2f3e] space-y-3 py-1">
                {adminSections.map((section) => (
                  <div key={section.label}>
                    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-3 mb-1">
                      {section.label}
                    </p>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center px-3 py-2.5 lg:py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              active
                                ? "bg-[#35B2FF]/10 text-[#35B2FF]"
                                : "text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10"
                            }`}
                          >
                            {item.label}
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
      <div className="px-3 py-3 border-t border-[#1e2130] shrink-0 pb-safe">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[#35B2FF]/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-[#35B2FF]">
              {(user?.displayName ?? user?.email ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.displayName ?? "User"}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-1 w-full flex items-center gap-3 px-3 py-3 lg:py-2 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors"
        >
          <SignOutIcon />
          Sign out
        </button>
      </div>
    </div>
  );
}

/** Static sidebar — desktop / tablet landscape only. */
export function Sidebar() {
  return (
    <aside className="hidden lg:block w-60 shrink-0 h-full border-r border-[#1e2130]">
      <NavPanel />
    </aside>
  );
}
