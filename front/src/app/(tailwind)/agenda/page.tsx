'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, ChevronLeft, ChevronRight, FileDown, Pencil, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import AppLayout from '@/components/AppLayout';
import Loading from '@/components/Loading';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, COR_CANCELAR, COR_CONFIRMAR, COR_EXCLUIR } from '@/components/form/botoes';
import { useAuth } from '@/contexts/AuthContext';
import {
  alterarAtendimento,
  criarAtendimento,
  listarAtendimentos,
  listarEstudantesDaAgenda,
  removerAtendimento,
} from '@/api/agenda';
import { exportAgendaPdf } from '@/lib/exportAgendaPdf';
import {
  agruparPorDia,
  chaveDoDia,
  diasDaSemana,
  faixaDeHoras,
  formatarHora,
  inicioDaSemana,
  intervaloDaSemana,
  paraIso,
  posicaoDoBloco,
  rotuloDaSemana,
  rotuloDoDia,
  somarDias,
  validarHorario,
  type Atendimento,
  type EstudanteDaAgenda,
} from '@/utils/agenda';

const LIMITE_OBSERVACAO = 500;
const PX_POR_MINUTO = 1.2;
const COR_LINHA_DA_HORA = '#e5e7eb';
const COLUNAS_DA_GRADE = 'grid-cols-[4rem_repeat(7,minmax(0,1fr))]';
const CAMPO = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600';

interface FormularioDoHorario {
  id: number | null;
  idEstudante: string;
  data: string;
  inicio: string;
  fim: string;
  observacao: string;
}

function formularioVazio(data: Date): FormularioDoHorario {
  return { id: null, idEstudante: '', data: chaveDoDia(data), inicio: '', fim: '', observacao: '' };
}

function formularioDoAtendimento(a: Atendimento): FormularioDoHorario {
  return {
    id: a.id,
    idEstudante: String(a.student.id),
    data: chaveDoDia(new Date(a.starts_at)),
    inicio: formatarHora(a.starts_at),
    fim: formatarHora(a.ends_at),
    observacao: a.notes ?? '',
  };
}

function avisarErro(titulo: string, erro: unknown) {
  Swal.fire({
    icon: 'error',
    title: titulo,
    text: erro instanceof Error ? erro.message : 'Erro ao processar requisição',
    confirmButtonColor: COR_CONFIRMAR,
    confirmButtonText: 'Entendi',
  });
}

export default function AgendaPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [semana, setSemana] = useState(() => inicioDaSemana(new Date()));
  // Cada resposta leva a chave da semana e da versão em que foi pedida; enquanto a
  // chave atual não tem resposta, a lista está carregando.
  const [versao, setVersao] = useState(0);
  const [resposta, setResposta] = useState<{ chave: string; lista: Atendimento[]; erro: string | null } | null>(null);
  const [estudantes, setEstudantes] = useState<EstudanteDaAgenda[]>([]);
  const [formulario, setFormulario] = useState<FormularioDoHorario | null>(null);
  const [erroDoFormulario, setErroDoFormulario] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    listarEstudantesDaAgenda().then(setEstudantes).catch((erro) => avisarErro('Falha ao carregar os estudantes', erro));
  }, []);

  const chave = `${chaveDoDia(semana)}:${versao}`;

  useEffect(() => {
    let cancelado = false;
    const { from, to } = intervaloDaSemana(semana);

    listarAtendimentos(from, to)
      .then((lista) => !cancelado && setResposta({ chave, lista, erro: null }))
      .catch((erro) => {
        if (cancelado) return;
        const mensagem = erro instanceof Error ? erro.message : 'Erro ao carregar a agenda';
        setResposta({ chave, lista: [], erro: mensagem });
      });

    return () => {
      cancelado = true;
    };
  }, [semana, chave]);

  const recarregar = () => setVersao((atual) => atual + 1);
  const carregando = resposta?.chave !== chave;
  const atendimentos = resposta?.lista ?? [];
  const erroDaLista = resposta?.chave === chave ? resposta.erro : null;

  if (loading || !user) return <Loading />;

  const porDia = agruparPorDia(atendimentos);
  const { inicio: horaInicial, fim: horaFinal } = faixaDeHoras(atendimentos);
  const alturaDaGrade = (horaFinal - horaInicial) * 60 * PX_POR_MINUTO;
  const horas = Array.from({ length: horaFinal - horaInicial }, (_, i) => horaInicial + i);
  const linhasDasHoras = `repeating-linear-gradient(to bottom, ${COR_LINHA_DA_HORA} 0, ${COR_LINHA_DA_HORA} 1px, transparent 1px, transparent ${60 * PX_POR_MINUTO}px)`;

  const abrirNovo = () => {
    setErroDoFormulario(null);
    setFormulario(formularioVazio(semana));
  };

  const abrirEdicao = (atendimento: Atendimento) => {
    setErroDoFormulario(null);
    setFormulario(formularioDoAtendimento(atendimento));
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!formulario) return;

    if (!formulario.idEstudante) {
      setErroDoFormulario('Escolha o estudante.');
      return;
    }
    const problema = validarHorario(formulario);
    if (problema) {
      setErroDoFormulario(problema);
      return;
    }

    const dados = {
      id_student: Number(formulario.idEstudante),
      starts_at: paraIso(formulario.data, formulario.inicio),
      ends_at: paraIso(formulario.data, formulario.fim),
      notes: formulario.observacao,
    };

    setSalvando(true);
    setErroDoFormulario(null);
    try {
      if (formulario.id === null) {
        await criarAtendimento(dados);
      } else {
        await alterarAtendimento(formulario.id, dados);
      }
      setFormulario(null);
      // Se o horário caiu em outra semana, a tela segue para ela.
      const novaSemana = inicioDaSemana(new Date(dados.starts_at));
      if (chaveDoDia(novaSemana) === chaveDoDia(semana)) {
        recarregar();
      } else {
        setSemana(novaSemana);
      }
    } catch (erro) {
      setErroDoFormulario(erro instanceof Error ? erro.message : 'Erro ao salvar o horário');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (atendimento: Atendimento) => {
    const confirmacao = await Swal.fire({
      icon: 'warning',
      title: 'Remover horário',
      text: `Remover o atendimento de ${atendimento.student.full_name} às ${formatarHora(atendimento.starts_at)}?`,
      showCancelButton: true,
      confirmButtonColor: COR_EXCLUIR,
      cancelButtonColor: COR_CANCELAR,
      confirmButtonText: 'Sim, remover',
      cancelButtonText: 'Cancelar',
    });
    if (!confirmacao.isConfirmed) return;

    try {
      await removerAtendimento(atendimento.id);
      recarregar();
    } catch (erro) {
      avisarErro('Falha ao remover o horário', erro);
    }
  };

  const exportar = async () => {
    try {
      const resultado = await exportAgendaPdf(user.name, semana, atendimentos);
      if (resultado === 'empty') {
        Swal.fire({
          icon: 'info',
          title: 'Agenda vazia',
          text: 'Não há atendimentos nesta semana para exportar.',
          confirmButtonColor: COR_CONFIRMAR,
          confirmButtonText: 'Entendi',
        });
      }
    } catch (erro) {
      avisarErro('Falha ao exportar a agenda', erro);
    }
  };

  const mudar = (campo: keyof FormularioDoHorario, valor: string) =>
    setFormulario((atual) => (atual ? { ...atual, [campo]: valor } : atual));

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl p-5 sm:p-7">
        <h1 className="edutrace-page-title">Agenda de atendimento</h1>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setSemana(somarDias(semana, -7))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-56 text-center font-semibold text-slate-800" aria-live="polite">
            {rotuloDaSemana(semana)}
          </span>
          <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setSemana(somarDias(semana, 7))} aria-label="Próxima semana">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setSemana(inicioDaSemana(new Date()))}>
            Hoje
          </button>

          <span className="flex-1" />

          <button type="button" className={BOTAO_SECUNDARIO} onClick={exportar} disabled={carregando}>
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Exportar PDF
          </button>
          <button type="button" className={BOTAO_PRIMARIO} onClick={abrirNovo}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Novo horário
          </button>
        </div>

        {formulario && (
          <form onSubmit={salvar} className="mt-6 rounded-xl border border-emerald-200 bg-white p-5 shadow-sm" aria-label="Horário de atendimento">
            <h2 className="font-bold text-slate-900">{formulario.id === null ? 'Novo horário' : 'Alterar horário'}</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="agenda-estudante" className="font-medium text-slate-800">Estudante</label>
                <select
                  id="agenda-estudante"
                  className={CAMPO}
                  value={formulario.idEstudante}
                  onChange={(e) => mudar('idEstudante', e.target.value)}
                >
                  <option value="">Selecione</option>
                  {estudantes.map((estudante) => (
                    <option key={estudante.id} value={estudante.id}>{estudante.full_name}</option>
                  ))}
                </select>
                {estudantes.length === 0 && (
                  <p className="mt-1 text-sm text-slate-600">Você ainda não atende nenhum estudante.</p>
                )}
              </div>

              <div>
                <label htmlFor="agenda-data" className="font-medium text-slate-800">Data</label>
                <input id="agenda-data" type="date" className={CAMPO} value={formulario.data} onChange={(e) => mudar('data', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agenda-inicio" className="font-medium text-slate-800">Início</label>
                  <input id="agenda-inicio" type="time" className={CAMPO} value={formulario.inicio} onChange={(e) => mudar('inicio', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="agenda-fim" className="font-medium text-slate-800">Fim</label>
                  <input id="agenda-fim" type="time" className={CAMPO} value={formulario.fim} onChange={(e) => mudar('fim', e.target.value)} />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="agenda-observacao" className="font-medium text-slate-800">Observação (opcional)</label>
                <textarea
                  id="agenda-observacao"
                  rows={2}
                  maxLength={LIMITE_OBSERVACAO}
                  className={CAMPO}
                  value={formulario.observacao}
                  onChange={(e) => mudar('observacao', e.target.value)}
                />
                <span className="text-xs text-slate-500">{formulario.observacao.length}/{LIMITE_OBSERVACAO}</span>
              </div>
            </div>

            {erroDoFormulario && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-700">{erroDoFormulario}</p>
            )}

            <div className="mt-4 flex gap-3">
              <button type="submit" className={BOTAO_PRIMARIO} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setFormulario(null)} disabled={salvando}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {erroDaLista && <p role="alert" className="mt-6 text-red-700">{erroDaLista}</p>}

        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white" aria-busy={carregando}>
          <div className="min-w-[56rem]">
            <div className={`grid ${COLUNAS_DA_GRADE} border-b border-gray-200`}>
              <div />
              {diasDaSemana(semana).map((dia) => (
                <h2 key={chaveDoDia(dia)} className="border-l border-gray-200 px-1 py-2 text-center text-sm font-bold capitalize text-slate-800">
                  {rotuloDoDia(dia)}
                </h2>
              ))}
            </div>

            <div className={`grid ${COLUNAS_DA_GRADE}`}>
              <div className="relative" style={{ height: alturaDaGrade }} aria-hidden="true">
                {horas.map((hora) => (
                  <span
                    key={hora}
                    className="absolute right-2 text-xs text-slate-500"
                    style={{ top: (hora - horaInicial) * 60 * PX_POR_MINUTO + 2 }}
                  >
                    {String(hora).padStart(2, '0')}:00
                  </span>
                ))}
              </div>

              {diasDaSemana(semana).map((dia) => (
                <div
                  key={chaveDoDia(dia)}
                  role="group"
                  aria-label={rotuloDoDia(dia)}
                  className="relative border-l border-gray-200"
                  style={{ height: alturaDaGrade, backgroundImage: linhasDasHoras }}
                >
                  {(porDia[chaveDoDia(dia)] ?? []).map((atendimento) => {
                    const { topo, altura } = posicaoDoBloco(atendimento, horaInicial);
                    const horario = `${formatarHora(atendimento.starts_at)} às ${formatarHora(atendimento.ends_at)}`;
                    return (
                      <div
                        key={atendimento.id}
                        title={`${horario}, ${atendimento.student.full_name}${atendimento.notes ? `: ${atendimento.notes}` : ''}`}
                        className="group absolute inset-x-1 overflow-hidden rounded-md border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-950"
                        style={{ top: topo * PX_POR_MINUTO, height: altura * PX_POR_MINUTO - 2 }}
                      >
                        <span className="absolute right-0.5 top-0.5 flex gap-0.5 rounded bg-emerald-100 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-emerald-200"
                            onClick={() => abrirEdicao(atendimento)}
                            aria-label={`Alterar o atendimento de ${atendimento.student.full_name} às ${formatarHora(atendimento.starts_at)}`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-0.5 text-red-700 hover:bg-red-100"
                            onClick={() => remover(atendimento)}
                            aria-label={`Remover o atendimento de ${atendimento.student.full_name} às ${formatarHora(atendimento.starts_at)}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </span>
                        <span className="block font-semibold leading-tight">{atendimento.student.full_name}</span>
                        <span className="block leading-tight text-emerald-800">{horario}</span>
                        {atendimento.notes && <span className="block leading-tight text-emerald-900">{atendimento.notes}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
