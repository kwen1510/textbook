"use client";

import { useTransition } from "react";

export function AuthControls({ userEmail }: { userEmail?: string }) {
  const [pending, startTransition] = useTransition();
  const localMode = userEmail === "local@textbook";

  return (
    <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
      {userEmail ? <span className="hidden text-stone-500 sm:inline">{userEmail}</span> : null}
      {localMode ? <span className="rounded-full border border-stone-200 bg-white/70 px-3 py-2 text-stone-700 shadow-sm">Local</span> : null}
      {!localMode ? (
        <button
          className="rounded-full border border-stone-300 px-3 py-2 text-stone-700 transition hover:border-stone-900 hover:text-stone-950 sm:px-4"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const { createAuthClient } = await import("@neondatabase/auth/next");
              const authClient = createAuthClient();
              await authClient.signOut();
              window.location.href = "/auth/sign-in";
            });
          }}
        >
          {pending ? "Signing out..." : "Sign out"}
        </button>
      ) : null}
    </div>
  );
}
