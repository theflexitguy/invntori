import type { ComponentType } from "react";

type IconProps = { className?: string };

/* ──────────────────────────────────────────────────────────────────────────
   Filled, SF-Symbol-shaped glyphs matching the native app's tab bar and
   section icons. Filled (not outlined) is what makes the tab bar read as iOS.
   ────────────────────────────────────────────────────────────────────────── */

const fill = { fill: "currentColor", viewBox: "0 0 24 24", "aria-hidden": true } as const;
const stroke = { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", "aria-hidden": true } as const;

/** chart.bar.fill */
export function ChartBarIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <rect x="3" y="12" width="3.6" height="9" rx="1.2" />
      <rect x="8.6" y="6" width="3.6" height="15" rx="1.2" />
      <rect x="14.2" y="9" width="3.6" height="12" rx="1.2" />
      <rect x="19.8" y="3" width="1.4" height="18" rx="0.7" opacity="0.001" />
    </svg>
  );
}

/** shippingbox.fill */
export function BoxIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M12 2.4 2.6 6.2a.6.6 0 0 0 0 1.11L12 11.1l9.4-3.79a.6.6 0 0 0 0-1.11L12 2.4Z" />
      <path d="M2.2 8.85v8.4c0 .5.3.94.76 1.12L11 21.5v-8.6L2.2 8.85Z" />
      <path d="M13 21.5l8.04-3.13c.46-.18.76-.62.76-1.12v-8.4L13 12.9v8.6Z" />
    </svg>
  );
}

/** wrench.and.screwdriver.fill */
export function ToolsIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      {/* wrench: head top-left, shaft running to bottom-right */}
      <path d="M8.9 2.4a4.85 4.85 0 0 0-4.6 6.4L2.2 10.9a1.5 1.5 0 0 0 0 2.12l1.06 1.06a1.5 1.5 0 0 0 2.12 0l2.1-2.1a4.85 4.85 0 0 0 6.06-6.2.75.75 0 0 0-1.24-.3l-1.9 1.9a1.2 1.2 0 0 1-1.7 0l-.6-.6a1.2 1.2 0 0 1 0-1.7l1.9-1.9a.75.75 0 0 0-.3-1.24 4.9 4.9 0 0 0-.8-.14Z" />
      <path d="m11.2 13.4 5.9 5.9a2.1 2.1 0 1 0 2.97-2.97l-5.9-5.9-2.97 2.97Z" />
      {/* screwdriver: tip bottom-left, handle top-right */}
      <path d="M18.4 2.3a1.4 1.4 0 0 1 1.98 0l1.32 1.32a1.4 1.4 0 0 1 0 1.98l-3.1 3.1-3.3-3.3 3.1-3.1Z" />
      <path d="m13.9 6.7 3.3 3.3-7.3 7.3-1.55 3.06a.7.7 0 0 1-1.15.17l-1.53-1.53a.7.7 0 0 1 .17-1.15L8.9 16.3l5-9.6Z" opacity="0" />
      <path d="m14.2 7.1 2.7 2.7-6.5 6.5-3.2 1.6a.65.65 0 0 1-.87-.87l1.6-3.2 6.27-6.73Z" />
    </svg>
  );
}

/** doc.text.magnifyingglass */
export function RequestsIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M6.5 2h6.1c.4 0 .78.16 1.06.44l3.9 3.9c.28.28.44.66.44 1.06V13a5.2 5.2 0 0 0-6.4 7.4c-.2.06-.4.1-.6.1H6.5A2.5 2.5 0 0 1 4 18V4.5A2.5 2.5 0 0 1 6.5 2Zm1.9 6.2a.85.85 0 0 0 0 1.7h5.2a.85.85 0 0 0 0-1.7H8.4Zm0 3.6a.85.85 0 0 0 0 1.7h3.4a.85.85 0 0 0 0-1.7H8.4Z" />
      <path d="M16.1 14.2a3.5 3.5 0 1 0 2.02 6.36l1.9 1.9a1 1 0 0 0 1.42-1.42l-1.9-1.9a3.5 3.5 0 0 0-3.44-4.94Zm0 1.8a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Z" />
    </svg>
  );
}

/** person.crop.circle.badge.checkmark */
export function AdminIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M11 2a9 9 0 1 0 4.4 16.86 5.2 5.2 0 0 1 3.46-7.7A9 9 0 0 0 11 2Zm0 3.6a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 13.9a7.4 7.4 0 0 1-5.2-2.14c.08-1.9 3.46-2.96 5.2-2.96 1.02 0 2.6.36 3.78 1.02a5.2 5.2 0 0 0 .32 3.5A7.36 7.36 0 0 1 11 19.5Z" />
      <path d="M18.6 12.8a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8Zm1.86 2.72-2.2 2.62a.7.7 0 0 1-1.04.04l-1.12-1.16a.7.7 0 1 1 1.0-.98l.57.59 1.73-2.06a.7.7 0 1 1 1.06.95Z" />
    </svg>
  );
}

/** sparkles — the "Ask invntori" glyph */
export function SparklesIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M12.9 3.2 14.2 6.8 17.8 8.1 14.2 9.4 12.9 13 11.6 9.4 8 8.1 11.6 6.8 12.9 3.2Z" />
      <path d="M6.2 12.6 7 14.8 9.2 15.6 7 16.4 6.2 18.6 5.4 16.4 3.2 15.6 5.4 14.8 6.2 12.6Z" />
      <path d="M17.6 14.4 18.3 16.3 20.2 17 18.3 17.7 17.6 19.6 16.9 17.7 15 17 16.9 16.3 17.6 14.4Z" />
    </svg>
  );
}

/* Section / list glyphs */

export function PeopleIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M9 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM9 13.2c-2.7 0-7 1.37-7 4.06V19.4c0 .33.27.6.6.6h12.8a.6.6 0 0 0 .6-.6v-2.14c0-2.69-4.3-4.06-7-4.06ZM17.2 11.2a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2ZM17.2 12.9c-.5 0-1.06.05-1.63.15 1.35 1.04 2.23 2.4 2.23 4.21V20h4a.6.6 0 0 0 .6-.6v-2.05c0-2.5-3.5-3.45-5.2-3.45Z" />
    </svg>
  );
}

export function BuildingIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M12 2.2 2.6 6.6a.9.9 0 0 0-.5.8v.5c0 .5.4.9.9.9h18c.5 0 .9-.4.9-.9v-.5a.9.9 0 0 0-.5-.8L12 2.2ZM4.8 10.4v7.2H3.5a.9.9 0 0 0 0 1.8h17a.9.9 0 0 0 0-1.8h-1.3v-7.2h-1.9v7.2h-2.4v-7.2h-1.9v7.2h-2.2v-7.2H9v7.2H6.7v-7.2H4.8Z" />
    </svg>
  );
}

export function GridIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M4 4h6.2v6.2H4V4Zm9.8 0H20v6.2h-6.2V4ZM4 13.8h6.2V20H4v-6.2Zm9.8 0H20V20h-6.2v-6.2Z" />
    </svg>
  );
}

export function RulerIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M2.8 8.6h18.4c.44 0 .8.36.8.8v5.2c0 .44-.36.8-.8.8H2.8a.8.8 0 0 1-.8-.8V9.4c0-.44.36-.8.8-.8Zm2.6 1.6v2.2h1.4v-2.2H5.4Zm3.4 0v3.2h1.4v-3.2H8.8Zm3.4 0v2.2h1.4v-2.2h-1.4Zm3.4 0v3.2h1.4v-3.2h-1.4Z" />
    </svg>
  );
}

export function FieldsIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M4.4 5.2a1 1 0 0 1 1-1h1.2v-.9a.9.9 0 0 1 1.8 0v.9h1.2a1 1 0 0 1 0 2H8.4v.9a.9.9 0 1 1-1.8 0v-.9H5.4a1 1 0 0 1-1-1Zm8.2-.1h7.2a.9.9 0 0 1 0 1.8h-7.2a.9.9 0 0 1 0-1.8ZM4 12a.9.9 0 0 1 .9-.9h15a.9.9 0 0 1 0 1.8h-15A.9.9 0 0 1 4 12Zm0 5.9a.9.9 0 0 1 .9-.9h15a.9.9 0 0 1 0 1.8h-15a.9.9 0 0 1-.9-.9Z" />
    </svg>
  );
}

export function WarehouseIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M12 2.6 2.8 7.1a1 1 0 0 0-.55.9V20a.9.9 0 0 0 .9.9h2.6V11.4c0-.5.4-.9.9-.9h10.7c.5 0 .9.4.9.9v9.5h2.6a.9.9 0 0 0 .9-.9V8a1 1 0 0 0-.55-.9L12 2.6ZM7.5 12.3v8.6h9V12.3h-9Zm1.7 1.6h5.6v1.7H9.2v-1.7Zm0 3.3h5.6v1.7H9.2v-1.7Z" />
    </svg>
  );
}

export function PencilIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M3.4 16.6 14.9 5.1l4 4L7.4 20.6H3.4v-4Zm14-14.1a1.4 1.4 0 0 1 2 0l2.1 2.1a1.4 1.4 0 0 1 0 2l-1.5 1.5-4.1-4.1 1.5-1.5Z" />
    </svg>
  );
}

export function InboxIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M5.1 3.4h13.8c.42 0 .79.27.9.68l2.1 7.36c.03.1.04.2.04.3v7.36c0 .5-.4.9-.9.9H3c-.5 0-.9-.4-.9-.9V11.7c0-.1.01-.2.04-.3L4.2 4.1c.11-.4.48-.68.9-.68Zm.5 1.9-1.6 5.6h4.3l.9 2.1h5.6l.9-2.1H20L18.4 5.3H5.6Z" />
    </svg>
  );
}

export function CartIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M2.9 3.1h1.9c.44 0 .82.3.9.74L6 5.9h14.2a.9.9 0 0 1 .87 1.13l-1.9 7a.9.9 0 0 1-.87.67H8.5l.36 1.8h9.24a.9.9 0 0 1 0 1.8H8.1a.9.9 0 0 1-.88-.72L4.13 4.9H2.9a.9.9 0 1 1 0-1.8ZM8.6 19.1a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Zm8.6 0a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Z" />
    </svg>
  );
}

export function CarIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M5.5 5.6A2 2 0 0 1 7.4 4.2h9.2a2 2 0 0 1 1.9 1.4l1.3 3.8c.7.4 1.2 1.15 1.2 2.02v5.3c0 .5-.4.9-.9.9h-1.3a.9.9 0 0 1-.9-.9v-1H6.1v1c0 .5-.4.9-.9.9H3.9a.9.9 0 0 1-.9-.9v-5.3c0-.87.5-1.62 1.2-2.02l1.3-3.8ZM7.6 6l-1 3h10.8l-1-3H7.6ZM6.6 11.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm10.8 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" />
    </svg>
  );
}

export function ChartLineIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M21.1 5.6a.9.9 0 0 0-.9-.9h-4.4a.9.9 0 0 0 0 1.8h2.2l-5.1 5.6-3.3-3.2a.9.9 0 0 0-1.28.02l-5.1 5.5a.9.9 0 1 0 1.32 1.22l4.47-4.82 3.3 3.2a.9.9 0 0 0 1.29-.03l5.8-6.35v2.3a.9.9 0 0 0 1.8 0V5.6Z" />
    </svg>
  );
}

export function DollarChartIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M4.4 12.4h2.4c.5 0 .9.4.9.9v6.3c0 .5-.4.9-.9.9H4.4a.9.9 0 0 1-.9-.9v-6.3c0-.5.4-.9.9-.9Zm6.4-4.6h2.4c.5 0 .9.4.9.9v10.9c0 .5-.4.9-.9.9h-2.4a.9.9 0 0 1-.9-.9V8.7c0-.5.4-.9.9-.9Zm6.4-4.6h2.4c.5 0 .9.4.9.9v15.5c0 .5-.4.9-.9.9h-2.4a.9.9 0 0 1-.9-.9V4.1c0-.5.4-.9.9-.9Z" />
    </svg>
  );
}

export function GearIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm9.1 3.6c0-.55-.05-1.09-.15-1.6l1.85-1.36-1.9-3.3-2.13.86a8.9 8.9 0 0 0-2.77-1.6L15.6 2.2h-3.8L11.4 2.2h-.2l-.3 2.8a8.9 8.9 0 0 0-2.77 1.6L6 5.74l-1.9 3.3L5.95 10.4a9.1 9.1 0 0 0 0 3.2L4.1 14.96l1.9 3.3 2.13-.86a8.9 8.9 0 0 0 2.77 1.6l.3 2.8h3.8l.3-2.8a8.9 8.9 0 0 0 2.77-1.6l2.13.86 1.9-3.3-1.85-1.36c.1-.51.15-1.05.15-1.6Z" />
    </svg>
  );
}

/** flask / beaker — sprayer-class equipment */
export function FlaskIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M9.6 2.4h4.8a.9.9 0 0 1 0 1.8h-.5v3.63c0 .43.12.85.36 1.21l4.9 7.5A3.1 3.1 0 0 1 16.57 21H7.43a3.1 3.1 0 0 1-2.59-4.46l4.9-7.5c.24-.36.36-.78.36-1.21V4.2h-.5a.9.9 0 0 1 0-1.8Zm1.7 1.8v3.63c0 .78-.23 1.55-.65 2.2L9.3 12h5.4l-1.35-1.97a4.02 4.02 0 0 1-.65-2.2V4.2h-1.4Z" />
    </svg>
  );
}

/** line.3.horizontal.decrease.circle — the filter button */
export function FilterCircleIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <circle cx="12" cy="12" r="9.3" strokeWidth={1.7} />
      <path strokeLinecap="round" strokeWidth={1.7} d="M7.4 9.3h9.2M8.9 12h6.2M10.4 14.7h3.2" />
    </svg>
  );
}

/** person.fill — an individual employee */
export function PersonIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M12 11.6a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6Zm0 1.9c-3.1 0-8.2 1.6-8.2 4.7v2.2c0 .33.27.6.6.6h15.2a.6.6 0 0 0 .6-.6v-2.2c0-3.1-5.1-4.7-8.2-4.7Z" />
    </svg>
  );
}

/** person.3.fill — admin / manager */
export function PersonGroupIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M12 11.2a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Zm0 1.7c-2.3 0-5.6 1.2-5.6 3.5v2.4c0 .33.27.6.6.6h10a.6.6 0 0 0 .6-.6v-2.4c0-2.3-3.3-3.5-5.6-3.5ZM4.6 10.4a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Zm0 1.6c-1.4 0-4.1.8-4.1 2.7v2.1c0 .33.27.6.6.6H4.6v-1.7c0-1.36.62-2.5 1.6-3.34-.55-.24-1.14-.36-1.6-.36ZM19.4 10.4a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Zm0 1.6c-.46 0-1.05.12-1.6.36.98.84 1.6 1.98 1.6 3.34v1.7h3.5a.6.6 0 0 0 .6-.6v-2.1c0-1.9-2.7-2.7-4.1-2.7Z" />
    </svg>
  );
}

/** envelope.fill */
export function EnvelopeIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M2.4 7.05 12 12.6l9.6-5.55A2.5 2.5 0 0 0 19.2 5.2H4.8a2.5 2.5 0 0 0-2.4 1.85Zm19.3 1.98-9.25 5.35a.9.9 0 0 1-.9 0L2.3 9.03V16.3a2.5 2.5 0 0 0 2.5 2.5h14.4a2.5 2.5 0 0 0 2.5-2.5V9.03Z" />
    </svg>
  );
}

/** link.circle — integrations */
export function LinkIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M9.4 13.2a3.9 3.9 0 0 0 5.5 0l3.4-3.4a3.9 3.9 0 1 0-5.5-5.5l-1.6 1.6a.95.95 0 1 0 1.34 1.34l1.6-1.6a2 2 0 1 1 2.82 2.82l-3.4 3.4a2 2 0 0 1-2.83 0 .95.95 0 1 0-1.33 1.34Zm5.2-2.4a3.9 3.9 0 0 0-5.5 0l-3.4 3.4a3.9 3.9 0 1 0 5.5 5.5l1.6-1.6a.95.95 0 1 0-1.34-1.34l-1.6 1.6a2 2 0 1 1-2.82-2.82l3.4-3.4a2 2 0 0 1 2.83 0 .95.95 0 1 0 1.33-1.34Z" />
    </svg>
  );
}

/** checkmark.circle.fill */
export function CheckCircleIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M12 2.2a9.8 9.8 0 1 0 0 19.6 9.8 9.8 0 0 0 0-19.6Zm5.05 7.2-6 7.1a.95.95 0 0 1-1.4.06l-3.1-3.1a.95.95 0 1 1 1.34-1.34l2.37 2.36 5.34-6.31a.95.95 0 1 1 1.45 1.23Z" />
    </svg>
  );
}

/** circle (unchecked) */
export function CircleIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <circle cx="12" cy="12" r="9" strokeWidth={1.6} />
    </svg>
  );
}

/** person.crop.circle */
export function PersonCircleIcon({ className = "w-6 h-6" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <circle cx="12" cy="12" r="9.4" strokeWidth={1.6} />
      <circle cx="12" cy="9.6" r="3.1" fill="currentColor" stroke="none" />
      <path d="M5.7 19.4c1.1-2.4 3.5-3.7 6.3-3.7s5.2 1.3 6.3 3.7" strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** slider.horizontal.3 */
export function SlidersIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...fill}>
      <path d="M3 6.6h9.2a2.8 2.8 0 0 0 5.4 0H21a.9.9 0 0 0 0-1.8h-3.4a2.8 2.8 0 0 0-5.4 0H3a.9.9 0 0 0 0 1.8Zm18 4.5h-9.2a2.8 2.8 0 0 0-5.4 0H3a.9.9 0 1 0 0 1.8h3.4a2.8 2.8 0 0 0 5.4 0H21a.9.9 0 0 0 0-1.8Zm0 6.3h-3.4a2.8 2.8 0 0 0-5.4 0H3a.9.9 0 0 0 0 1.8h9.2a2.8 2.8 0 0 0 5.4 0H21a.9.9 0 0 0 0-1.8Z" />
    </svg>
  );
}

/* Outline utility glyphs */

export function ChevronRightIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ChevronLeftIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
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

export function SignOutIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

/* ── Navigation model ─────────────────────────────────────────────────────── */

export interface NavEntry {
  href: string;
  label: string;
  Icon: ComponentType<IconProps>;
  /** Only shown to admins */
  adminOnly?: boolean;
}

export const mainNav: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", Icon: ChartBarIcon },
  { href: "/inventory", label: "Inventory", Icon: BoxIcon },
  { href: "/equipment", label: "Equipment", Icon: ToolsIcon },
  { href: "/requests", label: "My Requests", Icon: RequestsIcon },
];

/**
 * Bottom tab bar, matching the native app: four shared destinations plus
 * Admin. Non-admins get Account in that slot so sign-out is always reachable.
 */
export function tabsFor(isAdmin: boolean): NavEntry[] {
  return [
    ...mainNav,
    isAdmin
      ? { href: "/admin", label: "Admin", Icon: AdminIcon }
      : { href: "/account", label: "Account", Icon: AdminIcon },
  ];
}

export interface AdminItem {
  href: string;
  label: string;
  Icon: ComponentType<IconProps>;
}

/** Grouped exactly like the native Admin tab. */
export const adminSections: { label: string; items: AdminItem[] }[] = [
  {
    label: "Admin Actions",
    items: [
      { href: "/employees", label: "Manage Employees", Icon: PeopleIcon },
      { href: "/admin/offices", label: "Manage Offices", Icon: BuildingIcon },
      { href: "/admin/categories", label: "Manage Categories", Icon: GridIcon },
      { href: "/admin/unit-types", label: "Manage Unit Types", Icon: RulerIcon },
      { href: "/admin/detail-fields", label: "Manage Product Detail Fields", Icon: FieldsIcon },
      { href: "/admin/warehouses", label: "Manage Warehouses", Icon: WarehouseIcon },
      { href: "/admin/products", label: "Manage Products", Icon: BoxIcon },
    ],
  },
  {
    label: "Inventory Actions",
    items: [
      { href: "/admin/bulk-edit", label: "Manual Inventory Adjustment", Icon: PencilIcon },
      { href: "/admin/requests", label: "View Pending Requests", Icon: InboxIcon },
    ],
  },
  {
    label: "Purchase Orders",
    items: [{ href: "/orders", label: "Purchase Orders", Icon: CartIcon }],
  },
  {
    label: "Equipment & Fleet",
    items: [
      { href: "/fleet", label: "Fleet Management", Icon: CarIcon },
      { href: "/admin/equipment-repairs", label: "Equipment Repairs", Icon: ToolsIcon },
    ],
  },
  {
    label: "Reports",
    items: [{ href: "/admin/valuation", label: "Inventory Valuation", Icon: DollarChartIcon }],
  },
  {
    label: "Company",
    items: [{ href: "/admin/settings", label: "Company Settings", Icon: GearIcon }],
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
  ["/account", "Account"],
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
  ["/admin", "Admin"],
];

/** Title shown in the mobile nav bar for the current route. */
export function pageTitle(pathname: string): string {
  const match = TITLES.find(([href]) => isActivePath(pathname, href));
  return match?.[1] ?? "invntori";
}

/** Root tab destinations show no back button, exactly like a native tab bar. */
const ROOT_ROUTES = new Set([
  "/dashboard",
  "/inventory",
  "/equipment",
  "/requests",
  "/admin",
  "/account",
  "/chat",
]);

export function isRootRoute(pathname: string): boolean {
  return ROOT_ROUTES.has(pathname);
}


/** Sprayer-class categories get the flask glyph; everything else, tools. */
export function equipmentGlyph(category?: string): ComponentType<IconProps> {
  const c = (category ?? "").toLowerCase();
  if (c.includes("spray") || c.includes("chemical") || c.includes("tank")) return FlaskIcon;
  return ToolsIcon;
}
