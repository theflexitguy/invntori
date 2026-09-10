"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import type { Vehicle, VehicleAssignment, VehicleMaintenance } from "@/lib/types";

export default function VehicleDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    const cid = user.companyID;
    const [vDoc, aSnap, mSnap] = await Promise.all([
      getDoc(doc(db, "companies", cid, "Vehicles", params.id)),
      getDocs(query(collection(db, "companies", cid, "Vehicles", params.id, "Assignments"), orderBy("startDate", "desc"))),
      getDocs(query(collection(db, "companies", cid, "Vehicles", params.id, "Maintenance"), orderBy("scheduledDate", "desc"))),
    ]);

    if (vDoc.exists()) {
      setVehicle({ id: vDoc.id, ...(vDoc.data() as Omit<Vehicle, "id">) });
    }
    setAssignments(aSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleAssignment, "id">) })));
    setMaintenance(mSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VehicleMaintenance, "id">) })));
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  if (!vehicle) {
    return <div className="p-8 text-center text-gray-500">Vehicle not found.</div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/fleet" className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1 mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Fleet
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{vehicle.name}</h2>
            {vehicle.isRetired && <Badge variant="gray">Retired</Badge>}
          </div>
          <p className="text-gray-400 mt-1 text-sm">
            {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "No details"}
          </p>
        </div>
      </div>

      {vehicle.isRetired && (
        <div className="mb-6 bg-gray-500/10 border border-gray-500/20 rounded-xl px-5 py-4 text-sm text-gray-400">
          This vehicle is retired and no longer in service.
        </div>
      )}

      {/* Info */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Vehicle Info</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <InfoRow label="License Plate" value={vehicle.licensePlate} />
          <InfoRow label="VIN" value={vehicle.vin} />
          <InfoRow label="Color" value={vehicle.color} />
          <InfoRow label="Condition" value={vehicle.condition} />
          <InfoRow label="Assigned Driver" value={vehicle.currentDriverName} />
          <InfoRow label="Notes" value={vehicle.notes} span />
        </dl>
      </div>

      {/* Driver History */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[#2a2f3e]">
          <h3 className="text-sm font-semibold text-white">Driver History <span className="text-gray-500 font-normal">({assignments.length})</span></h3>
        </div>
        {assignments.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-500">No driver assignments</p>
        ) : (
          assignments.map((a) => (
            <div key={a.id} className="px-6 py-3.5 border-t border-[#2a2f3e] first:border-0 flex justify-between text-sm">
              <div>
                <p className="text-white font-medium">{a.employeeName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDate(a.assignedAt)} {a.unassignedAt ? `→ ${formatDate(a.unassignedAt)}` : "· Current"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Maintenance */}
      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2f3e]">
          <h3 className="text-sm font-semibold text-white">Maintenance <span className="text-gray-500 font-normal">({maintenance.length})</span></h3>
        </div>
        {maintenance.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-500">No maintenance records</p>
        ) : (
          maintenance.map((m) => (
            <div key={m.id} className="px-6 py-3.5 border-t border-[#2a2f3e] first:border-0 text-sm">
              <p className="text-white font-medium">{m.type}</p>
              {m.description && <p className="text-gray-400 text-xs mt-0.5">{m.description}</p>}
              {m.notes && <p className="text-gray-500 text-xs mt-0.5">{m.notes}</p>}
              <p className="text-gray-500 text-xs mt-0.5">{formatDate(m.performedAt)}</p>
            </div>
          ))
        )}
      </div>
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

function formatDate(ts: { toDate?: () => Date; seconds?: number } | string | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = typeof ts === "object" && "toDate" in ts && ts.toDate ? ts.toDate() : new Date((ts as { seconds: number }).seconds * 1000);
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}
