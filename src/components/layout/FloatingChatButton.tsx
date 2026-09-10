"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatIcon } from "./nav";

/**
 * Desktop-only shortcut. On phones the same destination is the "Ask" tab in
 * the bottom bar, so a floating button would just cover content twice over.
 */
export function FloatingChatButton() {
  const pathname = usePathname();
  if (pathname === "/chat") return null;

  return (
    <Link
      href="/chat"
      className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center gap-2.5 px-4 py-3 rounded-full bg-[#35B2FF] text-white shadow-xl shadow-[#35B2FF]/30 hover:bg-[#2a9fe8] hover:scale-105 active:scale-95 transition-all"
    >
      <ChatIcon className="w-5 h-5 shrink-0" />
      <span className="text-sm font-semibold">Ask invntori</span>
    </Link>
  );
}
