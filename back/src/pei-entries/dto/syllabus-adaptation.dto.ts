import { RequiredText, Text } from 'src/common/dto-fields';
import {
  ADAPTATION_MAX_LENGTH,
  SYLLABUS_CONTENT_MAX_LENGTH,
} from './pei-entry-fields';

// Um par da lista: o conteúdo previsto na ementa da disciplina e a adequação
// feita para o estudante. O conteúdo identifica o par e não pode ficar em
// branco; a adequação pode, enquanto o professor ainda não a definiu.
export class SyllabusAdaptationDto {
  @RequiredText(
    SYLLABUS_CONTENT_MAX_LENGTH,
    'Conteúdo previsto na ementa da disciplina.',
  )
  syllabus_content: string;

  @Text(
    ADAPTATION_MAX_LENGTH,
    'Adequação do conteúdo previsto na ementa para o estudante.',
  )
  adaptation: string;
}
