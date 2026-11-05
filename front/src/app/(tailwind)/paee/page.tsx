'use client';

import { Suspense, useEffect, useState } from 'react';
import { temPapel } from '@/utils/papeis';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import AppLayout from '@/components/AppLayout';
import AvisoDeVersao from '@/components/AvisoDeVersao';
import HistoricoDeEdicoes from '@/components/HistoricoDeEdicoes';
import Loading from '@/components/Loading';
import PaeeDoPeriodo from '@/components/PaeeDoPeriodo';
import PaeeFormulario from '@/components/PaeeFormulario';
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  COR_CANCELAR,
  COR_CONFIRMAR,
  COR_EXCLUIR,
} from '@/components/form/botoes';
import { createAeePlan, deleteAeePlan, updateAeePlan } from '@/api/aeePlans';
import { ESTUDANTE } from '@/consts';
import { useAuth } from '@/contexts/AuthContext';
import { useAeePlans } from '@/hooks/useAeePlans';
import { useEstudanteDaUrl } from '@/hooks/useEstudanteDaUrl';
import type { AeePlan, AeePlanPayload } from '@/interfaces/AeePlan';
import { errorAlertOptions } from '@/utils/errorAlert';
import type { VersaoCompleta } from '@/utils/historicoDeEdicoes';
import { cursoDoEstudante } from '@/utils/formularioPorTabela';
import {
  formularioDoPlano,
  formularioVazioDoPlano,
  podeEditarPaee,
} from '@/utils/paee';

// plano é null na criação de um PAEE novo.
type Edicao = { plano: AeePlan | null };

export default function PaeePageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <PaeePage />
    </Suspense>
  );
}

function PaeePage() {
  const { email, nome, registro, carregando } = useEstudanteDaUrl();
  const { user, loading } = useAuth();
  const router = useRouter();
  const { carregando: carregandoPlanos, planos, erro, recarregar, tentarDeNovo } =
    useAeePlans(email);

  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Versões antigas abertas pelo histórico, por período letivo: a tela mostra o
  // conteúdo delas, só para leitura.
  const [versoesVistas, setVersoesVistas] = useState<Record<string, VersaoCompleta<AeePlan>>>({});

  const escolherVersao = (periodo: string, versao: VersaoCompleta<AeePlan> | null) =>
    setVersoesVistas((atuais) => {
      const demais = Object.fromEntries(
        Object.entries(atuais).filter(([chave]) => chave !== periodo),
      );
      return versao ? { ...demais, [periodo]: versao } : demais;
    });

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

  const podeEditar = podeEditarPaee(user?.roles);
  const nomeDoEstudante = nome?.trim() || 'o estudante';
  const quemSemPaee = temPapel(user?.roles, ESTUDANTE) ? 'Você' : nomeDoEstudante;

  const handleSalvar = async (periodo: string, corpo: AeePlanPayload) => {
    if (!email || !edicao) return;

    setSalvando(true);
    try {
      if (edicao.plano) {
        await updateAeePlan(edicao.plano.id, corpo);
      } else {
        await createAeePlan(email, periodo, corpo);
      }
    } catch (error) {
      console.error('Erro ao salvar o PAEE:', error);
      Swal.fire({
        ...errorAlertOptions('Falha ao salvar o PAEE', error, 'Não foi possível salvar o PAEE.'),
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: 'Entendi',
      });
      setSalvando(false);
      return;
    }

    await recarregar();
    setVersoesVistas({});
    setEdicao(null);
    setSalvando(false);
    Swal.fire({
      icon: 'success',
      title: 'PAEE salvo com sucesso!',
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: 'Ok',
    });
  };

  const handleExcluir = async (plano: AeePlan) => {
    const confirmacao = await Swal.fire({
      icon: 'warning',
      title: 'Excluir PAEE',
      text: `Deseja excluir o PAEE do período letivo ${plano.semester} de "${nomeDoEstudante}"? Esta ação não pode ser desfeita.`,
      showCancelButton: true,
      confirmButtonColor: COR_EXCLUIR,
      cancelButtonColor: COR_CANCELAR,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmacao.isConfirmed) return;

    try {
      await deleteAeePlan(plano.id);
    } catch (error) {
      console.error('Erro ao excluir o PAEE:', error);
      Swal.fire({
        ...errorAlertOptions('Falha ao excluir o PAEE', error, 'Não foi possível excluir o PAEE.'),
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: 'Entendi',
      });
      return;
    }

    await recarregar();
    setVersoesVistas({});
    Swal.fire({
      icon: 'success',
      title: 'PAEE excluído com sucesso!',
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: 'Ok',
    });
  };

  if (loading || carregando || !user || carregandoPlanos) return <Loading />;

  const botaoNovo = podeEditar && (
    <div>
      <button type="button" className={BOTAO_PRIMARIO} onClick={() => setEdicao({ plano: null })}>
        <Plus size={16} aria-hidden="true" />
        Novo PAEE
      </button>
    </div>
  );

  return (
    <AppLayout ocuparTela={!!edicao && !erro}>
      <div className="w-full p-4 lg:min-h-0 lg:flex-1 lg:p-6">
        {edicao && !erro ? (
          <PaeeFormulario
            key={edicao.plano?.id ?? 'novo'}
            inicial={edicao.plano ? formularioDoPlano(edicao.plano) : formularioVazioDoPlano()}
            novo={!edicao.plano}
            curso={cursoDoEstudante(edicao.plano ?? planos[0] ?? null, registro)}
            estudante={nome ?? undefined}
            autor={edicao.plano ? (edicao.plano.author?.full_name ?? null) : user.name}
            salvando={salvando}
            onSalvar={handleSalvar}
            onCancelar={() => setEdicao(null)}
          />
        ) : (
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <header className="space-y-1">
            <h1 className="edutrace-page-title">PAEE</h1>
            <p className="text-gray-600">Plano de Atendimento Educacional Especializado</p>
            {nome && <p className="text-gray-600">Estudante: {nome}</p>}
          </header>

          {erro ? (
            <div role="alert" className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-red-800">{erro}</p>
              <button type="button" className={BOTAO_SECUNDARIO} onClick={() => tentarDeNovo()}>
                Tentar novamente
              </button>
            </div>
          ) : planos.length > 0 ? (
            <>
              {botaoNovo}
              <div className="space-y-4">
                {planos.map((plano, indice) => {
                  const vista = versoesVistas[plano.semester];

                  return (
                    <PaeeDoPeriodo
                      key={plano.id}
                      plano={vista ? vista.snapshot : plano}
                      aberto={indice === 0}
                      podeEditar={podeEditar && !vista}
                      onEditar={() => setEdicao({ plano })}
                      onExcluir={() => handleExcluir(plano)}
                      historico={
                        email && (
                          <div className="space-y-3">
                            <HistoricoDeEdicoes<AeePlan>
                              tipo="AEE_PLAN"
                              email={email}
                              periodo={plano.semester}
                              roles={user.roles}
                              atualizadoEm={plano.updated_at}
                              versaoAberta={vista?.version ?? null}
                              onEscolher={(versao) => escolherVersao(plano.semester, versao)}
                            />
                            {vista && (
                              <AvisoDeVersao
                                versao={vista}
                                onVoltar={() => escolherVersao(plano.semester, null)}
                              />
                            )}
                          </div>
                        )
                      }
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
              <p className="text-gray-700">
                {quemSemPaee} ainda não tem PAEE.
                {!podeEditar && ' Ele é elaborado pelo Professor(a) do AEE.'}
              </p>
              {botaoNovo}
            </div>
          )}
        </div>
        )}
      </div>
    </AppLayout>
  );
}
