"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Root() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/dashboard" : "/login");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#0f1117]">
      <div className="w-8 h-8 border-2 border-[#35B2FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
