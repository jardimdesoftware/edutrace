import { Flag, Section, Text } from 'src/common/dto-fields';
import { NOTES_MAX_LENGTH } from './case-study-fields';

export class CaseStudyLanguageDto {
  @Flag('Comunica-se verbalmente.')
  verbal: boolean;

  @Flag('Comunica-se por gestos.')
  gestures: boolean;

  @Flag('Utiliza comunicação alternativa.')
  alternative_communication: boolean;

  @Flag('Necessita de mediação frequente.')
  frequent_mediation: boolean;

  @Text(NOTES_MAX_LENGTH, 'Observações sobre linguagem e comunicação.')
  notes: string;
}

export class CaseStudyReadingWritingDto {
  @Flag('Reconhece letras.')
  recognizes_letters: boolean;

  @Flag('Reconhece sílabas.')
  recognizes_syllables: boolean;

  @Flag('Lê palavras.')
  reads_words: boolean;

  @Flag('Lê frases.')
  reads_sentences: boolean;

  @Flag('Produz escrita espontânea.')
  spontaneous_writing: boolean;

  @Flag('Copia textos.')
  copies_texts: boolean;

  @Flag('Necessita de adaptação.')
  needs_adaptation: boolean;

  @Text(NOTES_MAX_LENGTH, 'Observações sobre leitura e escrita.')
  notes: string;
}

export class CaseStudyMathDto {
  @Flag('Reconhece números.')
  recognizes_numbers: boolean;

  @Flag('Realiza contagem.')
  counts: boolean;

  @Flag('Resolve operações simples.')
  simple_operations: boolean;

  @Flag('Compreende situações-problema.')
  problem_solving: boolean;

  @Flag('Necessita de material concreto.')
  needs_concrete_material: boolean;

  @Text(NOTES_MAX_LENGTH, 'Observações sobre matemática.')
  notes: string;
}

export class CaseStudyPedagogicalAspectsDto {
  @Section(CaseStudyLanguageDto, 'Linguagem e comunicação.')
  language: CaseStudyLanguageDto;

  @Section(CaseStudyReadingWritingDto, 'Leitura e escrita.')
  reading_writing: CaseStudyReadingWritingDto;

  @Section(CaseStudyMathDto, 'Matemática.')
  math: CaseStudyMathDto;
}
