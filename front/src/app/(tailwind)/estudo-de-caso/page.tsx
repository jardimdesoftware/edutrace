'use client';

import { Suspense, useEffect, useState } from 'react';
import { temPapel } from '@/utils/papeis';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import AppLayout from '@/components/AppLayout';
import EstudoDeCasoFormulario from '@/components/EstudoDeCasoFormulario';
import Loading from '@/components/Loading';
import {
  BOTAO_PERIGO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  COR_CANCELAR,
  COR_CONFIRMAR,
  COR_EXCLUIR,
} from '@/components/form/botoes';
import { createCaseStudy, deleteCaseStudy, updateCaseStudy } from '@/api/caseStudies';
import { ESTUDANTE } from '@/consts';
import { useAuth } from '@/contexts/AuthContext';
import { useEstudanteDaUrl } from '@/hooks/useEstudanteDaUrl';
import { useEstudoDeCaso } from '@/hooks/useEstudoDeCaso';
import type { CaseStudyPayload } from '@/interfaces/CaseStudy';
import { errorAlertOptions } from '@/utils/errorAlert';
import {
  cursoDoEstudo,
  formularioDoEstudo,
  formularioVazio,
  podeEditarEstudoDeCaso,
} from '@/utils/estudoDeCaso';

export default function EstudoDeCasoPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <EstudoDeCasoPage />
    </Suspense>
  );
}

function EstudoDeCasoPage() {
  const { email, nome, registro, carregando } = useEstudanteDaUrl();
  const { user, loading } = useAuth();
  const router = useRouter();
  const { carregando: carregandoEstudo, estudo, erro, recarregar, tentarDeNovo } =
    useEstudoDeCaso(email);

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // A tela de leitura e o formulário têm alturas diferentes; quem troca de uma
  // para a outra no fim da página volta ao topo.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [editando]);

  const podeEditar = podeEditarEstudoDeCaso(user?.roles);
  const curso = cursoDoEstudo(estudo, registro);
  const nomeDoEstudante = nome?.trim() || 'o estudante';
  const quemSemEstudo = temPapel(user?.roles, ESTUDANTE) ? 'Você' : nomeDoEstudante;

  const handleSalvar = async (corpo: CaseStudyPayload) => {
    if (!email) return;

    setSalvando(true);
    try {
      if (estudo) {
        await updateCaseStudy(email, corpo);
      } else {
        await createCaseStudy(email, corpo);
      }
    } catch (error) {
      console.error('Erro ao salvar o estudo de caso:', error);
      Swal.fire({
        ...errorAlertOptions(
          'Falha ao salvar o estudo de caso',
          error,
          'Não foi possível salvar o estudo de caso.',
        ),
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: 'Entendi',
      });
      setSalvando(false);
      return;
    }

    await recarregar();
    setEditando(false);
    setSalvando(false);
    Swal.fire({
      icon: 'success',
      title: 'Estudo de caso salvo com sucesso!',
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: 'Ok',
    });
  };

  const handleExcluir = async () => {
    if (!email) return;

    const confirmacao = await Swal.fire({
      icon: 'warning',
      title: 'Excluir estudo de caso',
      text: `Deseja excluir o estudo de caso de "${nomeDoEstudante}"? Esta ação não pode ser desfeita.`,
      showCancelButton: true,
      confirmButtonColor: COR_EXCLUIR,
      cancelButtonColor: COR_CANCELAR,
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmacao.isConfirmed) return;

    try {
      await deleteCaseStudy(email);
    } catch (error) {
      console.error('Erro ao excluir o estudo de caso:', error);
      Swal.fire({
        ...errorAlertOptions(
          'Falha ao excluir o estudo de caso',
          error,
          'Não foi possível excluir o estudo de caso.',
        ),
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: 'Entendi',
      });
      return;
    }

    await recarregar();
    Swal.fire({
      icon: 'success',
      title: 'Estudo de caso excluído com sucesso!',
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: 'Ok',
    });
  };

  if (loading || carregando || !user || carregandoEstudo) return <Loading />;

  const cabecalho = (
    <header className="space-y-1">
      <h1 className="text-4xl font-bold">Estudo de Caso</h1>
      {nome && <p className="text-gray-600">Estudante: {nome}</p>}
    </header>
  );

  return (
    <AppLayout ocuparTela={!erro && !!(estudo || editando)}>
      <div className="w-full p-4 lg:min-h-0 lg:flex-1 lg:p-6">
        {erro ? (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {cabecalho}
            <div role="alert" className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-red-800">{erro}</p>
              <button type="button" className={BOTAO_SECUNDARIO} onClick={() => tentarDeNovo()}>
                Tentar novamente
              </button>
            </div>
          </div>
        ) : estudo || editando ? (
          <EstudoDeCasoFormulario
            key={editando ? 'edicao' : 'leitura'}
            inicial={estudo ? formularioDoEstudo(estudo) : formularioVazio()}
            estudo={editando ? undefined : (estudo ?? undefined)}
            modo={editando ? (estudo ? 'editar' : 'criar') : 'ver'}
            estudante={nome ?? undefined}
            curso={curso}
            autor={estudo ? (estudo.author?.full_name ?? null) : user.name}
            salvando={salvando}
            onSalvar={handleSalvar}
            onCancelar={() => (editando ? setEditando(false) : router.back())}
            onEditar={podeEditar ? () => setEditando(true) : undefined}
            acoesDoDocumento={
              estudo && !editando && podeEditar ? (
                <button type="button" className={BOTAO_PERIGO} onClick={handleExcluir}>
                  <Trash2 size={16} aria-hidden="true" />
                  Excluir
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {cabecalho}
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
              <p className="text-gray-700">
                {quemSemEstudo} ainda não tem estudo de caso.
                {!podeEditar && ' Ele é elaborado pelo Professor(a) do AEE.'}
              </p>
              {podeEditar && (
                <button type="button" className={BOTAO_PRIMARIO} onClick={() => setEditando(true)}>
                  <Plus size={16} aria-hidden="true" />
                  Criar estudo de caso
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
