export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl space-y-6">
        <span className="inline-block rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
          Monorepo Initialized
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
          HirePair Web
        </h1>
        <p className="text-lg text-slate-400">
          Candidate Assistant & ATS CV Builder — Next.js 15, React 19, Tailwind CSS v4 e TypeScript
          em Monorepo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 text-left">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-emerald-400">⚡ Frontend App</h2>
            <p className="mt-2 text-xs text-slate-400">
              Next.js App Router com suporte total a React 19 e Tailwind CSS v4.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-sky-400">🚀 Backend API</h2>
            <p className="mt-2 text-xs text-slate-400">
              NestJS configurado em workspace para microsserviços e integração local.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-purple-400">🐳 Infra Local</h2>
            <p className="mt-2 text-xs text-slate-400">
              Docker Compose com PostgreSQL 16 e Redis 7 com healthchecks configurados.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
