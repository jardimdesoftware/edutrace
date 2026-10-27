import { PROFESSOR_AEE } from '@/consts';
import { temPapel, type Papeis } from '@/utils/papeis';
import type {
  CaseStudyAuthor,
  CaseStudyPayload,
  CaseStudySections,
} from '@/interfaces/CaseStudy';
import {
  NAO_INFORMADO,
  cursoDoEstudante,
  data,
  formularioDoRegistro,
  formularioVazioDe,
  marcacao,
  montarCorpoDe,
  numero,
  secoesDeLeitura,
  texto as campoTexto,
  textoLongo as campoTextoLongo,
  validarFormularioDe,
  type CampoDef,
  type ErrosDoFormulario,
  type Formulario,
  type GrupoDef,
  type SecaoDeLeitura,
  type SecaoDef,
} from './formularioPorTabela';

// A lógica orientada por tabela mora em formularioPorTabela.ts; os nomes abaixo
// continuam saindo daqui para quem já os importa.
export {
  NAO_INFORMADO,
  formatarDataISO,
  lerCaminho,
  type CampoDef,
  type ErrosDoFormulario,
  type GrupoDef,
  type LinhaDeLeitura,
  type SecaoDeLeitura,
  type SecaoDef,
} from './formularioPorTabela';

// Limites do DTO do estudo de caso no back.
export const LIMITES = {
  SERIE: 50,
  IDADE_MAXIMA: 120,
  CURTO: 200,
  OBSERVACOES: 1000,
  TEXTO: 2000,
  PARECER: 4000,
} as const;

export const TITULO_IDENTIFICACAO = 'Identificação';
const ROTULO_IDADE = 'Idade';

// O texto sem limite próprio usa o limite de texto do DTO.
const texto = (caminho: string, rotulo: string, max: number = LIMITES.TEXTO): CampoDef =>
  campoTexto(caminho, rotulo, max);
const textoLongo = (caminho: string, rotulo: string, max: number = LIMITES.TEXTO): CampoDef =>
  campoTextoLongo(caminho, rotulo, max);

function listaDeVerificacao(titulo: string, base: string, itens: [string, string][]): GrupoDef {
  return {
    titulo,
    lista: true,
    campos: [
      ...itens.map(([chave, rotulo]) => marcacao(`${base}.${chave}`, rotulo)),
      textoLongo(`${base}.notes`, 'Observações', LIMITES.OBSERVACOES),
    ],
  };
}

// Rótulos e ordem copiados da seção "Solução Proposta" da issue #704. A mesma
// tabela monta o formulário, a leitura na tela e o PDF.
export const SECOES: readonly SecaoDef[] = [
  {
    titulo: TITULO_IDENTIFICACAO,
    grupos: [
      {
        campos: [
          texto('identification.grade', 'Ano/série', LIMITES.SERIE),
          numero('identification.age', ROTULO_IDADE, LIMITES.IDADE_MAXIMA, {
            singular: 'ano',
            plural: 'anos',
          }),
          data('identification.date', 'Data'),
        ],
      },
    ],
  },
  {
    titulo: 'Informações gerais',
    grupos: [
      {
        campos: [
          textoLongo('general_info.diagnosis', 'Diagnóstico'),
          marcacao('general_info.has_medical_report', 'Laudo médico apresentado'),
        ],
      },
      {
        titulo: 'Acompanhamentos realizados',
        campos: [
          marcacao('general_info.follow_ups.health', 'Acompanhamento de saúde'),
          marcacao('general_info.follow_ups.therapies', 'Acompanhamento com terapias'),
          texto('general_info.follow_ups.other', 'Outros acompanhamentos', LIMITES.CURTO),
        ],
      },
    ],
  },
  {
    titulo: 'Histórico escolar',
    grupos: [
      {
        campos: [
          texto(
            'school_history.time_at_institution',
            'Tempo de permanência na instituição',
            LIMITES.CURTO,
          ),
          textoLongo(
            'school_history.previous_specialized_services',
            'Atendimentos especializados anteriores',
          ),
          textoLongo(
            'school_history.main_difficulties',
            'Principais dificuldades no contexto escolar',
          ),
          textoLongo('school_history.observed_potentialities', 'Potencialidades observadas'),
        ],
      },
    ],
  },
  {
    titulo: 'Aspectos pedagógicos',
    grupos: [
      listaDeVerificacao('Linguagem e comunicação', 'pedagogical_aspects.language', [
        ['verbal', 'Comunica-se verbalmente'],
        ['gestures', 'Comunica-se por gestos'],
        ['alternative_communication', 'Utiliza comunicação alternativa'],
        ['frequent_mediation', 'Necessita de mediação frequente'],
      ]),
      listaDeVerificacao('Leitura e escrita', 'pedagogical_aspects.reading_writing', [
        ['recognizes_letters', 'Reconhece letras'],
        ['recognizes_syllables', 'Reconhece sílabas'],
        ['reads_words', 'Lê palavras'],
        ['reads_sentences', 'Lê frases'],
        ['spontaneous_writing', 'Produz escrita espontânea'],
        ['copies_texts', 'Copia textos'],
        ['needs_adaptation', 'Necessita de adaptação'],
      ]),
      listaDeVerificacao('Matemática', 'pedagogical_aspects.math', [
        ['recognizes_numbers', 'Reconhece números'],
        ['counts', 'Realiza contagem'],
        ['simple_operations', 'Resolve operações simples'],
        ['problem_solving', 'Compreende situações-problema'],
        ['needs_concrete_material', 'Necessita de material concreto'],
      ]),
    ],
  },
  {
    titulo: 'Aspectos comportamentais e sociais',
    grupos: [
      {
        campos: [
          textoLongo('behavioral_social.peer_interaction', 'Interação com colegas'),
          textoLongo('behavioral_social.teacher_interaction', 'Interação com professores'),
          textoLongo('behavioral_social.participation', 'Participação nas atividades'),
          textoLongo(
            'behavioral_social.interfering_behaviors',
            'Comportamentos que interferem na aprendizagem',
          ),
        ],
      },
    ],
  },
  {
    titulo: 'Potencialidades e interesses',
    grupos: [{ campos: [textoLongo('potentialities_interests', 'Potencialidades e interesses')] }],
  },
  {
    titulo: 'Barreiras para aprendizagem e participação',
    grupos: [
      {
        campos: [textoLongo('barriers', 'Barreiras para aprendizagem e participação')],
      },
    ],
  },
  {
    titulo: 'Recursos e estratégias',
    grupos: [
      {
        campos: [
          textoLongo('resources_strategies.accessibility_resources', 'Recursos de acessibilidade'),
          textoLongo('resources_strategies.pedagogical_strategies', 'Estratégias pedagógicas'),
          textoLongo(
            'resources_strategies.curricular_adaptations',
            'Adaptações curriculares necessárias',
          ),
          textoLongo(
            'resources_strategies.adaptation_justification',
            'Justificativa para adaptação curricular',
          ),
        ],
      },
    ],
  },
  {
    titulo: 'Recomendações para o PEI',
    grupos: [
      {
        campos: [
          textoLongo('pei_recommendations.priority_objectives', 'Objetivos prioritários'),
          textoLongo('pei_recommendations.referrals', 'Encaminhamentos'),
          textoLongo('pei_recommendations.teacher_guidance', 'Orientações aos professores'),
        ],
      },
    ],
  },
  {
    titulo: 'Parecer do professor do AEE',
    grupos: [
      {
        campos: [
          textoLongo('aee_opinion.opinion', 'Parecer', LIMITES.PARECER),
          data('aee_opinion.date', 'Data do parecer'),
        ],
      },
    ],
  },
];

// O formulário tem a forma do corpo da API, mas guarda tudo o que o usuário
// digita como texto (idade e datas) ou marcação.
export type EstudoDeCasoForm = Formulario<CaseStudySections>;

export function formularioVazio(): EstudoDeCasoForm {
  return formularioVazioDe<EstudoDeCasoForm>(SECOES);
}

export function formularioDoEstudo(estudo: CaseStudySections): EstudoDeCasoForm {
  return formularioDoRegistro<EstudoDeCasoForm>(SECOES, estudo);
}

// Corpo das seções do POST e do PATCH. Idade e data em branco ficam fora; o
// PATCH troca a seção inteira, então o campo omitido é o campo limpo. Quem
// chama valida antes: idade fora do padrão vira NaN.
export function montarCorpo(form: EstudoDeCasoForm): CaseStudyPayload {
  return montarCorpoDe<CaseStudyPayload>(SECOES, form);
}

// Mesmos limites do DTO do back; a chave do resultado é o caminho do campo.
export function validarFormulario(form: EstudoDeCasoForm): ErrosDoFormulario {
  return validarFormularioDe(SECOES, form);
}

// A regra definitiva é do back (POST, PATCH e DELETE só do Professor do AEE). Aqui só
// decide se os botões de escrita aparecem.
export function podeEditarEstudoDeCaso(roles?: Papeis): boolean {
  return temPapel(roles, PROFESSOR_AEE);
}

type EstudoParaLeitura = CaseStudySections & {
  author?: Pick<CaseStudyAuthor, "full_name"> | null;
};

// Seções do estudo de caso prontas para a tela de leitura e para o PDF. O curso
// vem do cadastro do estudante, não do estudo de caso: undefined é o curso que
// o chamador não conhece (a linha some) e null é o cadastro sem curso. O
// professor do AEE é o autor do estudo de caso e entra logo depois da idade;
// o resto da Identificação segue a ordem da tabela, então um campo novo ali
// aparece sem mudar esta função.
export function secoesParaLeitura(
  estudo: EstudoParaLeitura,
  curso?: string | null,
): SecaoDeLeitura[] {
  return secoesDeLeitura(SECOES, estudo).map((secao) => {
    if (secao.titulo !== TITULO_IDENTIFICACAO) return secao;

    const professor = {
      label: 'Professor(a) do AEE',
      value: estudo.author?.full_name?.trim() || NAO_INFORMADO,
    };
    const depoisDaIdade = secao.linhas.findIndex((linha) => linha.label === ROTULO_IDADE) + 1;
    return {
      titulo: secao.titulo,
      linhas: [
        ...(curso === undefined ? [] : [{ label: 'Curso', value: curso?.trim() || NAO_INFORMADO }]),
        ...secao.linhas.slice(0, depoisDaIdade),
        professor,
        ...secao.linhas.slice(depoisDaIdade),
      ],
    };
  });
}

// Curso a mostrar na tela do estudo de caso (ver cursoDoEstudante).
export const cursoDoEstudo = cursoDoEstudante;
