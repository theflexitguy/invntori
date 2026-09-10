import type { Timestamp } from "firebase/firestore";

// ── Inventory ──────────────────────────────────────────────────────────────
export interface FirestoreInventoryItem {
  id?: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderThreshold: number;
  warehouseID: string;
  details?: Record<string, string>;
  fieldroutesChemicalID?: number;
  isRetired?: boolean;
}

export interface Warehouse {
  id?: string;
  name: string;
  location: string;
  officeID?: string;
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
export type InviteStatus = "pending" | "accepted" | "declined";

export interface Employee {
  id?: string;
  name: string;
  email: string;
  role: string;
  isAdmin?: boolean;
  isManager?: boolean;
  isActive?: boolean;
  companyID?: string;
  officeIDs?: string[];
  inviteStatus?: InviteStatus;
  fcmToken?: string;
  createdAt?: Timestamp;
  managePermissions?: string[];
  notificationPreferences?: {
    lowStock?: boolean;
    reorderReminders?: boolean;
    purchaseOrders?: boolean;
    inventoryRequests?: boolean;
    repairRequests?: boolean;
    repairUpdates?: boolean;
    assetAssignments?: boolean;
  };
}

// ── Equipment ──────────────────────────────────────────────────────────────
export type EquipmentStatus = "available" | "checkedOut" | "inRepair" | "retired";
export type RepairStatus = "reported" | "approved" | "rejected" | "inProgress" | "completed";

export interface Equipment {
  id?: string;
  name: string;
  category: string;
  serialNumber?: string;
  status: EquipmentStatus;
  notes?: string;
  currentHolderUID?: string;
  currentHolderName?: string;
  currentCheckedOutAt?: Timestamp;
  customFields?: Record<string, string>;
  createdAt?: Timestamp;
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
  responseNote?: string;
}

// ── Fleet ──────────────────────────────────────────────────────────────────
export type VehicleCondition = "excellent" | "good" | "fair" | "poor";
export type MaintenanceType = "oilChange" | "tireRotation" | "inspection" | "brakes" | "transmission" | "other";

export interface Vehicle {
  id?: string;
  name: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  licensePlate?: string;
  color?: string;
  condition: VehicleCondition;
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
  type: MaintenanceType;
  description: string;
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
  submittedAt?: Timestamp;
  approvedAt?: Timestamp;
  receivedAt?: Timestamp;
  notes?: string;
  totalCost?: number;
}

// ── Inventory Requests ─────────────────────────────────────────────────────
export type RequestStatus = "pending" | "approved" | "denied" | "fulfilled";

export interface RequestedItem {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface InventoryRequest {
  id?: string;
  requestedByUID: string;
  requestedByName: string;
  items: RequestedItem[];
  status: RequestStatus;
  warehouseID?: string;
  warehouseName?: string;
  createdAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedByName?: string;
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
