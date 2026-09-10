"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { tabsFor, isActivePath } from "./nav";

/**
 * Floating capsule tab bar, matching the native app: a blurred, rounded bar
 * that hovers over the content rather than sitting in a full-width tray.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const tabs = tabsFor(!!user?.isAdmin);

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none px-3 pb-[calc(0.5rem+var(--safe-bottom))]"
    >
      <div className="pointer-events-auto mx-auto max-w-md rounded-[28px] bg-[#1C1C1E]/80 backdrop-blur-2xl ring-1 ring-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.6)] flex items-stretch p-1.5">
        {tabs.map(({ href, label, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-1.5 rounded-[22px] transition-colors ${
                active ? "bg-white/[0.07] text-[#0A84FF]" : "text-white/90 active:bg-white/5"
              }`}
            >
              <Icon className="w-[26px] h-[26px]" />
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
