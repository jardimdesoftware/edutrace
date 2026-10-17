export const STUDENT_EMAIL = 'estudante@example.com';

// Limite do body parser do Express, que o Nest usa por padrão (100 kb). O
// projeto não o altera, então a soma dos limites dos campos precisa caber nele.
export const BODY_LIMIT_BYTES = 100 * 1024;

export const SECTION_KEYS = [
  'identification',
  'general_info',
  'school_history',
  'pedagogical_aspects',
  'behavioral_social',
  'potentialities_interests',
  'barriers',
  'resources_strategies',
  'pei_recommendations',
  'aee_opinion',
] as const;

// Sections de objeto, as que o DTO valida de forma aninhada.
export const OBJECT_SECTION_KEYS = SECTION_KEYS.filter(
  (key) => key !== 'potentialities_interests' && key !== 'barriers',
);

// Caminho de cada campo de texto e o tamanho máximo dele. O limite fica escrito
// aqui, e não importado do DTO, para que mudar um limite do DTO quebre o teste.
export const TEXT_LIMITS: ReadonlyArray<readonly [string, number]> = [
  ['identification.grade', 50],
  ['general_info.diagnosis', 2000],
  ['general_info.follow_ups.other', 200],
  ['school_history.time_at_institution', 200],
  ['school_history.previous_specialized_services', 2000],
  ['school_history.main_difficulties', 2000],
  ['school_history.observed_potentialities', 2000],
  ['pedagogical_aspects.language.notes', 1000],
  ['pedagogical_aspects.reading_writing.notes', 1000],
  ['pedagogical_aspects.math.notes', 1000],
  ['behavioral_social.peer_interaction', 2000],
  ['behavioral_social.teacher_interaction', 2000],
  ['behavioral_social.participation', 2000],
  ['behavioral_social.interfering_behaviors', 2000],
  ['potentialities_interests', 2000],
  ['barriers', 2000],
  ['resources_strategies.accessibility_resources', 2000],
  ['resources_strategies.pedagogical_strategies', 2000],
  ['resources_strategies.curricular_adaptations', 2000],
  ['resources_strategies.adaptation_justification', 2000],
  ['pei_recommendations.priority_objectives', 2000],
  ['pei_recommendations.referrals', 2000],
  ['pei_recommendations.teacher_guidance', 2000],
  ['aee_opinion.opinion', 4000],
];

// O diagnóstico é o único texto que pode faltar no corpo.
export const OPTIONAL_TEXT_PATHS = ['general_info.diagnosis'];

export const REQUIRED_TEXT_LIMITS = TEXT_LIMITS.filter(
  ([path]) => !OPTIONAL_TEXT_PATHS.includes(path),
);

export const FLAG_PATHS: readonly string[] = [
  'general_info.has_medical_report',
  'general_info.follow_ups.health',
  'general_info.follow_ups.therapies',
  'pedagogical_aspects.language.verbal',
  'pedagogical_aspects.language.gestures',
  'pedagogical_aspects.language.alternative_communication',
  'pedagogical_aspects.language.frequent_mediation',
  'pedagogical_aspects.reading_writing.recognizes_letters',
  'pedagogical_aspects.reading_writing.recognizes_syllables',
  'pedagogical_aspects.reading_writing.reads_words',
  'pedagogical_aspects.reading_writing.reads_sentences',
  'pedagogical_aspects.reading_writing.spontaneous_writing',
  'pedagogical_aspects.reading_writing.copies_texts',
  'pedagogical_aspects.reading_writing.needs_adaptation',
  'pedagogical_aspects.math.recognizes_numbers',
  'pedagogical_aspects.math.counts',
  'pedagogical_aspects.math.simple_operations',
  'pedagogical_aspects.math.problem_solving',
  'pedagogical_aspects.math.needs_concrete_material',
];

export const DATE_PATHS = ['identification.date', 'aee_opinion.date'];

// A idade e as duas datas podem faltar no corpo: o formulário as omite quando
// estão em branco. Quando vêm, são validadas.
export const OPTIONAL_NON_TEXT_PATHS = ['identification.age', ...DATE_PATHS];

export type Json = Record<string, unknown>;

export function validSections(): Json {
  return {
    identification: { grade: '3º ano', age: 17, date: '2026-10-17' },
    general_info: {
      diagnosis: 'Transtorno do espectro autista',
      has_medical_report: true,
      follow_ups: { health: true, therapies: false, other: 'Fonoaudiologia' },
    },
    school_history: {
      time_at_institution: '2 anos',
      previous_specialized_services: 'Sala de recursos multifuncionais',
      main_difficulties: 'Concentração em atividades longas',
      observed_potentialities: 'Memória visual',
    },
    pedagogical_aspects: {
      language: {
        verbal: true,
        gestures: false,
        alternative_communication: false,
        frequent_mediation: true,
        notes: 'Comunica-se bem em duplas',
      },
      reading_writing: {
        recognizes_letters: true,
        recognizes_syllables: true,
        reads_words: true,
        reads_sentences: false,
        spontaneous_writing: false,
        copies_texts: true,
        needs_adaptation: true,
        notes: 'Lê palavras simples',
      },
      math: {
        recognizes_numbers: true,
        counts: true,
        simple_operations: false,
        problem_solving: false,
        needs_concrete_material: true,
        notes: 'Usa material dourado',
      },
    },
    behavioral_social: {
      peer_interaction: 'Interage com poucos colegas',
      teacher_interaction: 'Busca a mediação do professor',
      participation: 'Participa quando solicitado',
      interfering_behaviors: 'Agita-se com ruído alto',
    },
    potentialities_interests: 'Interesse por informática',
    barriers: 'Salas com muito ruído',
    resources_strategies: {
      accessibility_resources: 'Fones abafadores',
      pedagogical_strategies: 'Atividades curtas e com apoio visual',
      curricular_adaptations: 'Avaliação com tempo estendido',
      adaptation_justification: 'Dificuldade de concentração prolongada',
    },
    pei_recommendations: {
      priority_objectives: 'Ampliar a leitura de frases',
      referrals: 'Acompanhamento fonoaudiológico',
      teacher_guidance: 'Antecipar a rotina da aula',
    },
    aee_opinion: {
      opinion: 'Recomenda-se o PEI com adaptação de avaliação.',
      date: '2026-10-17',
    },
  };
}

// Corpo como o formulário o envia com tudo em branco: todo texto é a string
// vazia, e a idade e as datas são omitidas.
export function blankSections(): Json {
  const withBlankTexts = TEXT_LIMITS.reduce(
    (body, [path]) => setAt(body, path, ''),
    validSections(),
  );
  return OPTIONAL_NON_TEXT_PATHS.reduce(
    (body, path) => removeAt(body, path),
    withBlankTexts,
  );
}

export function validBody(): Json {
  return { student_email: STUDENT_EMAIL, ...validSections() };
}

export function getAt(source: Json, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Json | undefined)?.[key], source);
}

// Devolve uma cópia com o valor trocado; o objeto de origem não muda.
export function setAt(source: Json, path: string, value: unknown): Json {
  const copy = structuredClone(source);
  const keys = path.split('.');
  const last = keys.pop() as string;
  const parent = keys.reduce<Json>((node, key) => node[key] as Json, copy);
  parent[last] = value;
  return copy;
}

// Devolve uma cópia sem a chave; o objeto de origem não muda.
export function removeAt(source: Json, path: string): Json {
  const copy = structuredClone(source);
  const keys = path.split('.');
  const last = keys.pop() as string;
  const parent = keys.reduce<Json>((node, key) => node[key] as Json, copy);
  delete parent[last];
  return copy;
}

// Corpo com todo texto no tamanho máximo. O "ã" ocupa 2 bytes em UTF-8, o caso
// comum do português acentuado; um corpo todo em caracteres de 3 bytes (CJK, aspas
// e travessões tipográficos) passaria dos 100 kb e o body parser responderia 413.
export function maxBody(): Json {
  return TEXT_LIMITS.reduce(
    (body, [path, limit]) => setAt(body, path, 'ã'.repeat(limit)),
    validBody(),
  );
}

export const byteLengthOf = (value: unknown) =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');
