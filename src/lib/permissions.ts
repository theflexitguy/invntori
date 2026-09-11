/** Manager permission flags, shared by the employee detail and edit screens. */
export const PERMISSION_KEYS = [
  { key: "manageInventory", label: "Manage Inventory" },
  { key: "manageRequests", label: "Manage Requests" },
  { key: "managePurchaseOrders", label: "Manage Purchase Orders" },
  { key: "manageEquipment", label: "Manage Equipment" },
  { key: "manageFleet", label: "Manage Fleet" },
  { key: "manageEmployees", label: "Manage Employees" },
  { key: "deleteProducts", label: "Delete Products" },
  { key: "deleteEquipment", label: "Delete Equipment" },
  { key: "deleteFleet", label: "Delete Fleet Vehicles" },
  { key: "deleteEmployees", label: "Delete Employees" },
] as const;
