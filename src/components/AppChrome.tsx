import Link from "next/link";
import type { ReactNode } from "react";
import { getChapters } from "@/lib/course";
import { AuthControls } from "./AuthControls";
import { ReadNavLink } from "./ReadNavLink";

export function AppChrome({ children, userEmail }: { children: ReactNode; userEmail: string }) {
  const chapters = getChapters();
  return (
    <div className="min-h-screen bg-[#f6f0e7] text-stone-950">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#f6f0e7]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2 truncate font-semibold tracking-tight" aria-label="Textbook home">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-stone-950 text-amber-300 shadow-sm">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
                <path d="M5.25 4.5c0-.69.56-1.25 1.25-1.25h10.75c.83 0 1.5.67 1.5 1.5v14.5a.75.75 0 0 1-.75.75H6.75a2.5 2.5 0 0 1-2.5-2.5v-13Z" fill="currentColor" opacity="0.28" />
                <path d="M6.75 3.25h10.5c.83 0 1.5.67 1.5 1.5v13.5H6.75a1 1 0 1 0 0 2h11.5a.75.75 0 0 0 0-1.5H6.75a2.5 2.5 0 0 1-2.5-2.5V5.75a2.5 2.5 0 0 1 2.5-2.5Zm0 1.5a1 1 0 0 0-1 1v10.95c.31-.13.65-.2 1-.2h10.5V4.75H6.75Z" fill="currentColor" />
                <path d="M8 7.5h7.25M8 10h5.75" stroke="#fafaf9" strokeWidth="1.35" strokeLinecap="round" />
              </svg>
            </span>
            <span className="truncate">Textbook</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-stone-600 md:flex">
            <ReadNavLink fallbackHref={`/course/${chapters[0]?.slug ?? ""}`} className="hover:text-stone-950">Read</ReadNavLink>
            <Link href="/notes" className="hover:text-stone-950">Notes</Link>
            <Link href="/review" className="hover:text-stone-950">Review</Link>
          </nav>
          <AuthControls userEmail={userEmail} />
        </div>
        <nav className="mx-auto grid max-w-7xl grid-cols-3 gap-2 px-4 pb-3 text-center text-sm font-semibold md:hidden">
          <ReadNavLink fallbackHref={`/course/${chapters[0]?.slug ?? ""}`} className="rounded-full border border-stone-200 bg-white/70 px-3 py-2 text-stone-800 shadow-sm">Read</ReadNavLink>
          <Link href="/notes" className="rounded-full border border-stone-200 bg-white/70 px-3 py-2 text-stone-800 shadow-sm">Notes</Link>
          <Link href="/review" className="rounded-full border border-stone-200 bg-white/70 px-3 py-2 text-stone-800 shadow-sm">Review</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
