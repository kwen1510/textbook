"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import {
  readingNotesProgressEvent,
  type ReadingNotesProgressDetail,
} from "@/lib/reading-notes-events";

type Props = {
  href: string;
  sectionId?: string;
  sectionIds?: string[];
  className?: string;
  children: ReactNode;
};

export function CompleteThenNavigateLink({ href, sectionId, sectionIds = [], className, children }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const targetSectionIds = Array.from(new Set([...(sectionId ? [sectionId] : []), ...sectionIds]));

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setPending(true);
    try {
      if (targetSectionIds.length) {
        const response = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionIds: targetSectionIds, state: "completed" }),
        });
        if (response.ok) {
          for (const id of targetSectionIds) {
            window.dispatchEvent(new CustomEvent<ReadingNotesProgressDetail>(readingNotesProgressEvent, { detail: { sectionId: id, state: "completed" } }));
          }
        }
      }
    } finally {
      router.push(href);
    }
  }

  return (
    <a href={href} onClick={handleClick} aria-busy={pending} className={className}>
      {pending ? "Opening..." : children}
    </a>
  );
}
