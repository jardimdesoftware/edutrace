export const STUDENT_EMAIL = 'estudante@example.com';

// Período letivo no formato AAAA.S, com S igual a 1 ou 2.
export const SEMESTER = '2026.2';

// Limite do body parser do Express, que o Nest usa por padrão (100 kb). O
// projeto não o altera, então a soma dos limites dos campos precisa caber nele.
export const BODY_LIMIT_BYTES = 100 * 1024;

export const SECTION_KEYS = [
  'identification',
  'basis',
  'has_diagnosis',
  'supports',
  'purpose',
  'objectives',
  'evaluation_procedures',
] as const;

// Sections de objeto, as que o DTO valida de forma aninhada.
export const OBJECT_SECTION_KEYS = SECTION_KEYS.filter(
  (key) =>
    key !== 'basis' &&
    key !== 'has_diagnosis' &&
    key !== 'evaluation_procedures',
);

// Caminho de cada campo de texto e o tamanho máximo dele. O limite fica escrito
// aqui, e não importado do DTO, para que mudar um limite do DTO quebre o teste.
// O front copia esta lista. Todo texto precisa estar no corpo, e a string vazia
// é válida.
export const TEXT_LIMITS: ReadonlyArray<readonly [string, number]> = [
  ['identification.subject', 150],
  ['identification.enrolled_subjects', 2000],
  ['basis', 4000],
  ['supports.medical_specialty', 200],
  ['supports.other', 200],
  ['purpose.other', 200],
  ['objectives.general', 2000],
  ['objectives.specific', 2000],
  ['evaluation_procedures', 4000],
];

// Caminho de cada caixa de seleção. O front copia esta lista.
export const FLAG_PATHS: readonly string[] = [
  'has_diagnosis',
  'supports.psychology',
  'supports.social_assistance',
  'supports.psychopedagogy',
  'supports.medical',
  'supports.physiotherapy',
  'supports.speech_therapy',
  'supports.equine_therapy',
  'supports.braille_transcription',
  'supports.libras_interpreter',
  'supports.libras_teacher',
  'purpose.curricular_complementation',
  'purpose.curricular_supplementation',
  'purpose.materials_adaptation',
  'purpose.assistive_technology',
  'purpose.systematic_follow_up',
];

export const WEEKLY_HOURS_PATH = 'identification.weekly_hours';
export const WEEKLY_HOURS_MAX = 40;

// A carga horária semanal é o único campo que pode faltar no corpo: o
// formulário a omite quando está em branco. Quando vem, é validada.
export const OPTIONAL_NON_TEXT_PATHS = [WEEKLY_HOURS_PATH];

export type Json = Record<string, unknown>;

export function validSections(): Json {
  return {
    identification: {
      subject: 'Atendimento em sala de recursos multifuncionais',
      weekly_hours: 4,
      enrolled_subjects: 'Matemática, Língua Portuguesa e Informática',
    },
    basis: 'Dificuldade de concentração em atividades longas',
    has_diagnosis: true,
    supports: {
      psychology: true,
      social_assistance: false,
      psychopedagogy: true,
      medical: true,
      medical_specialty: 'Neuropediatria',
      physiotherapy: false,
      speech_therapy: true,
      equine_therapy: false,
      braille_transcription: false,
      libras_interpreter: false,
      libras_teacher: false,
      other: 'Acompanhamento no CRAS',
    },
    purpose: {
      curricular_complementation: true,
      curricular_supplementation: false,
      materials_adaptation: true,
      assistive_technology: false,
      systematic_follow_up: true,
      other: 'Orientação à família',
    },
    objectives: {
      general: 'Ampliar a autonomia do estudante nas atividades escolares',
      specific: 'Desenvolver a leitura de frases e o uso do caderno adaptado',
    },
    evaluation_procedures: 'Observação em sala e registro quinzenal',
  };
}

// Corpo como o formulário o envia com tudo em branco: todo texto é a string
// vazia e a carga horária é omitida.
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
  return {
    student_email: STUDENT_EMAIL,
    semester: SEMESTER,
    ...validSections(),
  };
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
// e travessões tipográficos) ainda cabe nos 100 kb, porque a soma dos limites é
// de uns 15 mil caracteres.
export function maxBody(): Json {
  return TEXT_LIMITS.reduce(
    (body, [path, limit]) => setAt(body, path, 'ã'.repeat(limit)),
    validBody(),
  );
}

export const byteLengthOf = (value: unknown) =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');
