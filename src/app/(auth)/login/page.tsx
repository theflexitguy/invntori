"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-white tracking-tight">invntori</h1>
          <p className="text-gray-400 mt-2 text-sm">Inventory management for your team</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-2xl p-8 shadow-2xl space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[#0f1117] border border-[#2a2f3e] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] transition"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[#0f1117] border border-[#2a2f3e] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF] transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#35B2FF] hover:bg-[#1a8fd1] disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          Access is managed by your company administrator.
        </p>
      </div>
    </div>
  );
}
