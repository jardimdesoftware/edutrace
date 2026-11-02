// A triagem em passos: a tabela de seções diz quais campos existem, e daqui
// saem o formulário vazio, o formulário de um registro e o corpo da API. O nome
// e o e-mail vêm do estudante da URL, e o atendimento especializado
// (special_service) a API exige mas nenhuma tela o pede: o corpo da criação o
// leva como "não", e o da edição o deixa como está.
import type { ScreeningData } from '@/interfaces/ScreeningData';
import {
  formularioDoRegistro,
  formularioVazioDe,
  marcacao,
  montarCorpoDe,
  texto,
  textoLongo,
  validarFormularioDe,
  type CampoDef,
  type ErrosDoFormulario,
  type Formulario,
  type GrupoDef,
  type SecaoDef,
} from './formularioPorTabela';

export const LIMITES_TRIAGEM = {
  CURTO: 200,
  LONGO: 2000,
} as const;

export type TriagemPayload = Omit<ScreeningData, 'full_name' | 'email' | 'special_service'>;
export type TriagemForm = Formulario<TriagemPayload>;

const outro = (caminho: string): CampoDef => texto(caminho, 'Outro', LIMITES_TRIAGEM.CURTO);

function opcoes(titulo: string, campos: CampoDef[]): GrupoDef {
  return { titulo, lista: true, campos };
}

const PASSO_DEFICIENCIAS = 'Deficiências física, visual e auditiva';
const PASSO_TRANSTORNOS = 'Transtornos globais e outros casos';

export const SECOES_TRIAGEM: readonly SecaoDef[] = [
  {
    titulo: 'Necessidade específica',
    grupos: [
      { campos: [textoLongo('report', 'Relatório médico', LIMITES_TRIAGEM.LONGO)] },
      opcoes('Necessidade específica', [
        marcacao('specific_need.deficiencia_fisica', 'Deficiência Física'),
        marcacao('specific_need.deficiencia_auditiva', 'Deficiência Auditiva/Surdez'),
        marcacao('specific_need.baixa_visao', 'Baixa Visão'),
        marcacao('specific_need.surdocegueira', 'Surdocegueira'),
        marcacao('specific_need.cegueira', 'Cegueira'),
        marcacao('specific_need.superdotacao', 'Altas habilidades/superdotação'),
        marcacao(
          'specific_need.transtornos_globais_de_desenvolvimento',
          'Transtornos globais do desenvolvimento',
        ),
        marcacao('specific_need.disturbio_de_aprendizagem', 'Distúrbios de aprendizagem'),
        outro('specific_need.outros'),
      ]),
    ],
  },
  {
    titulo: 'Deficiência física',
    passo: PASSO_DEFICIENCIAS,
    grupos: [
      opcoes('Deficiência física', [
        marcacao('physical_disability.necessita_de_transcritor', 'Necessita de transcritor'),
        marcacao('physical_disability.acesso_para_cadeirante', 'Necessita de acesso para cadeirante'),
        outro('physical_disability.outros'),
      ]),
    ],
  },
  {
    titulo: 'Deficiência visual',
    passo: PASSO_DEFICIENCIAS,
    grupos: [
      opcoes('Deficiência visual', [
        marcacao('visual_impairment.necessita_de_braille', 'Necessita de material didático em Braille'),
        marcacao('visual_impairment.material_com_fonte_aumentada', 'Material com fonte aumentada'),
        marcacao('visual_impairment.necessita_de_transcritor', 'Necessita de transcritor'),
        outro('visual_impairment.outros'),
      ]),
    ],
  },
  {
    titulo: 'Deficiência auditiva',
    passo: PASSO_DEFICIENCIAS,
    grupos: [
      opcoes('Deficiência auditiva', [
        marcacao(
          'hearing_impairment.necessita_de_interprete_de_lingua_de_sinais',
          'Necessita de intérprete de língua de sinais',
        ),
        marcacao(
          'hearing_impairment.necessita_de_interprete_oralizador',
          'Necessita de intérprete oralizador',
        ),
        outro('hearing_impairment.outros'),
      ]),
    ],
  },
  {
    titulo: 'Transtornos globais / altas habilidades',
    passo: PASSO_TRANSTORNOS,
    grupos: [
      opcoes('Transtornos globais / altas habilidades', [
        marcacao('global_disorder.necessita_de_ledor', 'Necessita de ledor'),
        marcacao('global_disorder.necessita_de_transcritor', 'Necessita de transcritor'),
        outro('global_disorder.outros'),
      ]),
    ],
  },
  {
    titulo: 'Outros casos de deficiência',
    passo: PASSO_TRANSTORNOS,
    grupos: [
      {
        campos: [textoLongo('other_disabilities', 'Descrição', LIMITES_TRIAGEM.LONGO)],
      },
    ],
  },
];

export function formularioVazio(): TriagemForm {
  return formularioVazioDe<TriagemForm>(SECOES_TRIAGEM);
}

export function formularioDaTriagem(triagem: ScreeningData): TriagemForm {
  return formularioDoRegistro<TriagemForm>(SECOES_TRIAGEM, triagem);
}

// O corpo do PATCH. O da criação soma o e-mail, o nome do estudante e o
// atendimento especializado (ver o começo do arquivo).
export function montarCorpo(form: TriagemForm): TriagemPayload {
  return montarCorpoDe<TriagemPayload>(SECOES_TRIAGEM, form);
}

export function validarFormulario(form: TriagemForm): ErrosDoFormulario {
  return validarFormularioDe(SECOES_TRIAGEM, form);
}
