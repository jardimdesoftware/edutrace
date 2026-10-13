'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Loading from '@/components/Loading';
import {
  getAllCommentsByIdUser,
  postComment,
  updateComment,
} from '@/api/comments';
import { useAuth } from '@/contexts/AuthContext';
import { CommentData } from '@/interfaces/CommentData';
import { formatarData } from '@/utils/formatDate';
import { buildPreviousVersions, lastEditedAt } from '@/utils/commentVersions';
import {
  AREAS,
  CommentFilters,
  FILTROS_VAZIOS,
  filtrarAnotacoes,
  filtrosAtivos,
  listarAutores,
} from '@/utils/commentFilters';
import { ESTUDANTE } from '@/consts';
import { ChevronDown, History, Pencil, Search, SlidersHorizontal } from 'lucide-react';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import { useEstudanteDaUrl } from '@/hooks/useEstudanteDaUrl';

const LIMITE_CARACTERES = 1000;
const LIMITE_EDICOES = 10;

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

  const [anotacoes, setAnotacoes] = useState<CommentData[]>([]);
  const [novaAnotacao, setNovaAnotacao] = useState('');
  const [avisarPorEmail, setAvisarPorEmail] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [avisarEdicaoPorEmail, setAvisarEdicaoPorEmail] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [historicosAbertos, setHistoricosAbertos] = useState<number[]>([]);
  const [filtros, setFiltros] = useState<CommentFilters>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const { user, loading } = useAuth();
  const token = user;
  const isStudent = token?.id_level === ESTUDANTE;

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
    }
  }, [loading, token, router]);

  // O estudante vê as próprias anotações (token.sub); o profissional, as do
  // estudante indicado pelo id da URL.
  const targetId = isStudent ? token?.sub ?? null : registro?.id ?? null;

  useEffect(() => {
    if (!targetId) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await getAllCommentsByIdUser(targetId);
        const ordenado = data.sort((a: CommentData, b: CommentData) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        if (!cancelled) {
          setAnotacoes(ordenado);
        }
      } catch (err) {
        console.error("Erro ao buscar anotações:", err);
        if (!cancelled) {
          setAnotacoes([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetId]);

  const autores = useMemo(() => listarAutores(anotacoes), [anotacoes]);
  const anotacoesFiltradas = useMemo(
    () => filtrarAnotacoes(anotacoes, filtros),
    [anotacoes, filtros],
  );
  const filtrando = filtrosAtivos(filtros);

  const atualizarFiltro = <K extends keyof CommentFilters>(
    campo: K,
    valor: CommentFilters[K],
  ) => {
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
  };

  const limparFiltros = () => setFiltros(FILTROS_VAZIOS);

  const podeAnotar = !isStudent && targetId !== null;
  const alvoDaAnotacao = nomeEstudante?.trim() || 'o estudante';

  const handlePublicar = async () => {
    const texto = novaAnotacao.trim();

    if (!texto) return;

    if (!user || targetId === null) {
      avisarErro(
        'Não foi possível publicar a anotação',
        new Error('Não foi possível identificar o autor ou o destinatário da anotação.'),
      );
      return;
    }

    setEnviando(true);

    try {
      const anotacaoSalva = await postComment({
        comment: texto,
        id_user: targetId,
        notify_by_email: avisarPorEmail,
      });

      setAnotacoes((atuais) => [anotacaoSalva, ...atuais]);
      setNovaAnotacao('');
      setAvisarPorEmail(false);
    } catch (error) {
      console.error("Erro ao publicar anotação:", error);
      avisarErro('Falha ao publicar a anotação', error);
    } finally {
      setEnviando(false);
    }
  };

  const iniciarEdicao = (anotacao: CommentData) => {
    setEditandoId(anotacao.id);
    setTextoEdicao(anotacao.comment);
    setAvisarEdicaoPorEmail(false);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setTextoEdicao('');
    setAvisarEdicaoPorEmail(false);
  };

  const handleSalvarEdicao = async (idAnotacao: number) => {
    const texto = textoEdicao.trim();

    if (!texto) return;

    setSalvandoEdicao(true);

    try {
      const anotacaoAtualizada = await updateComment(idAnotacao, {
        comment: texto,
        notify_by_email: avisarEdicaoPorEmail,
      });

      setAnotacoes((atuais) =>
        atuais.map((anotacao) =>
          anotacao.id === idAnotacao ? anotacaoAtualizada : anotacao
        )
      );
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
        {/* O -mt-[70px] sobe o painel até a altura do botão Voltar do
            AppLayout: a faixa dele tem 54px com o botão a 8px do topo, e esta
            página começa 24px (p-6) depois da faixa. */}
        {anotacoes.length > 0 && (
          <aside className="mb-4 w-full max-w-3xl mx-auto xl:mx-0 xl:mb-0 xl:-mt-[70px] xl:col-start-3 xl:row-start-1 xl:self-start xl:sticky xl:top-4 xl:z-10">
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
                  className="w-full rounded-full border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Buscar texto ou autor"
                  value={filtros.busca}
                  onChange={(e) => atualizarFiltro('busca', e.target.value)}
                />
              </label>

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
                  {anotacoesFiltradas.length}/{anotacoes.length}{' '}
                  <span className="text-gray-400">anotações exibidas</span>
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
                      {autores.map((autor) => (
                        <option key={autor.id} value={autor.id}>
                          {autor.nome}
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
          <h1 className="text-4xl font-bold">Anotações Multiprofissionais</h1>

          {podeAnotar && (
            <div className="sticky top-0 z-10 bg-white pt-4 pb-4">
              <div className="border border-gray-200 rounded-2xl shadow-sm p-4">
                <textarea
                  className="w-full h-24 border border-gray-300 rounded-2xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder={`Faça sua anotação sobre ${alvoDaAnotacao}`}
                  maxLength={LIMITE_CARACTERES}
                  value={novaAnotacao}
                  onChange={(e) => setNovaAnotacao(e.target.value)}
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

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {novaAnotacao.length}/{LIMITE_CARACTERES}
                    </span>
                    <button
                      type="button"
                      className="bg-emerald-700 text-white px-4 py-2 rounded-full font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handlePublicar}
                      disabled={enviando || !novaAnotacao.trim()}
                    >
                      {enviando ? 'Publicando...' : 'Publicar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lista de anotações */}
          <div className="space-y-4 mt-4">
            {anotacoes.length > 0 && anotacoesFiltradas.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                <p>Nenhuma anotação corresponde à busca e aos filtros.</p>
              </div>
            ) : anotacoes.length > 0 ? (
              anotacoesFiltradas.map((anotacao) => {
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

                return (
                  <article
                    key={anotacao.id}
                    className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <p className="text-sm font-semibold text-gray-800">
                        {anotacao.author_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatarData(anotacao.created_at)}
                      </p>
                    </div>

                    {emEdicao ? (
                      <div className="mt-3">
                        <textarea
                          className="w-full h-24 border border-gray-300 rounded-2xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          maxLength={LIMITE_CARACTERES}
                          value={textoEdicao}
                          onChange={(e) => setTextoEdicao(e.target.value)}
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
                            <span className="text-xs text-gray-500">
                              {textoEdicao.length}/{LIMITE_CARACTERES}
                            </span>
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
                              onClick={() => handleSalvarEdicao(anotacao.id)}
                              disabled={salvandoEdicao || !textoEdicao.trim()}
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
