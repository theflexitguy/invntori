"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileTopBar } from "./MobileTopBar";
import { MobileTabBar } from "./MobileTabBar";
import { FloatingChatButton } from "./FloatingChatButton";

/**
 * App shell: a fixed-height viewport with its own scrolling content pane, so
 * the tab bar and nav bar stay put while pages scroll — the way a native app
 * behaves. `100dvh` keeps it correct as mobile browser chrome shows and hides.
 *
 * Navigation mirrors the native app: a floating tab bar on phones (no drawer;
 * the Admin tab is the entry point to everything else) and the sidebar on
 * desktop.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Drive the nav bar's large-title collapse from the content pane's scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 24);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Every route push starts at the top, like a native navigation stack.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setScrolled(false);
  }, [pathname]);

  // The chat screen manages its own full-height layout and composer, so it
  // opts out of the tab-bar clearance the scrolling pages need.
  const fullBleed = pathname === "/chat";

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#000000]">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col relative">
        <MobileTopBar scrolled={scrolled} />
        <main
          ref={scrollRef}
          className={`flex-1 min-h-0 px-safe ${
            fullBleed
              ? "overflow-hidden"
              : "overflow-y-auto scroll-touch pb-[var(--tabbar-clearance)] lg:pb-0"
          }`}
        >
          {children}
        </main>
        {!fullBleed && <MobileTabBar />}
      </div>

      <FloatingChatButton />
    </div>
  );
}
