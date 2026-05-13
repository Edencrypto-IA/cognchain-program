'use client';

export function ForgePageSkeleton() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0f0f10] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-16rem] h-96 w-[42rem] -translate-x-1/2 rounded-full bg-[#9945FF]/8 blur-3xl" />
        <div className="absolute right-[-10rem] bottom-[-12rem] h-96 w-96 rounded-full bg-[#14F195]/5 blur-3xl" />
      </div>
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#111113]/95 px-3 py-2">
        <div className="h-6 w-24 animate-pulse rounded-md bg-white/[0.06]" />
        <div className="hidden h-6 w-48 animate-pulse rounded-md bg-white/[0.05] md:block" />
        <div className="h-6 w-16 animate-pulse rounded-md bg-white/[0.06]" />
      </header>
      <div className="relative z-10 hidden min-h-0 flex-1 gap-2 p-2 lg:flex">
        <div className="w-[19%] min-w-[12rem] animate-pulse rounded-lg bg-white/[0.04]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="min-h-[55%] flex-1 animate-pulse rounded-lg bg-white/[0.045]" />
          <div className="h-[32%] min-h-[8rem] animate-pulse rounded-lg bg-white/[0.04]" />
        </div>
        <div className="w-[18%] min-w-[10rem] animate-pulse rounded-lg bg-white/[0.04]" />
      </div>
      <div className="relative z-10 flex flex-1 flex-col gap-3 overflow-y-auto p-3 lg:hidden">
        <div className="h-48 animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="h-64 animate-pulse rounded-xl bg-white/[0.045]" />
        <div className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />
      </div>
      <p className="relative z-10 px-3 pb-4 text-center text-[11px] text-white/28">A carregar Forge…</p>
    </main>
  );
}
