// Tamanho máximo de cada tipo de texto. A soma dos limites de todos os campos
// cabe no limite de 100 kb do body parser (conferido em
// test/case-studies/dto/create-case-study.dto.spec.ts), então um limite novo
// ou maior precisa manter essa conta. Os decoradores que aplicam esses limites
// estão em src/common/dto-fields.ts.
export const GRADE_MAX_LENGTH = 50;
export const SHORT_TEXT_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 1000;
export const TEXT_MAX_LENGTH = 2000;
export const OPINION_MAX_LENGTH = 4000;
export const AGE_MAX = 120;
