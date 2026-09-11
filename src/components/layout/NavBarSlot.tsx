"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Portals page-supplied controls into the mobile nav bar, so a screen can put
 * its own buttons (filter, add, avatar, Logout) up there the way the native
 * app does — without the nav bar needing to know about any given route.
 */
function Slot({ id, children }: { id: string; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById(id));
  }, [id]);

  if (!host) return null;
  return createPortal(children, host);
}

export function NavBarLeft({ children }: { children: ReactNode }) {
  return <Slot id="navbar-slot-left">{children}</Slot>;
}

export function NavBarRight({ children }: { children: ReactNode }) {
  return <Slot id="navbar-slot-right">{children}</Slot>;
}

/**
 * An always-visible inline title, for pushed screens that don't carry a large
 * title of their own. Without it the nav bar keeps its fade-in-on-scroll title.
 */
export function NavBarTitle({
  children,
  fade,
}: {
  children: ReactNode;
  /** Behave like the system title: hidden until the large title scrolls away. */
  fade?: boolean;
}) {
  return (
    <Slot id="navbar-slot-title">
      <span className={fade ? "navbar-title-fade" : undefined}>{children}</span>
    </Slot>
  );
}
