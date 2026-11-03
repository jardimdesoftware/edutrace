import { PROFISSIONAL_NAPNE } from '@/consts';
import type {
  CaseStudy,
  CaseStudyAuthor,
  CaseStudyPayload,
  CaseStudySections,
} from '@/interfaces/CaseStudy';
import type { StudentData } from '@/interfaces/StudentData';

// Limites do DTO do estudo de caso no back.
export const LIMITES = {
  SERIE: 50,
  IDADE_MAXIMA: 120,
  CURTO: 200,
  OBSERVACOES: 1000,
  TEXTO: 2000,
  PARECER: 4000,
} as const;

export const NAO_INFORMADO = 'Não informado';
const NENHUMA_OPCAO = 'Nenhuma opção marcada';
export const TITULO_IDENTIFICACAO = 'Identificação';
const ROTULO_IDADE = 'Idade';

export type CampoDef =
  | { tipo: 'texto' | 'textoLongo'; caminho: string; rotulo: string; max: number }
  | {
      tipo: 'numero';
      caminho: string;
      rotulo: string;
      max: number;
      unidade: { singular: string; plural: string };
    }
  | { tipo: 'data' | 'marcacao'; caminho: string; rotulo: string };

// A lista de verificação agrupa itens marcáveis sob um título, com as
// observações em texto; os outros grupos só reúnem campos que têm um subtítulo.
export type GrupoDef =
  | { titulo?: string; lista?: false; campos: CampoDef[] }
  | { titulo: string; lista: true; campos: CampoDef[] };

export interface SecaoDef {
  titulo: string;
  grupos: GrupoDef[];
}

const texto = (caminho: string, rotulo: string, max: number = LIMITES.TEXTO): CampoDef => ({
  tipo: 'texto',
  caminho,
  rotulo,
  max,
});
const textoLongo = (caminho: string, rotulo: string, max: number = LIMITES.TEXTO): CampoDef => ({
  tipo: 'textoLongo',
  caminho,
  rotulo,
  max,
});
const marcacao = (caminho: string, rotulo: string): CampoDef => ({
  tipo: 'marcacao',
  caminho,
  rotulo,
});
const data = (caminho: string, rotulo: string): CampoDef => ({ tipo: 'data', caminho, rotulo });

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
          {
            tipo: 'numero',
            caminho: 'identification.age',
            rotulo: ROTULO_IDADE,
            max: LIMITES.IDADE_MAXIMA,
            unidade: { singular: 'ano', plural: 'anos' },
          },
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

const CAMPOS: readonly CampoDef[] = SECOES.flatMap((secao) => secao.grupos).flatMap(
  (grupo) => grupo.campos,
);

type Formulario<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends boolean
    ? boolean
    : NonNullable<T[K]> extends string | number
      ? string
      : Formulario<NonNullable<T[K]>>;
};

// O formulário tem a forma do corpo da API, mas guarda tudo o que o usuário
// digita como texto (idade e datas) ou marcação.
export type EstudoDeCasoForm = Formulario<CaseStudySections>;

export type ErrosDoFormulario = Record<string, string>;

type Registro = Record<string, unknown>;

export function lerCaminho(origem: unknown, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>((atual, chave) => {
    return typeof atual === 'object' && atual !== null ? (atual as Registro)[chave] : undefined;
  }, origem);
}

function comCaminho(origem: Registro, chaves: string[], valor: unknown): Registro {
  const [chave, ...resto] = chaves;
  const filho = origem[chave];
  return {
    ...origem,
    [chave]: resto.length
      ? comCaminho(typeof filho === 'object' && filho !== null ? (filho as Registro) : {}, resto, valor)
      : valor,
  };
}

function montar(valorDoCampo: (campo: CampoDef) => unknown): Registro {
  return CAMPOS.reduce<Registro>((corpo, campo) => {
    const valor = valorDoCampo(campo);
    return valor === undefined ? corpo : comCaminho(corpo, campo.caminho.split('.'), valor);
  }, {});
}

const PARTES_DA_DATA = /^(\d{4})-(\d{2})-(\d{2})/;

function partesDaData(valor: unknown): [string, string, string] | null {
  const partes = typeof valor === 'string' ? PARTES_DA_DATA.exec(valor) : null;
  return partes ? [partes[1], partes[2], partes[3]] : null;
}

// A API pode devolver a data com hora; o campo de data e a tela só usam o dia.
// Não passa por Date, que deslocaria o dia pelo fuso do navegador.
function dataParaCampo(valor: unknown): string {
  return partesDaData(valor)?.join('-') ?? '';
}

export function formatarDataISO(valor: string | null | undefined): string {
  const partes = partesDaData(valor);
  return partes ? `${partes[2]}/${partes[1]}/${partes[0]}` : '';
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

export function formularioVazio(): EstudoDeCasoForm {
  return montar((campo) => (campo.tipo === 'marcacao' ? false : '')) as EstudoDeCasoForm;
}

export function formularioDoEstudo(estudo: CaseStudySections): EstudoDeCasoForm {
  return montar((campo) => {
    const valor = lerCaminho(estudo, campo.caminho);
    switch (campo.tipo) {
      case 'marcacao':
        return valor === true;
      case 'numero':
        return typeof valor === 'number' ? String(valor) : '';
      case 'data':
        return dataParaCampo(valor);
      default:
        return textoDe(valor);
    }
  }) as EstudoDeCasoForm;
}

// Corpo das seções do POST e do PATCH. Idade e data em branco ficam fora; o
// PATCH troca a seção inteira, então o campo omitido é o campo limpo. Quem
// chama valida antes: idade fora do padrão vira NaN.
export function montarCorpo(form: EstudoDeCasoForm): CaseStudyPayload {
  return montar((campo) => {
    const valor = lerCaminho(form, campo.caminho);
    if (campo.tipo === 'marcacao') return valor === true;

    const limpo = textoDe(valor).trim();
    if (campo.tipo === 'numero') return limpo ? Number(limpo) : undefined;
    if (campo.tipo === 'data') return limpo || undefined;
    return limpo;
  }) as unknown as CaseStudyPayload;
}

function dataExiste(valor: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return false;

  const [ano, mes, dia] = partes.slice(1).map(Number);
  const normalizada = new Date(0);
  normalizada.setUTCFullYear(ano, mes - 1, dia);
  return (
    normalizada.getUTCFullYear() === ano &&
    normalizada.getUTCMonth() === mes - 1 &&
    normalizada.getUTCDate() === dia
  );
}

function erroDoCampo(campo: CampoDef, valor: unknown): string | null {
  const limpo = textoDe(valor).trim();

  switch (campo.tipo) {
    case 'texto':
    case 'textoLongo':
      return limpo.length > campo.max
        ? `O campo "${campo.rotulo}" deve ter no máximo ${campo.max} caracteres.`
        : null;
    case 'numero':
      return limpo && !(/^\d+$/.test(limpo) && Number(limpo) <= campo.max)
        ? `O campo "${campo.rotulo}" deve ser um número inteiro entre 0 e ${campo.max}.`
        : null;
    case 'data':
      return limpo && !dataExiste(limpo)
        ? `O campo "${campo.rotulo}" deve ser uma data válida.`
        : null;
    default:
      return null;
  }
}

// Mesmos limites do DTO do back; a chave do resultado é o caminho do campo.
export function validarFormulario(form: EstudoDeCasoForm): ErrosDoFormulario {
  return Object.fromEntries(
    CAMPOS.flatMap((campo) => {
      const erro = erroDoCampo(campo, lerCaminho(form, campo.caminho));
      return erro ? [[campo.caminho, erro]] : [];
    }),
  );
}

// A regra definitiva é do back (POST, PATCH e DELETE só do NAPNE). Aqui só
// decide se os botões de escrita aparecem.
export function podeEditarEstudoDeCaso(idLevel?: number): boolean {
  return idLevel === PROFISSIONAL_NAPNE;
}

export interface LinhaDeLeitura {
  label: string;
  value: string;
}

export interface SecaoDeLeitura {
  titulo: string;
  linhas: LinhaDeLeitura[];
}

type EstudoParaLeitura = CaseStudySections & {
  author?: Pick<CaseStudyAuthor, "full_name"> | null;
};

function textoOuNaoInformado(valor: unknown): string {
  return textoDe(valor).trim() || NAO_INFORMADO;
}

function valorDoCampo(campo: CampoDef, valor: unknown): string {
  switch (campo.tipo) {
    case 'marcacao':
      return valor === true ? 'Sim' : 'Não';
    case 'numero': {
      if (typeof valor !== 'number') return NAO_INFORMADO;
      const { singular, plural } = campo.unidade;
      return `${valor} ${valor === 1 ? singular : plural}`;
    }
    case 'data':
      return formatarDataISO(textoDe(valor)) || NAO_INFORMADO;
    default:
      return textoOuNaoInformado(valor);
  }
}

// Numa lista de verificação só os itens marcados saem, um por linha, como o
// relatório faz com os grupos de opções do PEI. As observações vão numa linha
// própria, que leva o título do grupo no rótulo.
function linhasDoGrupo(grupo: GrupoDef, estudo: unknown): LinhaDeLeitura[] {
  const linhaDe = (campo: CampoDef, label: string): LinhaDeLeitura => ({
    label,
    value: valorDoCampo(campo, lerCaminho(estudo, campo.caminho)),
  });

  if (!grupo.lista) return grupo.campos.map((campo) => linhaDe(campo, campo.rotulo));

  const marcados = grupo.campos
    .filter((campo) => campo.tipo === 'marcacao' && lerCaminho(estudo, campo.caminho) === true)
    .map((campo) => `• ${campo.rotulo}`);
  const observacoes = grupo.campos
    .filter((campo) => campo.tipo !== 'marcacao')
    .map((campo) => linhaDe(campo, `${grupo.titulo}: ${campo.rotulo.toLowerCase()}`));

  return [
    { label: grupo.titulo, value: marcados.length ? marcados.join('\n') : NENHUMA_OPCAO },
    ...observacoes,
  ];
}

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
  return SECOES.map((secao) => {
    const linhas = secao.grupos.flatMap((grupo) => linhasDoGrupo(grupo, estudo));
    if (secao.titulo !== TITULO_IDENTIFICACAO) return { titulo: secao.titulo, linhas };

    const professor = {
      label: 'Professor(a) do AEE',
      value: estudo.author?.full_name?.trim() || NAO_INFORMADO,
    };
    const depoisDaIdade = linhas.findIndex((linha) => linha.label === ROTULO_IDADE) + 1;
    return {
      titulo: secao.titulo,
      linhas: [
        ...(curso === undefined ? [] : [{ label: 'Curso', value: curso?.trim() || NAO_INFORMADO }]),
        ...linhas.slice(0, depoisDaIdade),
        professor,
        ...linhas.slice(depoisDaIdade),
      ],
    };
  });
}

// Curso a mostrar na tela do estudo de caso: o do estudo carregado, que vem com o
// estudante e é o único que o estudante lendo o próprio estudo recebe; sem
// estudo ainda, o do cadastro de quem o profissional abriu pelo id da URL.
// undefined é o curso que a tela não conhece (a linha some) e null é o
// estudante sem curso.
export function cursoDoEstudo(
  estudo: Pick<CaseStudy, 'student'> | null,
  registro: Pick<StudentData, 'course'> | null,
): string | null | undefined {
  const origem = estudo?.student ?? registro;
  return origem ? (origem.course ?? null) : undefined;
}
