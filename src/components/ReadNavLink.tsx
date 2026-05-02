"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export const LAST_COURSE_HREF_KEY = "textbook:last-course-href";

export function ReadNavLink({ fallbackHref, className, children }: { fallbackHref: string; className?: string; children?: ReactNode }) {
  const [href, setHref] = useState(fallbackHref);

  useEffect(() => {
    function refreshHref() {
      const saved = window.localStorage.getItem(LAST_COURSE_HREF_KEY);
      if (saved?.startsWith("/course/")) setHref(saved);
    }

    refreshHref();
    window.addEventListener("storage", refreshHref);
    window.addEventListener("course-location-change", refreshHref);
    return () => {
      window.removeEventListener("storage", refreshHref);
      window.removeEventListener("course-location-change", refreshHref);
    };
  }, []);

  return (
    <Link className={className} href={href}>
      {children ?? "Read"}
    </Link>
  );
}
