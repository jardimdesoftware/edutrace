import type { CommentType } from '@prisma/client';

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

// Quem lê os registros do PEI de qualquer estudante. O estudante lê só os
// próprios, e quem escreve é só o Profissional da Educação (declarado nas rotas).
export const PEI_ENTRY_READERS: readonly number[] = [
  LEVELS.ADMIN,
  LEVELS.PROFISSIONAL_EDUCACAO,
  LEVELS.PROFISSIONAL_SAUDE,
  LEVELS.PROFISSIONAL_NAPNE,
];

// Teto de registros do PEI ativos (não excluídos) de um estudante. O POST
// recusa o seguinte com 409, e excluir um registro libera a vaga.
export const PEI_ENTRIES_MAX_ACTIVE_PER_STUDENT = 300;

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

// Tamanho máximo do texto de cada tipo de anotação, em unidades UTF-16: o que o
// .length do JavaScript conta e o maxLength do textarea do front aplica. O
// MaxLength do class-validator conta o par surrogate (um emoji) como 1 e o
// seletor de variação como 0, então não serve de critério. O DTO de criação e o
// service de edição leem o limite daqui.
export const COMMENT_MAX_LENGTH = {
  NOTE: 1000,
  CLASS_COUNCIL_REPORT: 10000,
} as const satisfies Record<CommentType, number>;

// Paginação da lista de anotações do estudante: o limite é o tamanho da página,
// e o teto impede que um limit enorme devolva o histórico inteiro de uma vez.
export const COMMENT_LIST_LIMIT = { DEFAULT: 20, MAX: 50 } as const;

// Tamanho máximo do termo de busca da lista de anotações, em unidades UTF-16.
export const COMMENT_SEARCH_MAX_LENGTH = 200;

// Maior sequência de marcas combinantes (categoria Unicode M, os acentos soltos)
// que o texto da anotação e o termo de busca aceitam. É o limite do Stream-Safe
// Text Format (UAX #15). O normalize(NFD) do PostgreSQL, que a busca roda em
// cada registro, reordena cada sequência de marcas em tempo quadrático no
// tamanho dela, e texto de verdade não passa de 3 ou 4 marcas seguidas.
export const COMBINING_MARKS_MAX_RUN = 30;

// Tempo máximo de cada consulta da lista de anotações (statement_timeout, em
// milissegundos). O custo da busca por texto cresce com o tamanho dos registros
// do estudante, e sem teto uma busca lenta segura a conexão do pool até
// terminar. O PostgreSQL cancela a consulta que passa disto (SQLSTATE 57014).
export const COMMENT_LIST_STATEMENT_TIMEOUT_MS = 3000;

// Teto da transação que roda as três consultas da lista em sequência. Precisa
// passar de três vezes o tempo de cada consulta, senão o Prisma (cujo padrão é
// 5 s) fecha a transação antes do statement_timeout e a resposta vira 500, e
// não o 503 da busca lenta.
export const COMMENT_LIST_TRANSACTION_TIMEOUT_MS =
  COMMENT_LIST_STATEMENT_TIMEOUT_MS * 3 + 1000;

// Tempo máximo que a lista espera por uma conexão livre do pool para abrir a
// transação (maxWait do Prisma, cujo padrão é 2 s). Com o pool ocupado pelas
// buscas lentas, passar disto responde 503 "O sistema está ocupado".
export const COMMENT_LIST_TRANSACTION_MAX_WAIT_MS = 5000;

// Áreas que o filtro da lista aceita: os níveis de quem escreve anotações. O
// estudante só lê, então não é uma área de autor.
export const COMMENT_AUTHOR_AREAS: readonly number[] = [
  LEVELS.ADMIN,
  LEVELS.PROFISSIONAL_EDUCACAO,
  LEVELS.PROFISSIONAL_SAUDE,
  LEVELS.PROFISSIONAL_NAPNE,
];

export type Phase = keyof typeof PHASES;
export type Level = keyof typeof LEVELS;
export type LevelValue = (typeof LEVELS)[Level];
