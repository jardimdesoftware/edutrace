'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Loading from '@/components/Loading';
import {
  getAllCommentsByIdUser,
  postComment,
  updateComment,
} from '@/api/comments';
import { getUserByEmail } from '@/api/user';
import { useAuth } from '@/contexts/AuthContext';
import { CommentData } from '@/interfaces/CommentData';
import { TokenPayload, decodeToken } from '@/services/auth/decodeToken';
import { formatarData } from '@/utils/formatDate';
import { buildPreviousVersions, lastEditedAt } from '@/utils/commentVersions';
import { ESTUDANTE } from '@/consts';
import { ChevronDown, History, Pencil } from 'lucide-react';
import Swal from 'sweetalert2';
import { useSearchParams, useRouter } from 'next/navigation';

const LIMITE_CARACTERES = 1000;

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
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const email = searchParams.get("email");
  const nomeParam = searchParams.get("nome");
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
  const [targetId, setTargetId] = useState<number | null>(null);
  const [nomeEstudante, setNomeEstudante] = useState<string | null>(nomeParam);
  const { user, loading } = useAuth();
  const token = useMemo<TokenPayload | null>(() => decodeToken(), []);
  const isStudent = token?.id_level === ESTUDANTE;

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  // Resolve o estudante alvo da anotação. O estudante vê as próprias anotações
  // (token.sub); o profissional usa o id da URL quando ele é válido e, caso
  // contrário, resolve o id pelo e-mail — que chega em todos os fluxos que
  // passam pela página do estudante, ao contrário do id. O e-mail também
  // resolve o nome usado no placeholder quando ele não vem na URL.
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    (async () => {
      if (isStudent) {
        setTargetId(token.sub);
        return;
      }

      const parsedId = Number(id);
      const idValido = Number.isInteger(parsedId) && parsedId > 0;

      if (idValido) {
        setTargetId(parsedId);
        if (nomeParam) return;
      }

      if (email) {
        try {
          const student = await getUserByEmail(email);
          if (cancelled) return;
          if (!idValido) setTargetId(student?.id ?? null);
          if (!nomeParam) setNomeEstudante(student?.full_name ?? null);
        } catch (err) {
          console.error("Erro ao identificar o estudante:", err);
          if (!cancelled && !idValido) setTargetId(null);
        }
        return;
      }

      if (!idValido) setTargetId(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [token, isStudent, id, email, nomeParam]);

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

  if (loading) return <Loading />;

  return (
    <AppLayout
    >
      <div className="p-6 w-full max-w-3xl mx-auto">
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
          {anotacoes.length > 0 ? (
            anotacoes.map((anotacao) => {
              const versoesAnteriores = buildPreviousVersions(anotacao);
              const editadaEm = lastEditedAt(anotacao);
              const foiEditada = versoesAnteriores.length > 0;
              const idHistorico = `historico-anotacao-${anotacao.id}`;
              const historicoAberto = historicosAbertos.includes(anotacao.id);
              const podeEditar = user?.sub === anotacao.id_author;
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
                            <button
                              type="button"
                              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              onClick={() => iniciarEdicao(anotacao)}
                            >
                              <Pencil size={14} aria-hidden="true" />
                              Editar
                            </button>
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

                          <ol className="mt-3 border-l-2 border-gray-200">
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
    </AppLayout>
  );
}
