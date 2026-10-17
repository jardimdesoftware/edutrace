import { Json, setAt } from '../aee-plans/aee-plan.fixtures';

// Os auxiliares de caminho e de tamanho são os mesmos do PAEE: servem a
// qualquer corpo JSON.
export {
  BODY_LIMIT_BYTES,
  byteLengthOf,
  getAt,
  removeAt,
  setAt,
  type Json,
} from '../aee-plans/aee-plan.fixtures';

export const STUDENT_EMAIL = 'estudante@example.com';

// Semestre no formato AAAA.S, com S igual a 1 ou 2.
export const SEMESTER = '2026.2';

export const SUBJECT = 'Matemática';

// Os limites ficam escritos aqui, e não importados do DTO, para que mudar um
// limite do DTO quebre o teste. O front copia estes valores.
export const SUBJECT_MAX = 150;
export const TEXT_MAX = 2000;
export const SYLLABUS_CONTENT_MAX = 500;
export const ADAPTATION_MAX = 1000;
export const PAIRS_MAX = 20;

export const CONTENT_KEYS = [
  'adapted_objectives',
  'prioritized_contents',
  'syllabus_adaptations',
  'adapted_methodologies',
  'adapted_assessments',
  'adapted_resources',
  'general_notes',
] as const;

// Os seis campos de texto simples do conteúdo e o tamanho máximo de cada um.
// Todo texto precisa estar no corpo, e a string vazia é válida.
export const TEXT_LIMITS: ReadonlyArray<readonly [string, number]> = [
  ['adapted_objectives', TEXT_MAX],
  ['prioritized_contents', TEXT_MAX],
  ['adapted_methodologies', TEXT_MAX],
  ['adapted_assessments', TEXT_MAX],
  ['adapted_resources', TEXT_MAX],
  ['general_notes', TEXT_MAX],
];

export const TEXT_KEYS = TEXT_LIMITS.map(([key]) => key);

export function validPair(): Json {
  return {
    syllabus_content: 'Frações e números decimais',
    adaptation: 'Material com apoio visual e atividades em duas etapas',
  };
}

export function validContent(): Json {
  return {
    adapted_objectives: 'Reconhecer frações simples em situações do cotidiano',
    prioritized_contents: 'Operações com frações e números decimais',
    syllabus_adaptations: [
      validPair(),
      {
        syllabus_content: 'Equações do primeiro grau',
        adaptation: 'Resolução com material concreto',
      },
    ],
    adapted_methodologies: 'Aula expositiva curta e atividade em dupla',
    adapted_assessments: 'Prova com tempo ampliado e enunciados curtos',
    adapted_resources: 'Material ampliado e calculadora',
    general_notes: 'O estudante rende mais nas primeiras aulas do dia',
  };
}

export function validBody(): Json {
  return {
    student_email: STUDENT_EMAIL,
    semester: SEMESTER,
    subject: SUBJECT,
    ...validContent(),
  };
}

// Corpo como o formulário o envia com tudo em branco: todo texto é a string
// vazia e a lista de pares é vazia. A disciplina e o semestre não entram, pois
// são obrigatórios e não podem ficar em branco.
export function blankContent(): Json {
  return {
    ...TEXT_KEYS.reduce((body, key) => setAt(body, key, ''), validContent()),
    syllabus_adaptations: [],
  };
}

export function maxPairs(count = PAIRS_MAX): Json[] {
  return Array.from({ length: count }, () => ({
    syllabus_content: 'ã'.repeat(SYLLABUS_CONTENT_MAX),
    adaptation: 'ã'.repeat(ADAPTATION_MAX),
  }));
}

// Corpo com todo texto no tamanho máximo e a lista cheia. O "ã" ocupa 2 bytes em
// UTF-8, o caso comum do português acentuado, e a quebra de linha escapada
// (\n) também ocupa 2 bytes no JSON.
export function maxBody(): Json {
  const withMaxTexts = [...TEXT_LIMITS].reduce(
    (body, [key, limit]) => setAt(body, key, 'ã'.repeat(limit)),
    setAt(validBody(), 'subject', 'ã'.repeat(SUBJECT_MAX)),
  );
  return setAt(withMaxTexts, 'syllabus_adaptations', maxPairs());
}
