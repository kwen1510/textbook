export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="min-h-screen bg-[#f6f0e7] px-6 py-12 text-stone-950">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-amber-200 bg-white/85 p-8 shadow-2xl shadow-stone-900/10">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">Setup required</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Connect Neon before studying</h1>
        <p className="mt-4 leading-7 text-stone-600">The app is implemented, but these environment variables are missing for private auth and synced notes/progress:</p>
        <ul className="mt-5 grid gap-2 font-mono text-sm text-stone-700">
          {missing.map((item) => <li key={item} className="rounded-xl bg-stone-100 px-3 py-2">{item}</li>)}
        </ul>
        <pre className="mt-6 overflow-auto rounded-2xl bg-stone-950 p-4 text-sm text-stone-50"><code>{`npx neonctl@latest init
npm run db:migrate
npm run dev`}</code></pre>
      </div>
    </main>
  );
}
