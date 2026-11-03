export const PHASES = {
  TRIAGEM: 1,
  ANAMNESE: 2,
} as const;

export const LEVELS = {
  ADMIN: 1,
  ALUNO_ESTUDANTE: 2,
  PROFISSIONAL_EDUCACAO: 3,
  PROFISSIONAL_SAUDE: 4,
  PROFISSIONAL_NAPNE: 5,
} as const;

export const STUDENT_RECORD_READERS: readonly number[] = [
  LEVELS.ADMIN,
  LEVELS.PROFISSIONAL_EDUCACAO,
  LEVELS.PROFISSIONAL_SAUDE,
  LEVELS.PROFISSIONAL_NAPNE,
];

export const ANAMNESIS_READERS: readonly number[] = [LEVELS.PROFISSIONAL_NAPNE];

// Quem lê o estudo de caso de qualquer estudante. O estudante lê só o próprio, e
// quem escreve é só o Profissional NAPNE (declarado nas rotas).
export const CASE_STUDY_READERS: readonly number[] = [
  LEVELS.ADMIN,
  LEVELS.PROFISSIONAL_EDUCACAO,
  LEVELS.PROFISSIONAL_SAUDE,
  LEVELS.PROFISSIONAL_NAPNE,
];

// Quem lê os PAEE de qualquer estudante. O estudante lê só os próprios, e quem
// escreve é só o Profissional NAPNE (declarado nas rotas).
export const AEE_PLAN_READERS: readonly number[] = [
  LEVELS.ADMIN,
  LEVELS.PROFISSIONAL_EDUCACAO,
  LEVELS.PROFISSIONAL_SAUDE,
  LEVELS.PROFISSIONAL_NAPNE,
];

// Servidores que podem ser o responsável pedagógico de um estudante.
export const PEDAGOGICAL_MANAGER_LEVELS: readonly number[] = [
  LEVELS.PROFISSIONAL_EDUCACAO,
  LEVELS.PROFISSIONAL_NAPNE,
];

// Quem lê o telefone e o CPF do responsável pedagógico externo, dados de uma
// pessoa que não usa o sistema. Quem não está na lista só lê o nome (menor
// privilégio, ASVS 5.0 8.2.3).
export const MANAGER_CONTACT_READERS: readonly number[] = [
  LEVELS.ADMIN,
  LEVELS.PROFISSIONAL_NAPNE,
];

export const COMMENT_EDIT_LIMIT = 10;

export type Phase = keyof typeof PHASES;
export type Level = keyof typeof LEVELS;
export type LevelValue = (typeof LEVELS)[Level];
