"use client";

import { createAuthClient } from "@neondatabase/auth/next";
import { useTransition } from "react";

const authClient = createAuthClient();

export function AuthControls({ userEmail }: { userEmail?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
      {userEmail ? <span className="hidden text-stone-500 sm:inline">{userEmail}</span> : null}
      <button
        className="rounded-full border border-stone-300 px-3 py-2 text-stone-700 transition hover:border-stone-900 hover:text-stone-950 sm:px-4"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await authClient.signOut();
            window.location.href = "/auth/sign-in";
          });
        }}
      >
        {pending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
