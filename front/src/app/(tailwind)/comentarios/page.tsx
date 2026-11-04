'use client';

import { Suspense, useEffect, useState } from 'react';
import { rotulosDosPapeis, temPapel } from '@/utils/papeis';
import AppLayout from '@/components/AppLayout';
import Loading from '@/components/Loading';
import { postComment, updateComment } from '@/api/comments';
import { useAuth } from '@/contexts/AuthContext';
import { CommentData, CommentType } from '@/interfaces/CommentData';
import { formatarData } from '@/utils/formatDate';
import { buildPreviousVersions, lastEditedAt } from '@/utils/commentVersions';
import {
  AREAS,
  CommentFilters,
  FILTROS_VAZIOS,
  erroDaBusca,
  filtrosAtivos,
} from '@/utils/commentFilters';
import { resumoDaContagem } from '@/utils/commentPages';
import {
  AVISO_DE_TEXTO_LIMPO,
  LIMITE_DO_TIPO,
  ROTULO_DO_TIPO,
  TIPOS_DE_ANOTACAO,
  erroDeTexto,
  montarNovaAnotacao,
  textoParaEditar,
} from '@/utils/commentTypes';
import TextAreaField from '@/components/form/TextAreaField';
import { ESTUDANTE } from '@/consts';
import { NIVEIS_PROFISSIONAIS } from '@/utils/pageAccess';
import { ChevronDown, History, Pencil, Search, SlidersHorizontal } from 'lucide-react';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { useEstudanteDaUrl } from '@/hooks/useEstudanteDaUrl';
import { useAnotacoes } from '@/hooks/useAnotacoes';
import { BOTAO_SECUNDARIO } from '@/components/form/botoes';

const LIMITE_EDICOES = 10;

// Mesmo teto de COMMENT_SEARCH_MAX_LENGTH no back: acima dele a API responde 400.
const LIMITE_DA_BUSCA = 200;

// O relatório tem 10 vezes o limite da anotação, então o campo é mais alto. O
// campo da criação fica fixo no topo, por isso a altura não passa de 6 linhas.
const LINHAS_DO_TIPO: Record<CommentType, number> = {
  NOTE: 4,
  CLASS_COUNCIL_REPORT: 6,
};

// A cor só reforça: o tipo é dito pelo texto do rótulo.
const ESTILO_DO_ROTULO_DO_TIPO: Record<CommentType, string> = {
  NOTE: 'bg-gray-100 text-gray-700',
  CLASS_COUNCIL_REPORT: 'bg-emerald-100 text-emerald-900',
};

function avisarErro(titulo: string, erro: unknown) {
  Swal.fire({
    icon: 'error',
    title: titulo,
    text:
      erro instanceof Error ? erro.message : 'Erro ao processar requisição',
    confirmButtonColor: '#047857',
    confirmButtonText: 'Entendi',
  });
}

export default function AnotacoesMultiprofissionaisPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <AnotacoesMultiprofissionais />
    </Suspense>
  );
}

function AnotacoesMultiprofissionais() {
  const { registro, nome: nomeEstudante, carregando } = useEstudanteDaUrl();
  const router = useRouter();

  const [novaAnotacao, setNovaAnotacao] = useState('');
  const [tipoNovo, setTipoNovo] = useState<CommentType>('NOTE');
  const [avisarPorEmail, setAvisarPorEmail] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [textoFoiLimpo, setTextoFoiLimpo] = useState(false);
  const [avisarEdicaoPorEmail, setAvisarEdicaoPorEmail] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [historicosAbertos, setHistoricosAbertos] = useState<number[]>([]);
  const [filtros, setFiltros] = useState<CommentFilters>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const { user, loading } = useAuth();
  const token = user;
  const isStudent = temPapel(token?.roles, ESTUDANTE);

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
    }
  }, [loading, token, router]);

  // O estudante vê as próprias anotações (token.sub); o profissional, as do
  // estudante indicado pelo id da URL.
  const targetId = isStudent ? token?.sub ?? null : registro?.id ?? null;

  const {
    pagina,
    carregando: carregandoAnotacoes,
    carregandoMais,
    erro: erroDaLista,
    erroMais,
    temMais,
    carregarMais,
    recarregar,
  } = useAnotacoes(targetId, filtros);
  const anotacoes = pagina?.items ?? [];
  const filtrando = filtrosAtivos(filtros);
  const erroDaBuscaDigitada = erroDaBusca(filtros.busca);

  const atualizarFiltro = <K extends keyof CommentFilters>(
    campo: K,
    valor: CommentFilters[K],
  ) => {
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
  };

  const limparFiltros = () => setFiltros(FILTROS_VAZIOS);

  const podeAnotar =
    !!token && temPapel(token.roles, ...NIVEIS_PROFISSIONAIS) && targetId !== null;
  const alvoDaAnotacao = nomeEstudante?.trim() || 'o estudante';

  const erroNovaAnotacao = erroDeTexto(novaAnotacao, tipoNovo);

  const handlePublicar = async () => {
    if (!novaAnotacao.trim() || erroNovaAnotacao) return;

    if (!user || targetId === null) {
      avisarErro(
        'Não foi possível publicar a anotação',
        new Error('Não foi possível identificar o autor ou o destinatário da anotação.'),
      );
      return;
    }

    setEnviando(true);

    try {
      await postComment(
        montarNovaAnotacao({
          texto: novaAnotacao,
          idUsuario: targetId,
          tipo: tipoNovo,
          avisarPorEmail,
        }),
      );

      recarregar();
      setNovaAnotacao('');
      setTipoNovo('NOTE');
      setAvisarPorEmail(false);
    } catch (error) {
      console.error("Erro ao publicar anotação:", error);
      avisarErro('Falha ao publicar a anotação', error);
    } finally {
      setEnviando(false);
    }
  };

  const iniciarEdicao = (anotacao: CommentData) => {
    const { texto, limpou } = textoParaEditar(anotacao.comment);

    setEditandoId(anotacao.id);
    setTextoEdicao(texto);
    setTextoFoiLimpo(limpou);
    setAvisarEdicaoPorEmail(false);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setTextoEdicao('');
    setTextoFoiLimpo(false);
    setAvisarEdicaoPorEmail(false);
  };

  const handleSalvarEdicao = async (anotacao: CommentData) => {
    const texto = textoEdicao.trim();

    if (!texto || erroDeTexto(textoEdicao, anotacao.type)) return;

    setSalvandoEdicao(true);

    try {
      await updateComment(anotacao.id, {
        comment: texto,
        notify_by_email: avisarEdicaoPorEmail,
      });

      recarregar();
      cancelarEdicao();
    } catch (error) {
      console.error("Erro ao editar anotação:", error);
      avisarErro('Falha ao salvar a edição', error);
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const alternarHistorico = (idAnotacao: number) => {
    setHistoricosAbertos((abertos) =>
      abertos.includes(idAnotacao)
        ? abertos.filter((item) => item !== idAnotacao)
        : [...abertos, idAnotacao]
    );
  };

  if (loading || carregando) return <Loading />;

  return (
    <AppLayout
    >
      <div className="p-6 w-full xl:grid xl:grid-cols-[1fr_minmax(0,48rem)_1fr] xl:gap-6">
        {pagina && pagina.overall > 0 && (
          <aside className="mb-4 w-full max-w-3xl mx-auto xl:mx-0 xl:mb-0 xl:col-start-3 xl:row-start-1 xl:self-start xl:sticky xl:top-4 xl:z-10">
            <section
              aria-label="Buscar e filtrar anotações"
              className="w-full border border-gray-200 rounded-2xl shadow-sm bg-white p-3 space-y-3 text-xs"
            >
              <label className="relative block">
                <span className="sr-only">Buscar anotações</span>
                <Search
                  size={16}
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  className={`w-full rounded-full border py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                    erroDaBuscaDigitada ? 'border-red-600' : 'border-gray-300'
                  }`}
                  placeholder="Buscar texto ou autor"
                  maxLength={LIMITE_DA_BUSCA}
                  value={filtros.busca}
                  aria-invalid={erroDaBuscaDigitada ? true : undefined}
                  aria-describedby={erroDaBuscaDigitada ? 'erro-da-busca' : undefined}
                  onChange={(e) => atualizarFiltro('busca', e.target.value)}
                />
              </label>
              {erroDaBuscaDigitada && (
                <p id="erro-da-busca" role="alert" className="px-3 text-red-700">
                  {erroDaBuscaDigitada}
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-gray-600 hover:bg-gray-100"
                  aria-expanded={filtrosAbertos}
                  aria-controls="filtros-anotacoes"
                  onClick={() => setFiltrosAbertos((aberto) => !aberto)}
                >
                  <SlidersHorizontal size={12} aria-hidden="true" />
                  Filtros
                  <ChevronDown
                    size={12}
                    aria-hidden="true"
                    className={`transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`}
                  />
                </button>
                <span className="text-gray-500" aria-live="polite">
                  {erroDaLista
                    ? ''
                    : resumoDaContagem({
                        carregadas: anotacoes.length,
                        total: pagina.total,
                        overall: pagina.overall,
                      })}
                </span>
              </div>

              {filtrosAbertos && (
                <div id="filtros-anotacoes" className="space-y-1.5">
                  <label className="block text-gray-600">
                    Autor
                    <select
                      className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      value={filtros.idAutor ?? ''}
                      onChange={(e) =>
                        atualizarFiltro('idAutor', e.target.value ? Number(e.target.value) : null)
                      }
                    >
                      <option value="">Todos</option>
                      {pagina.authors.map((autor) => (
                        <option key={autor.id} value={autor.id}>
                          {autor.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-gray-600">
                    Área
                    <select
                      className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      value={filtros.area ?? ''}
                      onChange={(e) =>
                        atualizarFiltro('area', e.target.value ? Number(e.target.value) : null)
                      }
                    >
                      <option value="">Todas</option>
                      {AREAS.map((area) => (
                        <option key={area.nivel} value={area.nivel}>
                          {area.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-gray-600">
                    Tipo
                    <select
                      className="mt-0.5 w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      value={filtros.tipo ?? ''}
                      onChange={(e) =>
                        atualizarFiltro(
                          'tipo',
                          TIPOS_DE_ANOTACAO.find((tipo) => tipo === e.target.value) ?? null,
                        )
                      }
                    >
                      <option value="">Todos</option>
                      {TIPOS_DE_ANOTACAO.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {ROTULO_DO_TIPO[tipo]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-gray-600">
                    De
                    <input
                      type="date"
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      value={filtros.de}
                      max={filtros.ate || undefined}
                      onChange={(e) => atualizarFiltro('de', e.target.value)}
                    />
                  </label>

                  <label className="block text-gray-600">
                    Até
                    <input
                      type="date"
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      value={filtros.ate}
                      min={filtros.de || undefined}
                      onChange={(e) => atualizarFiltro('ate', e.target.value)}
                    />
                  </label>

                  <label className="flex items-center gap-1.5 text-gray-700">
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-emerald-700"
                      checked={filtros.soEditadas}
                      onChange={(e) => atualizarFiltro('soEditadas', e.target.checked)}
                    />
                    Só editadas
                  </label>
                </div>
              )}

              {filtrando && (
                <button
                  type="button"
                  className="w-full rounded-full border px-2 py-0.5 font-semibold text-gray-600 hover:bg-gray-100"
                  onClick={limparFiltros}
                >
                  Limpar filtros
                </button>
              )}
            </section>
          </aside>
        )}

        <div className="w-full max-w-3xl mx-auto xl:col-start-2 xl:row-start-1">
          <h1 className="edutrace-page-title">Anotações Multiprofissionais</h1>

          {podeAnotar && (
            <div className="sticky top-0 z-10 bg-white pt-4 pb-4">
              <div className="border border-gray-200 rounded-2xl shadow-sm p-4">
                <fieldset className="mb-3 min-w-0">
                  <legend className="text-sm font-medium text-gray-800">
                    Tipo de registro
                  </legend>
                  <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
                    {TIPOS_DE_ANOTACAO.map((tipo) => (
                      <label key={tipo} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="tipo-da-anotacao"
                          value={tipo}
                          checked={tipoNovo === tipo}
                          onChange={() => setTipoNovo(tipo)}
                          className="h-4 w-4 accent-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                        />
                        {ROTULO_DO_TIPO[tipo]}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <TextAreaField
                  rotulo={`Texto do registro (${ROTULO_DO_TIPO[tipoNovo].toLowerCase()})`}
                  rotuloOculto
                  placeholder={
                    tipoNovo === 'CLASS_COUNCIL_REPORT'
                      ? `Escreva o relatório multiprofissional sobre ${alvoDaAnotacao}`
                      : `Faça sua anotação sobre ${alvoDaAnotacao}`
                  }
                  linhas={LINHAS_DO_TIPO[tipoNovo]}
                  tamanhoMaximo={LIMITE_DO_TIPO[tipoNovo]}
                  valor={novaAnotacao}
                  onChange={setNovaAnotacao}
                  erro={erroNovaAnotacao}
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-700"
                      checked={avisarPorEmail}
                      onChange={(e) => setAvisarPorEmail(e.target.checked)}
                    />
                    Enviar aviso por e-mail
                  </label>

                  <button
                    type="button"
                    className="bg-emerald-700 text-white px-4 py-2 rounded-full font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handlePublicar}
                    disabled={enviando || !novaAnotacao.trim() || !!erroNovaAnotacao}
                  >
                    {enviando ? 'Publicando...' : 'Publicar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de anotações */}
          <p
            role="status"
            className={
              carregandoAnotacoes && !pagina ? 'mt-4 py-10 text-center text-gray-500' : 'sr-only'
            }
          >
            {carregandoAnotacoes ? 'Carregando anotações...' : ''}
          </p>

          {erroDaLista && (
            <div
              role="alert"
              className="mt-4 space-y-3 rounded-2xl border border-red-200 bg-red-50 p-5"
            >
              <p className="text-red-800">{erroDaLista}</p>
              <button type="button" className={BOTAO_SECUNDARIO} onClick={recarregar}>
                Tentar novamente
              </button>
            </div>
          )}

          <div
            className={`space-y-4 mt-4 ${carregandoAnotacoes ? 'opacity-60' : ''}`}
            aria-busy={carregandoAnotacoes}
          >
            {erroDaLista || !pagina ? null : anotacoes.length === 0 && pagina.overall > 0 ? (
              <div className="text-center text-gray-500 py-10">
                <p>Nenhuma anotação corresponde à busca e aos filtros.</p>
              </div>
            ) : anotacoes.length > 0 ? (
              anotacoes.map((anotacao) => {
                const versoesAnteriores = buildPreviousVersions(anotacao);
                const editadaEm = lastEditedAt(anotacao);
                const foiEditada = versoesAnteriores.length > 0;
                const idHistorico = `historico-anotacao-${anotacao.id}`;
                const historicoAberto = historicosAbertos.includes(anotacao.id);
                const podeEditar = user?.sub === anotacao.id_author;
                const edicoesRestantes = Math.max(
                  LIMITE_EDICOES - (anotacao.edits?.length ?? 0),
                  0,
                );
                const emEdicao = editandoId === anotacao.id;
                const erroEdicao = emEdicao ? erroDeTexto(textoEdicao, anotacao.type) : '';

                return (
                  <article
                    key={anotacao.id}
                    className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">
                          {anotacao.author_name}
                        </p>
                        {rotulosDosPapeis(anotacao.author_roles).length > 0 && (
                          <span className="text-xs text-gray-600">
                            {rotulosDosPapeis(anotacao.author_roles).join(', ')}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTILO_DO_ROTULO_DO_TIPO[anotacao.type]}`}
                        >
                          {ROTULO_DO_TIPO[anotacao.type]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatarData(anotacao.created_at)}
                      </p>
                    </div>

                    {/* A região fica montada em todo cartão para que o leitor
                        de tela anuncie o aviso quando ele aparece. */}
                    <div role="status">
                      {emEdicao && textoFoiLimpo && (
                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          {AVISO_DE_TEXTO_LIMPO}
                        </p>
                      )}
                    </div>

                    {emEdicao ? (
                      <div className="mt-3">
                        <TextAreaField
                          rotulo={`Editar o texto (${ROTULO_DO_TIPO[anotacao.type].toLowerCase()})`}
                          rotuloOculto
                          linhas={LINHAS_DO_TIPO[anotacao.type]}
                          tamanhoMaximo={LIMITE_DO_TIPO[anotacao.type]}
                          valor={textoEdicao}
                          onChange={setTextoEdicao}
                          erro={erroEdicao}
                        />

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-emerald-700"
                              checked={avisarEdicaoPorEmail}
                              onChange={(e) => setAvisarEdicaoPorEmail(e.target.checked)}
                            />
                            Enviar aviso por e-mail
                          </label>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="px-4 py-2 border rounded-full text-gray-600 hover:bg-gray-100"
                              onClick={cancelarEdicao}
                              disabled={salvandoEdicao}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="bg-emerald-700 text-white px-4 py-2 rounded-full font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handleSalvarEdicao(anotacao)}
                              disabled={salvandoEdicao || !textoEdicao.trim() || !!erroEdicao}
                            >
                              {salvandoEdicao ? 'Salvando...' : 'Salvar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 text-gray-700 whitespace-pre-wrap break-words">
                          {anotacao.comment}
                        </p>

                        {(foiEditada || podeEditar) && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            {foiEditada && editadaEm ? (
                              <button
                                type="button"
                                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                onClick={() => alternarHistorico(anotacao.id)}
                                aria-expanded={historicoAberto}
                                aria-controls={idHistorico}
                              >
                                <History size={14} aria-hidden="true" />
                                <span>
                                  Editada em {formatarData(editadaEm)}
                                  {' · '}
                                  {historicoAberto
                                    ? 'ocultar histórico'
                                    : `ver histórico (${versoesAnteriores.length} ${
                                        versoesAnteriores.length === 1
                                          ? 'versão anterior'
                                          : 'versões anteriores'
                                      })`}
                                </span>
                                <ChevronDown
                                  size={14}
                                  aria-hidden="true"
                                  className={`transition-transform ${historicoAberto ? 'rotate-180' : ''}`}
                                />
                              </button>
                            ) : (
                              <span />
                            )}

                            {podeEditar && (
                              edicoesRestantes > 0 ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-gray-400">
                                    {edicoesRestantes === 1
                                      ? 'Resta 1 edição'
                                      : `Restam ${edicoesRestantes} edições`}
                                  </span>
                                  <button
                                    type="button"
                                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => iniciarEdicao(anotacao)}
                                  >
                                    <Pencil size={14} aria-hidden="true" />
                                    Editar
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  Limite de {LIMITE_EDICOES} edições atingido
                                </span>
                              )
                            )}
                          </div>
                        )}

                        {foiEditada && historicoAberto && (
                          <section
                            id={idHistorico}
                            aria-label="Histórico de edições"
                            className="mt-3 rounded-2xl border border-gray-200 bg-gray-50/60 p-4"
                          >
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Histórico de edições
                            </h3>

                            <div className="mt-3 max-h-80 overflow-y-auto pl-2 pr-1">
                              <ol className="border-l-2 border-gray-200">
                                {versoesAnteriores.map((versao) => (
                                  <li key={versao.numero} className="relative pl-5 pb-4 last:pb-0">
                                    <span
                                      aria-hidden="true"
                                      className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white ${
                                        versao.original ? 'bg-gray-400' : 'bg-emerald-600'
                                      }`}
                                    />
                                    <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                      <span className="font-semibold text-gray-800">
                                        Versão {versao.numero}
                                      </span>
                                      {versao.original && (
                                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                                          Original
                                        </span>
                                      )}
                                      <span>escrita em {formatarData(versao.escritaEm)}</span>
                                    </p>
                                    <p className="mt-1.5 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 whitespace-pre-wrap break-words">
                                      {versao.texto}
                                    </p>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </section>
                        )}
                      </>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="text-center text-gray-500 py-10">
                <p>Nenhuma anotação encontrada para este estudante.</p>
              </div>
            )}

            {temMais && (
              <div className="flex flex-col items-center gap-2 py-2">
                {erroMais && (
                  <p role="alert" className="text-sm text-red-700">
                    {erroMais}
                  </p>
                )}
                <button
                  type="button"
                  className={`${BOTAO_SECUNDARIO} disabled:opacity-50 disabled:cursor-not-allowed`}
                  onClick={carregarMais}
                  disabled={carregandoAnotacoes || carregandoMais}
                >
                  {carregandoMais ? 'Carregando...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
