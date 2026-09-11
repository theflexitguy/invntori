"use client";

import { useAuth } from "@/context/AuthContext";

/**
 * Avatar + Logout row that opens the native app's Admin tab. Shared by the
 * Admin screen and the Account screen so sign-out is always one tap away.
 */
export function AccountBar() {
  const { user, signOut } = useAuth();
  const initial = (user?.displayName ?? user?.email ?? "?")[0].toUpperCase();

  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-11 h-11 rounded-full bg-[#0A84FF]/15 flex items-center justify-center shrink-0">
        <span className="text-[17px] font-semibold text-[#0A84FF]">{initial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold text-white truncate">
          {user?.displayName ?? "User"}
        </p>
        <p className="text-[13px] text-[rgba(235,235,245,0.6)] truncate">{user?.email}</p>
      </div>
      <button
        onClick={signOut}
        className="shrink-0 bg-[#1C1C1E] rounded-full px-4 py-2 text-[15px] font-medium text-white active:bg-[#2C2C2E] transition-colors"
      >
        Logout
      </button>
    </div>
  );
}
