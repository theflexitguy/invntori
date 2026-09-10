"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import type { Company, AIProvider } from "@/lib/types";

const AI_PROVIDERS: { value: AIProvider; label: string; description: string }[] = [
  { value: "disabled", label: "Disabled", description: "AI assistant is turned off" },
  { value: "claude", label: "Claude (Anthropic)", description: "Powered by Claude AI" },
  { value: "openai", label: "OpenAI", description: "Powered by ChatGPT / OpenAI" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [aiProvider, setAIProvider] = useState<AIProvider>("disabled");
  const [fieldRoutesEnabled, setFieldRoutesEnabled] = useState(false);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const snap = await getDoc(doc(db, "companies", user.companyID));
    if (snap.exists()) {
      const data = snap.data() as Company;
      setCompany(data);
      setCompanyName(data.name ?? "");
      setAIProvider((data.settings?.aiProvider as AIProvider) ?? "disabled");
      setFieldRoutesEnabled(data.settings?.fieldRoutesEnabled ?? false);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!user?.companyID || !companyName.trim()) { setError("Company name is required."); return; }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateDoc(doc(db, "companies", user.companyID), {
        name: companyName.trim(),
        "settings.aiProvider": aiProvider,
        "settings.fieldRoutesEnabled": fieldRoutesEnabled,
      });
      setCompany((prev) => prev ? { ...prev, name: companyName.trim(), settings: { ...prev.settings, aiProvider, fieldRoutesEnabled } } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#35B2FF]";

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  return (
    <div className="p-4 sm:p-6 xl:p-8 w-full max-w-2xl pb-8">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm">Admin</Link>
        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-sm text-white">Settings</span>
      </div>

      <div className="mb-8 mt-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Company Settings</h2>
        <p className="text-gray-400 mt-1 text-sm">Manage your company profile and integrations</p>
      </div>

      <div className="space-y-5">
        {/* Company Name */}
        <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Company Profile</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Company Name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="Your Company Name" />
          </div>
          {company?.subscriptionTier && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">Plan:</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 font-medium capitalize">
                {company.subscriptionTier}
              </span>
            </div>
          )}
        </div>

        {/* AI Settings */}
        <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">AI Assistant</h3>
          <p className="text-xs text-gray-500 mb-4">Choose which AI provider powers the Ask Invntori feature</p>
          <div className="space-y-2">
            {AI_PROVIDERS.map((provider) => (
              <button
                key={provider.value}
                onClick={() => setAIProvider(provider.value)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                  aiProvider === provider.value
                    ? "bg-[#35B2FF]/10 border-[#35B2FF]/30 text-white"
                    : "bg-[#0f1117] border-[#2a2f3e] text-gray-400 hover:text-white hover:border-white/10"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${aiProvider === provider.value ? "border-[#35B2FF]" : "border-gray-600"}`}>
                  {aiProvider === provider.value && <div className="w-2 h-2 rounded-full bg-[#35B2FF]" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{provider.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{provider.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Integrations</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">FieldRoutes</p>
              <p className="text-xs text-gray-500 mt-0.5">Sync inventory with FieldRoutes CRM</p>
            </div>
            <button
              onClick={() => setFieldRoutesEnabled((v) => !v)}
              className={`relative shrink-0 rounded-full transition-colors`}
              style={{ width: "40px", height: "22px", backgroundColor: fieldRoutesEnabled ? "#35B2FF" : "#2a2f3e" }}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform`}
                style={{ left: "2px", transform: fieldRoutesEnabled ? "translateX(18px)" : "translateX(0)" }}
              />
            </button>
          </div>
        </div>

        {/* Save button */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!companyName.trim() || saving}
            className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm font-medium bg-[#35B2FF]/15 text-[#35B2FF] border border-[#35B2FF]/20 hover:bg-[#35B2FF]/25 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && <span className="text-sm text-green-400">Saved!</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </div>
    </div>
  );
}
