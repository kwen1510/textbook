import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f0e7] px-6 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">404</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-stone-950">Chapter not found</h1>
        <Link className="mt-6 inline-flex rounded-full bg-stone-950 px-5 py-3 font-semibold text-white" href="/">Back home</Link>
      </div>
    </main>
  );
}
