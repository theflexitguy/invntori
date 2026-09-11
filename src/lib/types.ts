import type { Timestamp } from "firebase/firestore";

// ── Inventory ──────────────────────────────────────────────────────────────
export interface FirestoreInventoryItem {
  id?: string;
  name: string;
  category?: string;
  quantity: number;
  unit?: string;
  reorderThreshold?: number;
  warehouseID?: string;
  productID?: string;
  details?: Record<string, string>;
  fieldroutesChemicalID?: number;
  isRetired?: boolean;
}

export interface Warehouse {
  id?: string;
  name: string;
  location?: string;
  officeID?: string;
}

export interface Product {
  id?: string;
  name: string;
  unit?: string;
  category?: string;
  reorderThreshold?: number;
  unitCost?: number;
  isRetired?: boolean;
  /** Links the product to a FieldRoutes chemical for inventory auditing. */
  fieldroutesChemicalID?: number;
  mixRate?: string;
  applicationAreas?: string[];
  targetPests?: string[];
}

export interface Category {
  id?: string;
  categoryname: string;
}

export interface UnitType {
  id?: string;
  unitname: string;
}

export interface Office {
  id?: string;
  name: string;
  address?: string;
  colorHex?: string;
  fieldroutesOfficeID?: number;
}

export interface DetailField {
  id?: string;
  name: string;
}

// ── Company ────────────────────────────────────────────────────────────────
export type AIProvider = "claude" | "openai" | "disabled";
export type SubscriptionTier = "trial" | "starter" | "professional" | "enterprise";

export interface Company {
  id?: string;
  name: string;
  subscriptionTier?: SubscriptionTier;
  settings?: {
    aiProvider?: AIProvider;
    fieldRoutesEnabled?: boolean;
  };
}

// ── Employees ──────────────────────────────────────────────────────────────
export interface Employee {
  id?: string;
  name: string;
  email?: string;
  role?: string;
  isAdmin?: boolean;
  isManager?: boolean;
  isActive?: boolean;
  companyID?: string;
  warehouseID?: string;
  officeIDs?: string[];
  fcmToken?: string;
  createdAt?: Timestamp;
  managePermissions?: string[];
  /** Links the employee to their FieldRoutes account for inventory auditing. */
  fieldroutesEmployeeID?: number;
  customFields?: Record<string, string>;
}

// ── Equipment ──────────────────────────────────────────────────────────────
export type EquipmentStatus = "available" | "checkedOut" | "inRepair" | "retired";
export type RepairStatus = "reported" | "approved" | "rejected" | "inProgress" | "completed";

export interface Equipment {
  id?: string;
  name: string;
  category?: string;
  serialNumber?: string;
  status: EquipmentStatus;
  notes?: string;
  currentHolderUID?: string;
  currentHolderName?: string;
  currentCheckedOutAt?: Timestamp;
  customFields?: Record<string, string>;
  createdAt?: Timestamp;
  isRetired?: boolean;
}

export interface EquipmentCheckout {
  id?: string;
  equipmentID: string;
  equipmentName: string;
  employeeUID: string;
  employeeName: string;
  checkedOutAt: Timestamp;
  returnedAt?: Timestamp;
  notes?: string;
}

export interface EquipmentRepair {
  id?: string;
  equipmentID: string;
  equipmentName: string;
  reportedByUID: string;
  reportedByName: string;
  description: string;
  status: RepairStatus;
  reportedAt: Timestamp;
  resolvedAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedByName?: string;
  responseNote?: string;
}

// ── Fleet ──────────────────────────────────────────────────────────────────
export type VehicleCondition = "excellent" | "good" | "fair" | "poor";

export interface Vehicle {
  id?: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  licensePlate?: string;
  color?: string;
  condition?: VehicleCondition;
  currentDriverUID?: string;
  currentDriverName?: string;
  currentAssignedAt?: Timestamp;
  customFields?: Record<string, string>;
  notes?: string;
  createdAt?: Timestamp;
  isRetired?: boolean;
}

export interface VehicleAssignment {
  id?: string;
  vehicleID: string;
  vehicleName: string;
  employeeUID: string;
  employeeName: string;
  assignedAt: Timestamp;
  unassignedAt?: Timestamp;
  notes?: string;
}

export interface VehicleMaintenance {
  id?: string;
  vehicleID: string;
  vehicleName: string;
  type: string;
  description?: string;
  performedAt: Timestamp;
  mileage?: number;
  cost?: number;
  performedByName?: string;
  notes?: string;
}

// ── Purchase Orders ────────────────────────────────────────────────────────
export type POStatus = "draft" | "submitted" | "approved" | "received" | "cancelled";

export interface PurchaseOrderItem {
  productName: string;
  quantity: number;
  unit: string;
  unitCost?: number;
}

export interface PurchaseOrder {
  id?: string;
  orderNumber?: string;
  vendorName: string;
  status: POStatus;
  items: PurchaseOrderItem[];
  createdByUID?: string;
  createdByName?: string;
  createdAt?: Timestamp;
  notes?: string;
  totalCost?: number;
}

// ── Inventory Requests ─────────────────────────────────────────────────────
export type RequestStatus = "Pending" | "Completed" | "Returned";

export interface RequestedItem {
  productID?: string;
  productName: string;
  quantity: number;
  unit?: string;
  warehouseID?: string;
}

export interface InventoryRequest {
  id?: string;
  submittedBy: string;
  submittedByUID: string;
  status: RequestStatus;
  timestamp?: Timestamp;
  items: RequestedItem[];
  warehouseID?: string;
  companyID?: string;
  completedAt?: Timestamp;
  completedBy?: string;
  completedByName?: string;
  notes?: string;
}

// ── Auth context ───────────────────────────────────────────────────────────
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  companyID: string;
  isAdmin: boolean;
  isManager: boolean;
  managePermissions: string[];
  officeIDs: string[];
}
