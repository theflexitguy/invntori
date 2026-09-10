"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparklesIcon } from "./nav";

/**
 * The "Ask invntori" pill — same treatment as the native app: a glowing blue
 * capsule floating above the tab bar on phones, bottom-right on desktop.
 */
export function FloatingChatButton() {
  const pathname = usePathname();
  if (pathname === "/chat") return null;

  return (
    <Link
      href="/chat"
      className="fixed right-4 lg:right-6 bottom-[calc(var(--tabbar-clearance)+10px)] lg:bottom-6 z-40 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-[#0A84FF] text-white shadow-[0_6px_24px_rgba(10,132,255,0.55)] active:scale-95 hover:bg-[#409CFF] transition-all"
    >
      <SparklesIcon className="w-5 h-5 shrink-0" />
      <span className="text-[15px] font-semibold tracking-tight">Ask invntori</span>
    </Link>
  );
}
