import type { ComponentType } from "react";

type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  viewBox: "0 0 24 24",
  "aria-hidden": true,
} as const;

export function HomeIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

export function BoxIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

export function GearIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function ClipboardIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

export function ChatIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

export function ShieldIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

export function MenuIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function SignOutIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

export interface NavEntry {
  href: string;
  label: string;
  /** Shorter label for the bottom tab bar */
  tabLabel?: string;
  Icon: ComponentType<IconProps>;
}

export const mainNav: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", tabLabel: "Home", Icon: HomeIcon },
  { href: "/inventory", label: "Inventory", tabLabel: "Stock", Icon: BoxIcon },
  { href: "/equipment", label: "Equipment", tabLabel: "Gear", Icon: GearIcon },
  { href: "/requests", label: "My Requests", tabLabel: "Requests", Icon: ClipboardIcon },
];

export const chatNav: NavEntry = { href: "/chat", label: "Ask invntori", tabLabel: "Ask", Icon: ChatIcon };

/** Bottom tab bar on phones — the five most-used destinations. */
export const tabNav: NavEntry[] = [...mainNav, chatNav];

export const adminSections: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Admin Actions",
    items: [
      { href: "/employees", label: "Employees" },
      { href: "/admin/offices", label: "Offices" },
      { href: "/admin/warehouses", label: "Warehouses" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/unit-types", label: "Unit Types" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/detail-fields", label: "Detail Fields" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/requests", label: "Pending Requests" },
      { href: "/admin/bulk-edit", label: "Manual Adjustment" },
      { href: "/admin/equipment-repairs", label: "Equipment Repairs" },
      { href: "/orders", label: "Purchase Orders" },
      { href: "/fleet", label: "Fleet" },
    ],
  },
  {
    label: "Reports",
    items: [{ href: "/admin/valuation", label: "Inventory Valuation" }],
  },
];

export const ADMIN_PATHS = ["/employees", "/orders", "/fleet", "/admin"];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

const TITLES: [string, string][] = [
  ["/dashboard", "Dashboard"],
  ["/inventory", "Inventory"],
  ["/equipment", "Equipment"],
  ["/requests", "My Requests"],
  ["/chat", "Ask invntori"],
  ["/employees", "Employees"],
  ["/orders", "Purchase Orders"],
  ["/fleet", "Fleet"],
  ["/admin/offices", "Offices"],
  ["/admin/warehouses", "Warehouses"],
  ["/admin/settings", "Company Settings"],
  ["/admin/categories", "Categories"],
  ["/admin/unit-types", "Unit Types"],
  ["/admin/products", "Products"],
  ["/admin/detail-fields", "Detail Fields"],
  ["/admin/requests", "Pending Requests"],
  ["/admin/bulk-edit", "Manual Adjustment"],
  ["/admin/equipment-repairs", "Equipment Repairs"],
  ["/admin/valuation", "Inventory Valuation"],
  ["/admin", "Admin Center"],
];

/** Title shown in the mobile top bar for the current route. */
export function pageTitle(pathname: string): string {
  const match = TITLES.find(([href]) => isActivePath(pathname, href));
  return match?.[1] ?? "invntori";
}
