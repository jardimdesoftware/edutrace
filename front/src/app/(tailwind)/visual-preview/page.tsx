'use client';

import Navbar from '@/components/Navbar';
import { ChevronLeft, ChevronRight, Search, Trash2, UserPlus } from 'lucide-react';

export default function VisualPreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="edutrace-app-shell min-h-screen">
      <Navbar previewLevelLabel="Administrador" />

      <main className="mx-auto w-full max-w-[1500px] px-5 py-10 sm:px-8 lg:px-12">
        <section className="overflow-hidden rounded-2xl border border-[#dce8f4] bg-white/95 shadow-[0_14px_40px_rgba(28,67,112,0.08)]">
          <div className="p-4 sm:p-5">
            <h1 className="edutrace-page-title">Gestão de pessoas</h1>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <button type="button" className="inline-flex h-11 items-center gap-2 self-start rounded-lg bg-[#006ee8] px-4 text-sm font-bold text-white shadow-[0_6px_14px_rgba(0,110,232,0.20)] transition hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff]">
                <UserPlus className="h-5 w-5" aria-hidden="true" />
                Cadastrar novas pessoas
              </button>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 font-semibold text-[#0b2455]">
                  <span>Papel:</span>
                  <select className="h-11 min-w-48 rounded-lg border border-[#a9c5e8] bg-white px-3 outline-none focus:border-[#006ee8] focus:ring-4 focus:ring-[#dcecff]">
                    <option>Todos</option>
                    <option>Administrador</option>
                    <option>Profissional da Educação</option>
                  </select>
                </label>
                <label className="flex h-11 min-w-72 items-center gap-3 rounded-lg border border-[#a9c5e8] bg-white px-3 focus-within:border-[#006ee8] focus-within:ring-4 focus-within:ring-[#dcecff]">
                  <Search className="h-5 w-5 text-[#315a91]" aria-hidden="true" />
                  <span className="sr-only">Buscar pessoa por nome, CPF ou e-mail</span>
                  <input type="search" className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Por quem você busca?" />
                </label>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[760px] grid-cols-[1.2fr_1.4fr_1fr_auto] gap-4 bg-[#eef4fa] px-7 py-4 font-bold text-[#0b2455]">
              <span>Nome</span>
              <span>E-mail</span>
              <span>Papel</span>
              <span className="sr-only">Ações</span>
            </div>
            <div className="grid min-w-[760px] grid-cols-[1.2fr_1.4fr_1fr_auto] items-center gap-4 px-7 py-5 text-slate-600">
              <span>Administrador Padrão</span>
              <span>admin.local@edutrace.test</span>
              <span className="w-fit rounded-full bg-[#e4f0ff] px-3 py-1.5 font-semibold text-[#0b5fbd]">Administrador</span>
              <button type="button" aria-label="Excluir pessoa" className="rounded-lg border border-[#d9e5f2] p-2 text-red-600 transition hover:bg-red-50">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#dce8f4] px-7 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>Exibindo 1 de 1 usuário</span>
            <div className="flex items-center gap-2 font-semibold text-[#0b2455]">
              <span>Página 1 de 1</span>
              <button type="button" disabled className="rounded-lg border border-[#dce8f4] p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" disabled className="rounded-lg border border-[#dce8f4] p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
