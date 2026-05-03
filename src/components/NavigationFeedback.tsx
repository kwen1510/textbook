"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

function getInternalDestination(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const current = new URL(window.location.href);
  const next = new URL(anchor.href, current);
  if (next.origin !== current.origin) return null;

  const sameDocument = next.pathname === current.pathname && next.search === current.search;
  if (sameDocument) return null;

  return next;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState("Opening");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setVisible(false), 0);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    return () => window.clearTimeout(hideTimer);
  }, [pathname]);

  useEffect(() => {
    function hideSoon() {
      window.setTimeout(() => setVisible(false), 120);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !getInternalDestination(anchor)) return;

      const text = anchor.textContent?.replace(/\s+/g, " ").trim();
      setLabel(text ? `Opening ${text.slice(0, 36)}` : "Opening");
      setVisible(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setVisible(false), 8000);
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("pageshow", hideSoon);
    window.addEventListener("popstate", hideSoon);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", hideSoon);
      window.removeEventListener("popstate", hideSoon);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[120] transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
      aria-hidden={!visible}
    >
      <div className="h-1 overflow-hidden bg-amber-100">
        <div className="navigation-feedback-bar h-full w-1/2 rounded-r-full bg-stone-950" />
      </div>
      <div className="mx-auto mt-3 flex max-w-7xl justify-end px-4 sm:px-6">
        <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white/95 px-4 py-2 text-sm font-semibold text-stone-800 shadow-xl shadow-stone-900/10 backdrop-blur">
          <span className="size-2 animate-pulse rounded-full bg-amber-500" />
          {label}...
        </div>
      </div>
    </div>
  );
}
