"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import type { Product, Warehouse } from "@/lib/types";

interface ValuationRow {
  productId: string;
  productName: string;
  category: string;
  unit: string;
  unitCost: number;
  totalQuantity: number;
  totalValue: number;
  byWarehouse: { warehouseName: string; quantity: number; value: number }[];
}

export default function ValuationPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ValuationRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [noCostCount, setNoCostCount] = useState(0);

  useEffect(() => {
    if (!user?.companyID) return;
    load();
  }, [user]);

  async function load() {
    if (!user?.companyID) return;
    const cid = user.companyID;

    const [productSnap, whSnap] = await Promise.all([
      getDocs(collection(db, "companies", cid, "products")),
      getDocs(collection(db, "companies", cid, "warehouses")),
    ]);

    const products: Product[] = productSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }))
      .filter((p) => !p.isRetired);

    const whs: Warehouse[] = whSnap.docs.map((d) => ({ id: d.id, name: d.data().name }));
    setWarehouses(whs);

    // Load all inventory across all warehouses
    const invByProductByWarehouse: Record<string, Record<string, number>> = {};
    await Promise.all(
      whs.map(async (wh) => {
        if (!wh.id) return;
        const invSnap = await getDocs(collection(db, "companies", cid, "warehouses", wh.id, "inventory"));
        invSnap.docs.forEach((d) => {
          const qty = (d.data().quantity as number) ?? 0;
          if (!invByProductByWarehouse[d.id]) invByProductByWarehouse[d.id] = {};
          invByProductByWarehouse[d.id][wh.id!] = qty;
        });
      })
    );

    let noCost = 0;
    const valuationRows: ValuationRow[] = products
      .map((p) => {
        const unitCost = p.unitCost ?? 0;
        if (!p.unitCost) noCost++;
        const quantityByWarehouse = invByProductByWarehouse[p.id!] ?? {};
        const byWarehouse = whs
          .map((wh) => ({
            warehouseName: wh.name,
            quantity: quantityByWarehouse[wh.id!] ?? 0,
            value: (quantityByWarehouse[wh.id!] ?? 0) * unitCost,
          }))
          .filter((w) => w.quantity > 0);
        const totalQuantity = Object.values(quantityByWarehouse).reduce((sum, q) => sum + q, 0);
        const totalValue = totalQuantity * unitCost;
        return {
          productId: p.id!,
          productName: p.name,
          category: p.category ?? "",
          unit: p.unit ?? "",
          unitCost,
          totalQuantity,
          totalValue,
          byWarehouse,
        };
      })
      .filter((r) => r.totalQuantity > 0)
      .sort((a, b) => b.totalValue - a.totalValue);

    setNoCostCount(noCost);
    setRows(valuationRows);
    setLoading(false);
  }

  const totalValue = rows.reduce((sum, r) => sum + r.totalValue, 0);
  const totalItems = rows.reduce((sum, r) => sum + r.totalQuantity, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>;

  return (
    <div className="p-6 xl:p-8 w-full">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors text-sm">Admin</Link>
        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-sm text-white">Inventory Valuation</span>
      </div>

      <div className="mb-6 mt-4">
        <h2 className="text-2xl font-bold text-white">Inventory Valuation</h2>
        <p className="text-gray-400 mt-1 text-sm">Total value based on current stock × unit cost per product</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Value</p>
          <p className="text-2xl font-bold text-white">{totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
        </div>
        <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Products in Stock</p>
          <p className="text-2xl font-bold text-white">{rows.length}</p>
        </div>
        <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total Units</p>
          <p className="text-2xl font-bold text-white">{totalItems.toLocaleString()}</p>
        </div>
      </div>

      {noCostCount > 0 && (
        <div className="mb-5 flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-amber-400">
            {noCostCount} product{noCostCount !== 1 ? "s" : ""} without a unit cost — set costs in{" "}
            <Link href="/admin/products" className="underline hover:text-amber-300 transition-colors">Manage Products</Link> for accurate totals.
          </p>
        </div>
      )}

      <div className="bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">No in-stock products found.</p>
        ) : (
          <div>
            <div className="grid grid-cols-12 px-6 py-3 border-b border-[#2a2f3e]">
              <div className="col-span-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</div>
              <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Qty</div>
              <div className="col-span-2 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Unit Cost</div>
              <div className="col-span-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total Value</div>
            </div>
            <div className="divide-y divide-[#2a2f3e]">
              {rows.map((row) => {
                const isExpanded = expandedRow === row.productId;
                return (
                  <div key={row.productId}>
                    <button
                      className="w-full grid grid-cols-12 px-6 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
                      onClick={() => setExpandedRow(isExpanded ? null : row.productId)}
                    >
                      <div className="col-span-5">
                        <p className="text-sm font-medium text-white">{row.productName}</p>
                        {row.category && <p className="text-xs text-gray-500 mt-0.5">{row.category}</p>}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm text-gray-300">{row.totalQuantity.toLocaleString()}</span>
                        {row.unit && <span className="text-xs text-gray-500 ml-1">{row.unit}</span>}
                      </div>
                      <div className="col-span-2 text-right">
                        {row.unitCost > 0 ? (
                          <span className="text-sm text-gray-300">{row.unitCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
                        ) : (
                          <span className="text-sm text-gray-600">—</span>
                        )}
                      </div>
                      <div className="col-span-3 text-right flex items-center justify-end gap-2">
                        <span className={`text-sm font-semibold ${row.totalValue > 0 ? "text-white" : "text-gray-500"}`}>
                          {row.totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                        </span>
                        {row.byWarehouse.length > 1 && (
                          <svg className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {isExpanded && row.byWarehouse.length > 1 && (
                      <div className="border-t border-[#2a2f3e] bg-[#0f1117] px-6 py-2">
                        {row.byWarehouse.map((wh) => (
                          <div key={wh.warehouseName} className="grid grid-cols-12 py-2">
                            <div className="col-span-5 text-xs text-gray-500 pl-4">{wh.warehouseName}</div>
                            <div className="col-span-2 text-right text-xs text-gray-400">{wh.quantity.toLocaleString()}</div>
                            <div className="col-span-2 text-right text-xs text-gray-600">—</div>
                            <div className="col-span-3 text-right text-xs text-gray-400">
                              {wh.value.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-12 px-6 py-4 border-t border-[#2a2f3e] bg-[#0f1117]">
              <div className="col-span-5 text-sm font-semibold text-white">Total</div>
              <div className="col-span-2 text-right text-sm text-gray-300">{totalItems.toLocaleString()}</div>
              <div className="col-span-2" />
              <div className="col-span-3 text-right text-sm font-bold text-white">
                {totalValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
