export function RuntimeIssueNotice({ title, message, detail }: { title: string; message: string; detail?: string }) {
  return (
    <main className="min-h-screen bg-[#f6f0e7] px-6 py-12 text-stone-950">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-200 bg-white/85 p-8 shadow-2xl shadow-stone-900/10">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-red-700">Runtime check failed</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 leading-7 text-stone-600">{message}</p>
        {detail ? <pre className="mt-6 overflow-auto rounded-2xl bg-stone-950 p-4 text-sm text-stone-50"><code>{detail}</code></pre> : null}
        <p className="mt-5 text-sm leading-6 text-stone-500">Open <code className="rounded bg-stone-100 px-1.5 py-0.5">/api/health</code> on the deployed site to inspect environment and database readiness.</p>
      </div>
    </main>
  );
}
