"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { MenuIcon, pageTitle } from "./nav";

export function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  return (
    <header className="lg:hidden shrink-0 bg-[#0f1117] border-b border-[#1e2130] pt-safe px-safe">
      <div className="h-14 flex items-center gap-2 px-2">
        <button
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="tap-target flex items-center justify-center rounded-xl text-gray-300 active:bg-white/10 transition-colors"
        >
          <MenuIcon />
        </button>
        <h1 className="flex-1 min-w-0 text-base font-semibold text-white truncate">
          {pageTitle(pathname)}
        </h1>
        <Image src="/logo.png" alt="invntori" width={28} height={28} className="rounded-lg shrink-0 mr-1.5" />
      </div>
    </header>
  );
}
