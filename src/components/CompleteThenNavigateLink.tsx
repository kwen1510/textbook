"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";

type Props = {
  href: string;
  sectionId: string;
  className?: string;
  children: ReactNode;
};

export function CompleteThenNavigateLink({ href, sectionId, className, children }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setPending(true);
    try {
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, state: "completed" }),
      });
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
