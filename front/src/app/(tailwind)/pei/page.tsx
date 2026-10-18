'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import AppLayout from '@/components/AppLayout';
import Loading from '@/components/Loading';
import PeiDoRegistro from '@/components/PeiDoRegistro';
import PeiFormulario from '@/components/PeiFormulario';
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  COR_CANCELAR,
  COR_CONFIRMAR,
  COR_EXCLUIR,
} from '@/components/form/botoes';
import { createPeiEntry, deletePeiEntry, updatePeiEntry } from '@/api/peiEntries';
import { ESTUDANTE } from '@/consts';
import { useAuth } from '@/contexts/AuthContext';
import { useEstudanteDaUrl } from '@/hooks/useEstudanteDaUrl';
import { usePeiEntries } from '@/hooks/usePeiEntries';
import type { PeiEntry } from '@/interfaces/PeiEntry';
import { errorAlertOptions } from '@/utils/errorAlert';
import {
  agruparPorSemestre,
  formularioDoPei,
  formularioVazioDoPei,
  montarCorpoDeAtualizacao,
  montarCorpoDeCriacao,
  podeAlterarPei,
  podeCriarPei,
  podeExcluirPei,
  type PeiEntryForm,
} from '@/utils/pei';

// registro é null na criação de um registro novo.
type Edicao = { registro: PeiEntry | null };

export default function PeiPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <PeiPage />
    </Suspense>
  );
}

function PeiPage() {
  const { email, nome, carregando } = useEstudanteDaUrl();
  const { user, loading } = useAuth();
  const router = useRouter();
  const { carregando: carregandoRegistros, registros, erro, recarregar, tentarDeNovo } =
    usePeiEntries(email);

  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // A lista e o formulário têm alturas diferentes; quem troca de uma para a
  // outra no fim da página volta ao topo.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [edicao]);

  const podeCriar = podeCriarPei(user?.id_level);
  const nomeDoEstudante = nome?.trim() || 'o estudante';
  const quemSemPei = user?.id_level === ESTUDANTE ? 'Você' : nomeDoEstudante;

  // Grava, recarrega a lista, fecha o formulário (aoConcluir) e avisa; se a
  // gravação falha, o formulário continua aberto com o que foi digitado.
  const gravar = async (
    gravacao: () => Promise<unknown>,
    textos: { log: string; titulo: string; padrao: string; sucesso: string },
    aoConcluir: () => void,
  ) => {
    setSalvando(true);
    try {
      await gravacao();
    } catch (error) {
      console.error(textos.log, error);
      Swal.fire({
        ...errorAlertOptions(textos.titulo, error, textos.padrao),
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: 'Entendi',
      });
      setSalvando(false);
      return;
    }

    await recarregar();
    aoConcluir();
    setSalvando(false);
    Swal.fire({
      icon: 'success',
      title: textos.sucesso,
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: 'Ok',
    });
  };

  const handleSalvar = async (form: PeiEntryForm) => {
    if (!email || !edicao) return;

    await gravar(
      () =>
        edicao.registro
          ? updatePeiEntry(edicao.registro.id, montarCorpoDeAtualizacao(form))
          : createPeiEntry(montarCorpoDeCriacao(email, form)),
      {
        log: 'Erro ao salvar o registro do PEI:',
        titulo: 'Falha ao salvar o registro do PEI',
        padrao: 'Não foi possível salvar o registro do PEI.',
        sucesso: 'Registro do PEI salvo com sucesso!',
      },
      () => setEdicao(null),
    );
  };

  const handleExcluir = async (registro: PeiEntry) => {
    const confirmacao = await Swal.fire({
      icon: 'warning',
      title: 'Excluir registro do PEI',
      text: `Deseja excluir o registro do PEI de "${registro.subject}" no semestre ${registro.semester} de "${nomeDoEstudante}"? Esta ação não pode ser desfeita.`,
      showCancelButton: true,
      confirmButtonColor: COR_EXCLUIR,
      cancelButtonColor: COR_CANCELAR,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmacao.isConfirmed) return;

    try {
      await deletePeiEntry(registro.id);
    } catch (error) {
      console.error('Erro ao excluir o registro do PEI:', error);
      Swal.fire({
        ...errorAlertOptions(
          'Falha ao excluir o registro do PEI',
          error,
          'Não foi possível excluir o registro do PEI.',
        ),
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: 'Entendi',
      });
      return;
    }

    await recarregar();
    Swal.fire({
      icon: 'success',
      title: 'Registro do PEI excluído com sucesso!',
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: 'Ok',
    });
  };

  if (loading || carregando || !user || carregandoRegistros) return <Loading />;

  const grupos = agruparPorSemestre(registros);
  const botaoNovo = podeCriar && (
    <div>
      <button type="button" className={BOTAO_PRIMARIO} onClick={() => setEdicao({ registro: null })}>
        <Plus size={16} aria-hidden="true" />
        Adicionar registro
      </button>
    </div>
  );

  return (
    <AppLayout>
      <div className="w-full p-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <header className="space-y-1">
            <h1 className="text-4xl font-bold">PEI</h1>
            <p className="text-gray-600">Plano de Ensino Individualizado</p>
            {nome && <p className="text-gray-600">Estudante: {nome}</p>}
          </header>

          {erro ? (
            <div role="alert" className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-red-800">{erro}</p>
              <button type="button" className={BOTAO_SECUNDARIO} onClick={() => tentarDeNovo()}>
                Tentar novamente
              </button>
            </div>
          ) : edicao ? (
            <PeiFormulario
              key={edicao.registro?.id ?? 'novo'}
              inicial={edicao.registro ? formularioDoPei(edicao.registro) : formularioVazioDoPei()}
              novo={!edicao.registro}
              autor={edicao.registro ? (edicao.registro.author?.full_name ?? null) : user.name}
              salvando={salvando}
              onSalvar={handleSalvar}
              onCancelar={() => setEdicao(null)}
            />
          ) : grupos.length > 0 ? (
            <>
              {botaoNovo}
              {grupos.map((grupo, indice) => (
                <section key={grupo.semester} aria-labelledby={`pei-semestre-${grupo.semester}`} className="space-y-3">
                  <h2 id={`pei-semestre-${grupo.semester}`} className="text-2xl font-semibold text-emerald-800">
                    Semestre {grupo.semester}
                  </h2>
                  {grupo.registros.map((registro) => (
                    <PeiDoRegistro
                      key={registro.id}
                      registro={registro}
                      aberto={indice === 0}
                      podeEditar={podeAlterarPei(user, registro)}
                      podeExcluir={podeExcluirPei(user, registro)}
                      onEditar={() => setEdicao({ registro })}
                      onExcluir={() => handleExcluir(registro)}
                    />
                  ))}
                </section>
              ))}
            </>
          ) : (
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
              <p className="text-gray-700">
                {quemSemPei} ainda não tem registros do PEI.
                {!podeCriar && ' Eles são elaborados pelo professor de cada disciplina.'}
              </p>
              {botaoNovo}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
