// Tamanho máximo de cada tipo de texto. A soma dos limites de todos os campos
// cabe no limite de 100 kb do body parser (conferido em
// test/aee-plans/dto/create-aee-plan.dto.spec.ts), então um limite novo ou
// maior precisa manter essa conta. Os decoradores que aplicam esses limites
// estão em src/common/dto-fields.ts.
export const SUBJECT_MAX_LENGTH = 150;
export const SHORT_TEXT_MAX_LENGTH = 200;
export const TEXT_MAX_LENGTH = 2000;
export const LONG_TEXT_MAX_LENGTH = 4000;
export const WEEKLY_HOURS_MAX = 40;

// Período letivo AAAA.S, com S igual a 1 ou 2. O \d do JavaScript só casa os
// dígitos ASCII, e o $ só casa no fim do texto (não antes de uma quebra de
// linha final).
export const SEMESTER_PATTERN = /^\d{4}\.[12]$/;
