"use client";

import { useState } from "react";
import { FormSheet } from "@/components/ui/FormSheet";
import {
  CardSection, Field, fieldElevatedCls, Switch, ToggleListGroup, CaptionHeader,
} from "@/components/ui/ios";
import { InfoCircleIcon, DocIcon, ChevronDownIcon } from "@/components/layout/nav";
import type { Product } from "@/lib/types";

/**
 * Defaults matching the native app's pickers. Anything already stored on a
 * product is merged in, so a value the native app added that isn't listed here
 * still shows and survives a save rather than being silently dropped.
 */
const APPLICATION_AREAS = [
  "Baseboards",
  "Cracks & Crevices",
  "Downspouts",
  "Eaves",
  "Edges of Concrete",
  "Expansion Joints",
  "Foundation",
  "Yard",
];

const TARGET_PESTS = [
  "Ants",
  "Bedbugs",
  "Fleas",
  "General Pests",
  "German Roaches",
  "Moles",
  "Spiders",
  "Ticks",
  "Wasps",
];

function mergeKnown(defaults: string[], stored?: string[]): string[] {
  const extra = (stored ?? []).filter((v) => !defaults.includes(v));
  return [...defaults, ...extra.sort()];
}

export function ProductFormSheet({
  product,
  unitTypes,
  categories,
  stock,
  canDelete,
  deleting,
  onDelete,
  onSave,
  onClose,
}: {
  product: Product | null;
  unitTypes: string[];
  categories: string[];
  stock: { warehouse: string; qty: number }[];
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
  onSave: (data: Omit<Product, "id">) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!product;

  const [name, setName] = useState(product?.name ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [threshold, setThreshold] = useState(
    product?.reorderThreshold != null ? String(product.reorderThreshold) : ""
  );
  const [unitCost, setUnitCost] = useState(
    product?.unitCost != null ? String(product.unitCost) : ""
  );
  const [chemID, setChemID] = useState(
    product?.fieldroutesChemicalID != null ? String(product.fieldroutesChemicalID) : ""
  );
  const [active, setActive] = useState(product?.isRetired !== true);
  const [mixRate, setMixRate] = useState(product?.mixRate ?? "");
  const [areas, setAreas] = useState<string[]>(product?.applicationAreas ?? []);
  const [pests, setPests] = useState<string[]>(product?.targetPests ?? []);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const areaOptions = mergeKnown(APPLICATION_AREAS, product?.applicationAreas);
  const pestOptions = mergeKnown(TARGET_PESTS, product?.targetPests);

  function toggle(list: string[], set: (v: string[]) => void, item: string) {
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data: Omit<Product, "id"> = { name: name.trim(), isRetired: !active };
      if (category.trim()) data.category = category.trim();
      if (unit.trim()) data.unit = unit.trim();

      const thresh = parseInt(threshold, 10);
      if (!isNaN(thresh) && thresh >= 0) data.reorderThreshold = thresh;

      const cost = parseFloat(unitCost);
      if (!isNaN(cost) && cost >= 0) data.unitCost = cost;

      const chem = parseInt(chemID, 10);
      if (!isNaN(chem) && chem >= 0) data.fieldroutesChemicalID = chem;

      if (mixRate.trim()) data.mixRate = mixRate.trim();
      data.applicationAreas = areas;
      data.targetPests = pests;

      await onSave(data);
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  /** Datalist-backed text input, so a value the company hasn't catalogued still works. */
  const selectCls = `${fieldElevatedCls} appearance-none pr-10`;

  return (
    <FormSheet
      title={isEdit ? "Edit Product" : "Add Product"}
      onCancel={onClose}
      onSave={handleSave}
      saveDisabled={!name.trim()}
      saving={saving}
    >
      <div className="space-y-4">
        <CardSection tone="elevated" Icon={InfoCircleIcon} title="Product Info">
          <div className="space-y-3">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldElevatedCls}
                placeholder="e.g. 90/10 NIS"
                autoFocus
              />
            </Field>

            <Field label="Unit">
              <div className="relative">
                <select
                  value={unitTypes.includes(unit) || unit === "" ? unit : "__other"}
                  onChange={(e) => setUnit(e.target.value === "__other" ? unit : e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select a unit…</option>
                  {unitTypes.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                  {unit && !unitTypes.includes(unit) && (
                    <option value="__other">{unit}</option>
                  )}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-[rgba(235,235,245,0.6)]" />
              </div>
            </Field>

            <Field label="Category">
              <div className="relative">
                <select
                  value={categories.includes(category) || category === "" ? category : "__other"}
                  onChange={(e) =>
                    setCategory(e.target.value === "__other" ? category : e.target.value)
                  }
                  className={selectCls}
                >
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {category && !categories.includes(category) && (
                    <option value="__other">{category}</option>
                  )}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-[rgba(235,235,245,0.6)]" />
              </div>
            </Field>

            <Field label="Reorder Threshold">
              <input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                inputMode="numeric"
                className={fieldElevatedCls}
                placeholder="0"
              />
            </Field>

            <Field label="Unit Cost ($)">
              <input
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                inputMode="decimal"
                className={fieldElevatedCls}
                placeholder="0.00"
              />
            </Field>

            <Field
              label="FieldRoutes Chemical ID"
              hint="Links this product to a FieldRoutes chemical for inventory auditing."
            >
              <input
                value={chemID}
                onChange={(e) => setChemID(e.target.value)}
                inputMode="numeric"
                className={fieldElevatedCls}
                placeholder="Enter FieldRoutes ID"
              />
            </Field>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="flex items-center gap-2 min-w-0">
                <CheckGlyph active={active} />
                <span className={`text-[17px] ${active ? "text-[#30D158]" : "text-[rgba(235,235,245,0.6)]"}`}>
                  Active Product
                </span>
              </span>
              <Switch checked={active} onChange={setActive} label="Active product" />
            </div>
          </div>
        </CardSection>

        <CardSection tone="elevated" Icon={DocIcon} title="Product Details">
          <div className="space-y-4">
            <Field label="Mix Rate">
              <input
                value={mixRate}
                onChange={(e) => setMixRate(e.target.value)}
                className={fieldElevatedCls}
                placeholder="Enter Mix Rate"
              />
            </Field>

            <div>
              <CaptionHeader uppercase={false}>Application Areas</CaptionHeader>
              <ToggleListGroup tone="elevated"
                items={areaOptions}
                selected={areas}
                onToggle={(item) => toggle(areas, setAreas, item)}
              />
            </div>

            <div>
              <CaptionHeader uppercase={false}>Target Pests</CaptionHeader>
              <ToggleListGroup tone="elevated"
                items={pestOptions}
                selected={pests}
                onToggle={(item) => toggle(pests, setPests, item)}
              />
            </div>
          </div>
        </CardSection>

        {isEdit && stock.length > 0 && (
          <div className="bg-[#1C1C1E] rounded-[14px] p-4">
            <h3 className="text-[17px] font-semibold text-white mb-2">
              Existing Inventory by Warehouse
            </h3>
            <div className="space-y-1">
              {stock.map((row) => (
                <p key={row.warehouse} className="text-[15px] text-[rgba(235,235,245,0.6)]">
                  {row.warehouse}: {row.qty.toLocaleString()} {unit || ""}
                </p>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-[#FF453A] text-[15px]">{error}</p>}

        {canDelete && (
          <div className="pt-1">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-3.5 rounded-[12px] text-[17px] font-medium bg-[#FF453A]/15 text-[#FF453A] active:bg-[#FF453A]/25 transition-colors"
              >
                Delete Product
              </button>
            ) : (
              <div className="bg-[#FF453A]/10 rounded-[12px] p-4">
                <p className="text-[15px] text-white mb-3 leading-snug">
                  Permanently remove “{product?.name}” and its inventory records in every warehouse?
                  This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2.5 rounded-[10px] text-[15px] text-white bg-white/10 active:bg-white/15 transition-colors"
                  >
                    Keep
                  </button>
                  <button
                    onClick={onDelete}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-[10px] text-[15px] font-semibold text-white bg-[#FF453A] active:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FormSheet>
  );
}

function CheckGlyph({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-[22px] h-[22px] shrink-0 ${active ? "text-[#30D158]" : "text-[rgba(235,235,245,0.3)]"}`}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 2.2a9.8 9.8 0 1 0 0 19.6 9.8 9.8 0 0 0 0-19.6Zm5.05 7.2-6 7.1a.95.95 0 0 1-1.4.06l-3.1-3.1a.95.95 0 1 1 1.34-1.34l2.37 2.36 5.34-6.31a.95.95 0 1 1 1.45 1.23Z" />
    </svg>
  );
}
