"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabNav, isActivePath } from "./nav";

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden shrink-0 bg-[#0f1117]/95 backdrop-blur border-t border-[#1e2130] pb-safe px-safe"
    >
      <div className="flex items-stretch">
        {tabNav.map(({ href, label, tabLabel, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 transition-colors ${
                active ? "text-[#35B2FF]" : "text-gray-500 active:text-gray-300"
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-1">
                {tabLabel ?? label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
