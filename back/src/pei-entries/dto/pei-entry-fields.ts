// Tamanho máximo de cada campo do registro do PEI. A soma dos limites de todos
// os campos, com a lista cheia e cada caractere em 2 bytes (o "ã" do português
// acentuado), cabe no limite de 100 kb do body parser (conferido em
// test/pei-entries/dto/create-pei-entry.dto.spec.ts), então um limite novo ou
// maior precisa manter essa conta. Os decoradores que aplicam esses limites
// estão em src/common/dto-fields.ts.
export const SUBJECT_MAX_LENGTH = 150;
export const TEXT_MAX_LENGTH = 2000;
export const SYLLABUS_CONTENT_MAX_LENGTH = 500;
export const ADAPTATION_MAX_LENGTH = 1000;
export const SYLLABUS_ADAPTATIONS_MAX_ITEMS = 20;
