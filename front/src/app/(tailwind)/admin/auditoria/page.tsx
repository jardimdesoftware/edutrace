'use client';

import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from '@/components/form/botoes';
import { exportAuditLogs, listAuditLogs } from '@/api/auditLogs';
import {
  ACOES,
  csvDaAuditoria,
  ENTIDADES,
  linhasDasMudancas,
  rotuloDaEntidade,
  totalDePaginas,
  type AcaoDaAuditoria,
  type FiltrosDaAuditoria,
  type PaginaDaAuditoria,
  type RegistroDaAuditoria,
} from '@/utils/auditoria';

const CAMPO = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600';
const LIMITE_DA_BUSCA = 200;

type Resposta = { chave: string; pagina?: PaginaDaAuditoria; erro?: string };

function DetalheDoRegistro({ registro }: { registro: RegistroDaAuditoria }) {
  const linhas = linhasDasMudancas(registro.changes);

  return (
    <div className="space-y-3 text-sm">
      {linhas.length > 0 && (
        <table className="w-full table-fixed border-collapse overflow-hidden rounded-md bg-white text-left">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-1/4 px-3 py-2 font-semibold">Campo</th>
              <th className="px-3 py-2 font-semibold">Antes</th>
              <th className="px-3 py-2 font-semibold">Depois</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.campo} className="border-t border-slate-100 align-top">
                <td className="break-words px-3 py-2 font-mono text-xs text-slate-700">{linha.campo}</td>
                <td className="whitespace-pre-wrap break-words px-3 py-2 text-red-700">{linha.de}</td>
                <td className="whitespace-pre-wrap break-words px-3 py-2 text-emerald-800">{linha.para}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {registro.detail && (
        <pre className="whitespace-pre-wrap break-words rounded-md bg-white p-3 text-xs text-slate-700">
          {JSON.stringify(registro.detail, null, 2)}
        </pre>
      )}
      <p className="text-xs text-slate-500">
        {registro.method} {registro.route ?? '(tarefa do sistema)'}
        {registro.ip ? ` · IP ${registro.ip}` : ''}
      </p>
    </div>
  );
}

function baixarCsv(conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditoriaPage() {
  const [rascunho, setRascunho] = useState<FiltrosDaAuditoria>({});
  const [filtros, setFiltros] = useState<FiltrosDaAuditoria>({ page: 1 });
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [exportando, setExportando] = useState(false);
  const [avisoDaExportacao, setAvisoDaExportacao] = useState<string | null>(null);
  const chave = JSON.stringify(filtros);

  useEffect(() => {
    let cancelado = false;
    listAuditLogs(filtros)
      .then((pagina) => !cancelado && setResposta({ chave, pagina }))
      .catch((erro: unknown) => {
        if (!cancelado) {
          setResposta({ chave, erro: erro instanceof Error ? erro.message : 'Falha ao carregar o log.' });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [filtros, chave]);

  const carregando = resposta?.chave !== chave;
  const pagina = resposta?.chave === chave ? resposta.pagina : undefined;
  const erro = resposta?.chave === chave ? resposta.erro : undefined;
  const paginaAtual = filtros.page ?? 1;
  const ultimaPagina = pagina ? totalDePaginas(pagina) : 1;

  const pesquisar = (evento: FormEvent) => {
    evento.preventDefault();
    setFiltros({ ...rascunho, page: 1 });
  };

  const exportar = async () => {
    setExportando(true);
    setAvisoDaExportacao(null);
    try {
      const { items, truncated } = await exportAuditLogs(filtros);
      baixarCsv(csvDaAuditoria(items));
      if (truncated) {
        setAvisoDaExportacao(`O arquivo traz os ${items.length} registros mais recentes. Use os filtros para exportar o restante.`);
      }
    } catch (falha: unknown) {
      setAvisoDaExportacao(falha instanceof Error ? falha.message : 'Falha ao exportar o log.');
    } finally {
      setExportando(false);
    }
  };

  const irPara = (page: number) => setFiltros({ ...filtros, page });
  const atualizar = (campo: keyof FiltrosDaAuditoria, valor: string) =>
    setRascunho({ ...rascunho, [campo]: valor });

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl p-5 sm:p-7">
        <h1 className="edutrace-page-title">Log de auditoria</h1>
        <p className="mt-2 text-slate-600">
          Registro de quem alterou o quê e quando. Os registros não podem ser editados nem apagados.
        </p>

        <form onSubmit={pesquisar} className="mt-6 grid gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-medium text-slate-700 lg:col-span-2">
            Pesquisar
            <input
              type="search"
              className={CAMPO}
              maxLength={LIMITE_DA_BUSCA}
              placeholder="Nome ou e-mail de quem fez, tabela ou rota"
              value={rascunho.search ?? ''}
              onChange={(e) => atualizar('search', e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Ação
            <select className={CAMPO} value={rascunho.action ?? ''} onChange={(e) => atualizar('action', e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ACOES).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700 lg:col-span-2">
            Registro
            <select className={CAMPO} value={rascunho.entity ?? ''} onChange={(e) => atualizar('entity', e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ENTIDADES).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            De
            <input type="date" className={CAMPO} value={rascunho.from ?? ''} onChange={(e) => atualizar('from', e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Até
            <input type="date" className={CAMPO} value={rascunho.to ?? ''} onChange={(e) => atualizar('to', e.target.value)} />
          </label>
          <div className="flex items-end gap-3 lg:col-span-3">
            <button type="submit" className={BOTAO_PRIMARIO}>
              <Search className="h-4 w-4" aria-hidden="true" />
              Filtrar
            </button>
            <button
              type="button"
              className={BOTAO_SECUNDARIO}
              onClick={() => {
                setRascunho({});
                setFiltros({ page: 1 });
              }}
            >
              Limpar
            </button>
            <button type="button" className={`${BOTAO_SECUNDARIO} ml-auto`} onClick={exportar} disabled={exportando}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {exportando ? 'Exportando...' : 'Exportar CSV'}
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">A exportação usa os filtros aplicados e também fica registrada no log.</p>
        {avisoDaExportacao && <p role="status" className="mt-2 text-sm text-amber-700">{avisoDaExportacao}</p>}

        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white" aria-busy={carregando}>
          {erro && <p role="alert" className="p-4 text-red-700">{erro}</p>}
          {carregando && <p className="p-4 text-slate-600">Carregando...</p>}
          {pagina && pagina.items.length === 0 && <p className="p-4 text-slate-600">Nenhum registro encontrado.</p>}
          {pagina && pagina.items.length > 0 && (
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Quando</th>
                  <th className="px-4 py-3 font-semibold">Quem</th>
                  <th className="px-4 py-3 font-semibold">Ação</th>
                  <th className="px-4 py-3 font-semibold">Registro</th>
                  <th className="px-4 py-3 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {pagina.items.map((registro) => (
                  <Fragment key={registro.id}>
                    <tr className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-4 py-3">{new Date(registro.created_at).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3">
                        <span className="block font-medium text-slate-800">{registro.actor_name ?? 'Sistema ou visitante'}</span>
                        {registro.actor_email && <span className="block text-slate-500">{registro.actor_email}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {ACOES[registro.action as AcaoDaAuditoria] ?? registro.action}
                        {!registro.succeeded && (
                          <span className="mt-1 block text-xs text-amber-700">Requisição falhou: a alteração pode ter sido desfeita</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rotuloDaEntidade(registro.entity)}
                        {registro.entity_id !== null && <span className="text-slate-500"> #{registro.entity_id}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-emerald-700 underline"
                          aria-expanded={aberto === registro.id}
                          aria-controls={`detalhe-${registro.id}`}
                          onClick={() => setAberto(aberto === registro.id ? null : registro.id)}
                        >
                          {aberto === registro.id ? 'Ocultar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                    {aberto === registro.id && (
                      <tr id={`detalhe-${registro.id}`} className="bg-slate-50">
                        <td colSpan={5} className="px-4 py-4">
                          <DetalheDoRegistro registro={registro} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagina && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{pagina.total} registro(s)</span>
            <div className="flex items-center gap-3">
              <button type="button" className={BOTAO_SECUNDARIO} disabled={paginaAtual <= 1} onClick={() => irPara(paginaAtual - 1)} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span aria-live="polite">Página {paginaAtual} de {ultimaPagina}</span>
              <button type="button" className={BOTAO_SECUNDARIO} disabled={paginaAtual >= ultimaPagina} onClick={() => irPara(paginaAtual + 1)} aria-label="Próxima página">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
