"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeftIcon, pageTitle, isRootRoute } from "./nav";

/**
 * iOS-style navigation bar: a circular back button on pushed screens and a
 * centered title that fades in only once the large title has scrolled away —
 * the same large-title collapse the native app uses.
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
        <div className="h-11 flex items-center px-2 relative">
          {showBack && (
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="tap-target flex items-center justify-center rounded-full bg-[#1C1C1E] text-[#0A84FF] w-9 h-9 min-w-0 min-h-0 active:bg-[#2C2C2E] transition-colors"
            >
              <ChevronLeftIcon />
            </button>
          )}
          <h1
            className={`absolute inset-x-12 text-center text-[17px] font-semibold text-white truncate transition-opacity duration-200 ${
              scrolled ? "opacity-100" : "opacity-0"
            }`}
          >
            {pageTitle(pathname)}
          </h1>
        </div>
      </div>
    </header>
  );
}
