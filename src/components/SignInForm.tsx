"use client";

import { createAuthClient } from "@neondatabase/auth/next";
import { useState, useTransition } from "react";

const authClient = createAuthClient();

export function SignInForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-2xl shadow-stone-900/10 backdrop-blur">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">Private course</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">Sign in to your study room</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Pick up where you left off with your notes, progress, and study assistant synced privately.</p>
      </div>
      {notice ? <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{notice}</p> : null}
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(null);
          const form = new FormData(event.currentTarget);
          const email = String(form.get("email") ?? "");
          const password = String(form.get("password") ?? "");
          const name = String(form.get("name") ?? email);
          startTransition(async () => {
            try {
              const result = mode === "signin"
                ? await authClient.signIn.email({ email, password, callbackURL: "/" })
                : await authClient.signUp.email({ email, password, name, callbackURL: "/" });
              if (result.error) {
                setMessage(result.error.message ?? "Authentication failed");
                return;
              }
              const session = await authClient.getSession();
              if (session.error || !session.data?.user) {
                setMessage(session.error?.message ?? "Signed in, but the session was not ready. Try again in a moment.");
                return;
              }
              window.location.assign("/");
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Authentication failed");
            }
          });
        }}
      >
        {mode === "signup" ? (
          <label className="block text-sm font-medium text-stone-700">
            Name
            <input name="name" className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-amber-500 transition focus:ring-2" placeholder="Your name" />
          </label>
        ) : null}
        <label className="block text-sm font-medium text-stone-700">
          Email
          <input required name="email" type="email" className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-amber-500 transition focus:ring-2" placeholder="you@example.com" />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Password
          <input required name="password" type="password" minLength={8} className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-amber-500 transition focus:ring-2" placeholder="At least 8 characters" />
        </label>
        {message ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
        <button disabled={pending} className="w-full rounded-2xl bg-stone-950 px-5 py-3 font-semibold text-white transition hover:bg-amber-800 disabled:opacity-60">
          {pending ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button className="mt-4 w-full text-sm font-medium text-stone-600 hover:text-stone-950" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Need to create the first account?" : "Already have an account?"}</button>
    </div>
  );
}
