"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // Find the company this user belongs to
      const companiesSnap = await getDocs(collection(db, "companies"));
      let foundCompanyID = "";

      for (const companyDoc of companiesSnap.docs) {
        const employeeSnap = await getDocs(
          query(
            collection(db, "companies", companyDoc.id, "Employees"),
            where("__name__", "==", uid)
          )
        );
        if (!employeeSnap.empty) {
          foundCompanyID = companyDoc.id;
          break;
        }
      }

      if (!foundCompanyID) {
        setError("Account not found in any company. Contact your administrator.");
        await auth.signOut();
        setLoading(false);
        return;
      }

      localStorage.setItem("companyID", foundCompanyID);
      setLoading(false);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (msg.includes("invalid-credential") || msg.includes("wrong-password")) {
        setError("Incorrect email or password.");
      } else if (msg.includes("user-not-found")) {
        setError("No account found with this email.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#000000] flex items-center justify-center px-4 py-8 pt-[calc(2rem+var(--safe-top))] pb-[calc(2rem+var(--safe-bottom))]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="" width={64} height={64} className="rounded-2xl w-14 h-14 sm:w-16 sm:h-16" priority />
          </div>
          <h1 className="text-[34px] sm:text-[40px] font-bold text-white tracking-tight">invntori</h1>
          <p className="text-[15px] text-[rgba(235,235,245,0.6)] mt-2">Inventory management for your team</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-[#1C1C1E] rounded-[18px] p-6 sm:p-8 space-y-5"
        >
          <div>
            <label className="block text-[13px] font-semibold text-[rgba(235,235,245,0.6)] uppercase tracking-wide mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-[#2C2C2E] rounded-[12px] px-4 py-3.5 text-[17px] text-white placeholder-[rgba(235,235,245,0.4)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF] transition"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[rgba(235,235,245,0.6)] uppercase tracking-wide mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[#2C2C2E] rounded-[12px] px-4 py-3.5 text-[17px] text-white placeholder-[rgba(235,235,245,0.4)] focus:outline-none focus:ring-1 focus:ring-[#0A84FF] transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-[#FF453A] text-[15px] bg-[#FF453A]/10 rounded-[12px] px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0A84FF] active:bg-[#0071E3] disabled:opacity-50 text-white text-[17px] font-semibold rounded-[14px] py-3.5 transition-colors"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-[13px] text-[rgba(235,235,245,0.3)] mt-6">
          Access is managed by your company administrator.
        </p>
      </div>
    </div>
  );
}
