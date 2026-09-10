"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon, pageTitle, isRootRoute } from "./nav";

/**
 * iOS-style navigation bar: a circular back button on pushed screens, slots
 * pages can portal their own controls into, and a centered title that fades in
 * once the large title has scrolled away.
 */
export function MobileTopBar({ scrolled }: { scrolled: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const showBack = !isRootRoute(pathname);

  return (
    <header
      className={`lg:hidden shrink-0 z-30 px-safe transition-colors duration-200 ${
        scrolled
          ? "bg-[#000000]/80 backdrop-blur-xl border-b border-[#1C1C1E]"
          : "bg-[#000000] border-b border-transparent"
      }`}
    >
      <div className="pt-safe">
        <div className="h-11 flex items-center gap-2 px-2 relative">
          {/* Leading: back button on pushed screens, else the page's own slot */}
          <div className="flex items-center gap-2 shrink-0 z-10">
            {showBack && (
              <button
                onClick={() => router.back()}
                aria-label="Back"
                className="flex items-center justify-center rounded-full bg-[#1C1C1E] text-[#0A84FF] w-9 h-9 active:bg-[#2C2C2E] transition-colors"
              >
                <ChevronLeftIcon />
              </button>
            )}
            <div id="navbar-slot-left" className="flex items-center gap-2" />
          </div>

          {/* Centered title — a page-supplied one always shows; otherwise the
              route title fades in with scroll. */}
          <div className="absolute inset-x-14 flex justify-center pointer-events-none">
            <div id="navbar-slot-title" className="contents" />
            <h1
              className={`text-[17px] font-semibold text-white truncate transition-opacity duration-200 ${
                scrolled ? "opacity-100" : "opacity-0"
              }`}
            >
              {pageTitle(pathname)}
            </h1>
          </div>

          <div id="navbar-slot-right" className="ml-auto flex items-center gap-2 shrink-0 z-10" />
        </div>
      </div>
    </header>
  );
}
