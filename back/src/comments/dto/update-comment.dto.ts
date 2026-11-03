import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { MaxCombiningMarkRun, TEXT_PATTERN } from 'src/common/dto-fields';
import {
  COMMENT_COMBINING_MARKS_MESSAGE,
  COMMENT_CONTROL_CHARACTERS_MESSAGE,
  COMMENT_MAX_LENGTH_CEILING,
  CommentMaxLength,
} from '../comment-max-length';
import { COMBINING_MARKS_MAX_RUN, COMMENT_MAX_LENGTH } from 'src/constants';

export class UpdateCommentDto {
  @ApiProperty({
    description: `Novo texto do registro. O limite depende do tipo gravado, que não muda: ${COMMENT_MAX_LENGTH.NOTE} caracteres para NOTE e ${COMMENT_MAX_LENGTH.CLASS_COUNCIL_REPORT} para CLASS_COUNCIL_REPORT.`,
    example: 'Estudante "tal" teve um surto esta manhã',
    maxLength: COMMENT_MAX_LENGTH_CEILING,
  })
  @IsNotEmpty({ message: 'O campo comment não deve estar vazio.' })
  @IsString({ message: 'O campo comment deve ser uma string.' })
  @CommentMaxLength(() => COMMENT_MAX_LENGTH_CEILING)
  @Matches(TEXT_PATTERN, { message: COMMENT_CONTROL_CHARACTERS_MESSAGE })
  @MaxCombiningMarkRun(COMBINING_MARKS_MAX_RUN, COMMENT_COMBINING_MARKS_MESSAGE)
  comment: string;

  @ApiPropertyOptional({
    description:
      'Quando verdadeiro, envia um aviso por e-mail ao estudante informando que a anotação foi atualizada.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'O campo notify_by_email deve ser um booleano.' })
  notify_by_email?: boolean;
}
