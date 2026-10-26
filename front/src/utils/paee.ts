import { PROFISSIONAL_NAPNE } from '@/consts';
import { temPapel, type Papeis } from '@/utils/papeis';
import type { AeePlanAuthor, AeePlanPayload, AeePlanSections } from '@/interfaces/AeePlan';
import {
  NAO_INFORMADO,
  formularioDoRegistro,
  formularioVazioDe,
  marcacao,
  montarCorpoDe,
  numero,
  secoesDeLeitura,
  texto,
  textoLongo,
  validarFormularioDe,
  type ErrosDoFormulario,
  type Formulario,
  type SecaoDeLeitura,
  type SecaoDef,
} from './formularioPorTabela';

// Limites do DTO do PAEE no back.
export const LIMITES_PAEE = {
  DISCIPLINA: 150,
  CURTO: 200,
  TEXTO: 2000,
  LONGO: 4000,
  CARGA_HORARIA_MAXIMA: 40,
} as const;

export const TITULO_IDENTIFICACAO = 'Identificação';
const ROTULO_DISCIPLINA = 'Disciplina';
const TITULO_APOIOS = 'Outros apoios e serviços, internos e externos';
const TITULO_FINALIDADE = 'Finalidade do AEE';
const TITULO_EMBASAMENTO = 'Embasamento para o atendimento do AEE';
const TITULO_AVALIACAO =
  'Procedimentos e metodologias para avaliação do desenvolvimento do estudante no AEE';

// Rótulos e ordem copiados da seção "Solução Proposta" da issue #705. A mesma
// tabela monta o formulário, a leitura na tela e o PDF. O período letivo e o
// autor não estão aqui: o período só se escolhe na criação, e o autor vem da
// sessão.
export const SECOES_PAEE: readonly SecaoDef[] = [
  {
    titulo: TITULO_IDENTIFICACAO,
    grupos: [
      {
        campos: [
          texto('identification.subject', ROTULO_DISCIPLINA, LIMITES_PAEE.DISCIPLINA),
          numero(
            'identification.weekly_hours',
            'Carga horária semanal do AEE',
            LIMITES_PAEE.CARGA_HORARIA_MAXIMA,
            { singular: 'hora', plural: 'horas' },
          ),
          textoLongo(
            'identification.enrolled_subjects',
            'Disciplinas em que o estudante está matriculado',
            LIMITES_PAEE.TEXTO,
          ),
        ],
      },
    ],
  },
  {
    titulo: TITULO_EMBASAMENTO,
    grupos: [{ campos: [textoLongo('basis', TITULO_EMBASAMENTO, LIMITES_PAEE.LONGO)] }],
  },
  {
    titulo: 'Laudo/diagnóstico',
    grupos: [{ campos: [marcacao('has_diagnosis', 'Há laudo/diagnóstico?')] }],
  },
  {
    titulo: TITULO_APOIOS,
    grupos: [
      {
        titulo: TITULO_APOIOS,
        lista: true,
        campos: [
          marcacao('supports.psychology', 'Psicologia'),
          marcacao('supports.social_assistance', 'Assistência social'),
          marcacao('supports.psychopedagogy', 'Psicopedagogia'),
          marcacao('supports.medical', 'Área médica'),
          texto('supports.medical_specialty', 'Especialidade', LIMITES_PAEE.CURTO),
          marcacao('supports.physiotherapy', 'Fisioterapia'),
          marcacao('supports.speech_therapy', 'Fonoaudiologia'),
          marcacao('supports.equine_therapy', 'Equoterapia'),
          marcacao('supports.braille_transcription', 'Transcrição de material em braille/tinta'),
          marcacao('supports.libras_interpreter', 'Tradutor intérprete de Libras'),
          marcacao('supports.libras_teacher', 'Professor de Libras'),
          texto('supports.other', 'Outros', LIMITES_PAEE.CURTO),
        ],
      },
    ],
  },
  {
    titulo: TITULO_FINALIDADE,
    grupos: [
      {
        titulo: TITULO_FINALIDADE,
        lista: true,
        campos: [
          marcacao(
            'purpose.curricular_complementation',
            'Complementação curricular (estudantes com deficiência e TEA)',
          ),
          marcacao(
            'purpose.curricular_supplementation',
            'Suplementação curricular (altas habilidades/superdotação)',
          ),
          marcacao(
            'purpose.materials_adaptation',
            'Adaptação de materiais, serviços e/ou elaboração de recursos para acessibilidade',
          ),
          marcacao(
            'purpose.assistive_technology',
            'Indicação e monitoramento do uso de tecnologias assistivas',
          ),
          marcacao('purpose.systematic_follow_up', 'Acompanhamento sistemático do estudante'),
          texto('purpose.other', 'Outra', LIMITES_PAEE.CURTO),
        ],
      },
    ],
  },
  {
    titulo: 'Objetivos',
    grupos: [
      {
        campos: [
          textoLongo('objectives.general', 'Objetivo geral do AEE', LIMITES_PAEE.TEXTO),
          textoLongo('objectives.specific', 'Objetivos específicos do AEE', LIMITES_PAEE.TEXTO),
        ],
      },
    ],
  },
  {
    titulo: TITULO_AVALIACAO,
    grupos: [{ campos: [textoLongo('evaluation_procedures', TITULO_AVALIACAO, LIMITES_PAEE.LONGO)] }],
  },
];

// O formulário traz o período junto das seções, porque a criação o pede na
// mesma tela; o corpo do PATCH, que não o aceita, sai só das seções.
export type AeePlanForm = { semester: string } & Formulario<AeePlanSections>;

export const CAMINHO_DO_PERIODO = 'semester';

export function formularioVazioDoPlano(): AeePlanForm {
  return { [CAMINHO_DO_PERIODO]: '', ...formularioVazioDe<Formulario<AeePlanSections>>(SECOES_PAEE) };
}

export function formularioDoPlano(plano: AeePlanSections & { semester: string }): AeePlanForm {
  return {
    [CAMINHO_DO_PERIODO]: plano.semester,
    ...formularioDoRegistro<Formulario<AeePlanSections>>(SECOES_PAEE, plano),
  };
}

// Corpo das seções do POST e do PATCH. A carga horária em branco fica fora; o
// PATCH troca a seção inteira, então o campo omitido é o campo limpo. Quem
// chama valida antes: carga horária fora do padrão vira NaN.
export function montarCorpoDoPlano(form: AeePlanForm): AeePlanPayload {
  return montarCorpoDe<AeePlanPayload>(SECOES_PAEE, form);
}

// Período letivo no formato AAAA.S, com o semestre 1 ou 2.
const PERIODO_LETIVO = /^\d{4}\.[12]$/;
const ERRO_DO_PERIODO =
  'O campo "Período letivo" deve ter o formato AAAA.S, com semestre 1 ou 2 (por exemplo, 2026.1).';

export function periodoLetivoValido(periodo: string): boolean {
  return PERIODO_LETIVO.test(periodo.trim());
}

export function erroDoPeriodo(periodo: string): ErrosDoFormulario {
  return periodoLetivoValido(periodo) ? {} : { [CAMINHO_DO_PERIODO]: ERRO_DO_PERIODO };
}

// Mesmos limites do DTO do back; a chave do resultado é o caminho do campo. O
// PAEE já criado mantém o período, então só a criação o valida.
export function validarPlanoExistente(form: AeePlanForm): ErrosDoFormulario {
  return validarFormularioDe(SECOES_PAEE, form);
}

export function validarPlanoNovo(form: AeePlanForm): ErrosDoFormulario {
  return { ...erroDoPeriodo(form.semester), ...validarPlanoExistente(form) };
}

// A regra definitiva é do back (POST, PATCH e DELETE só do NAPNE). Aqui só
// decide se os botões de escrita aparecem.
export function podeEditarPaee(roles?: Papeis): boolean {
  return temPapel(roles, PROFISSIONAL_NAPNE);
}

type PlanoParaLeitura = AeePlanSections & {
  semester: string;
  author?: Pick<AeePlanAuthor, 'full_name'> | null;
};

// Seções do PAEE prontas para a tela de leitura e para o PDF. O curso vem do
// cadastro do estudante: undefined é o curso que o chamador não conhece (a
// linha some) e null é o cadastro sem curso. A Identificação segue a ordem da
// issue: curso, disciplina, período letivo, professor(a), e então o resto da
// tabela.
export function secoesDoPlanoParaLeitura(
  plano: PlanoParaLeitura,
  curso?: string | null,
): SecaoDeLeitura[] {
  return secoesDeLeitura(SECOES_PAEE, plano).map((secao) => {
    if (secao.titulo !== TITULO_IDENTIFICACAO) return secao;

    const periodoEProfessor = [
      { label: 'Período letivo', value: plano.semester?.trim() || NAO_INFORMADO },
      {
        label: 'Professor(a) do AEE',
        value: plano.author?.full_name?.trim() || NAO_INFORMADO,
      },
    ];
    const depoisDaDisciplina = secao.linhas.findIndex((linha) => linha.label === ROTULO_DISCIPLINA) + 1;
    return {
      titulo: secao.titulo,
      linhas: [
        ...(curso === undefined ? [] : [{ label: 'Curso', value: curso?.trim() || NAO_INFORMADO }]),
        ...secao.linhas.slice(0, depoisDaDisciplina),
        ...periodoEProfessor,
        ...secao.linhas.slice(depoisDaDisciplina),
      ],
    };
  });
}
