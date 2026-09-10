"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, NavPanel } from "./Sidebar";
import { MobileTopBar } from "./MobileTopBar";
import { MobileTabBar } from "./MobileTabBar";
import { FloatingChatButton } from "./FloatingChatButton";

/**
 * App shell: a fixed-height viewport with its own scrolling content pane, so
 * the bottom tab bar and top bar stay put while pages scroll — the way a
 * native app behaves. `100dvh` keeps it correct as mobile browser chrome
 * shows and hides.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#12151f]">
      <Sidebar />

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 ${menuOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!menuOpen}
      >
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={`absolute inset-y-0 left-0 w-[84vw] max-w-[300px] shadow-2xl transition-transform duration-300 ease-out ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <NavPanel onNavigate={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto scroll-touch px-safe">{children}</main>
        <MobileTabBar />
      </div>

      <FloatingChatButton />
    </div>
  );
}
