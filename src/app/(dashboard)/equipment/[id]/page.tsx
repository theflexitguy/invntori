"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import type { Equipment, EquipmentCheckout, EquipmentRepair } from "@/lib/types";

const statusVariant: Record<string, "green" | "blue" | "yellow" | "red" | "gray"> = {
  available: "green",
  checkedOut: "blue",
  inRepair: "yellow",
  retired: "gray",
};

export default function EquipmentDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [checkouts, setCheckouts] = useState<EquipmentCheckout[]>([]);
  const [repairs, setRepairs] = useState<EquipmentRepair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const cid = user.companyID;
    const [eqDoc, checkSnap, repairSnap] = await Promise.all([
      getDoc(doc(db, "companies", cid, "Equipment", params.id)),
      getDocs(query(collection(db, "companies", cid, "Equipment", params.id, "Checkouts"), orderBy("checkoutDate", "desc"))),
      getDocs(query(collection(db, "companies", cid, "Equipment", params.id, "Repairs"), orderBy("reportedDate", "desc"))),
    ]);

    if (eqDoc.exists()) {
      setEquipment({ id: eqDoc.id, ...(eqDoc.data() as Omit<Equipment, "id">) });
    }
    setCheckouts(checkSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EquipmentCheckout, "id">) })));
    setRepairs(repairSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EquipmentRepair, "id">) })));
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="p-8 text-center text-gray-500">Equipment not found.</div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/equipment" className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Equipment
        </Link>
        <div className="flex items-start gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{equipment.name}</h2>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={statusVariant[equipment.status] ?? "gray"}>{equipment.status}</Badge>
              {equipment.category && <span className="text-sm text-gray-400">{equipment.category}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Details</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <InfoRow label="Serial Number" value={equipment.serialNumber} />
          <InfoRow label="Checked Out To" value={equipment.currentHolderName} />
          <InfoRow label="Notes" value={equipment.notes} span />
        </dl>
      </div>

      {/* Checkout history */}
      <Section title="Checkout History" count={checkouts.length}>
        {checkouts.length === 0 ? (
          <p className="text-gray-500 text-sm px-6 py-4">No checkout history</p>
        ) : (
          checkouts.map((c) => (
            <div key={c.id} className="px-6 py-3.5 border-t border-[#2a2f3e] first:border-0 flex justify-between text-sm">
              <div>
                <p className="text-white font-medium">{c.employeeName}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {formatDate(c.checkedOutAt)} {c.returnedAt ? `→ ${formatDate(c.returnedAt)}` : "· Still out"}
                </p>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Repair history */}
      <Section title="Repair History" count={repairs.length}>
        {repairs.length === 0 ? (
          <p className="text-gray-500 text-sm px-6 py-4">No repair history</p>
        ) : (
          repairs.map((r) => (
            <div key={r.id} className="px-6 py-3.5 border-t border-[#2a2f3e] first:border-0 text-sm">
              <div className="flex justify-between">
                <p className="text-white font-medium">{r.description}</p>
                <Badge variant={r.status === "completed" ? "green" : r.status === "inProgress" ? "blue" : "yellow"}>
                  {r.status}
                </Badge>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">{formatDate(r.reportedAt)}</p>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

function InfoRow({ label, value, span }: { label: string; value?: string | null; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-white">{value ?? "—"}</dd>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-[#2a2f3e] flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-gray-500">({count})</span>
      </div>
      {children}
    </div>
  );
}

function formatDate(ts: { toDate?: () => Date; seconds?: number } | string | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = typeof ts === "object" && "toDate" in ts && ts.toDate ? ts.toDate() : new Date((ts as { seconds: number }).seconds * 1000);
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}
