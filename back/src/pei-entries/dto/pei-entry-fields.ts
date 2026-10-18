// Tamanho máximo de cada campo do registro do PEI. Os sete campos de conteúdo,
// com a lista cheia e cada caractere em 2 bytes (o "ã" do português acentuado),
// cabem no limite de 100 kb do body parser, e os quatro campos do parecer
// semestral, que usam o TEXT_MAX_LENGTH, também (conferido em
// test/pei-entries/dto/create-pei-entry.dto.spec.ts e em
// update-pei-entry.dto.spec.ts). O front grava o conteúdo e o parecer em
// formulários separados, porque os onze campos juntos ocupam uns 101 mil dos
// 102,4 mil bytes do limite, então um limite novo ou maior precisa manter essas
// contas. Os decoradores que aplicam esses limites estão em
// src/common/dto-fields.ts.
export const SUBJECT_MAX_LENGTH = 150;
export const TEXT_MAX_LENGTH = 2000;
export const SYLLABUS_CONTENT_MAX_LENGTH = 500;
export const ADAPTATION_MAX_LENGTH = 1000;
export const SYLLABUS_ADAPTATIONS_MAX_ITEMS = 20;
