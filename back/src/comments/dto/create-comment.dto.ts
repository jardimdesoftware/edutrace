import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  MaxCombiningMarkRun,
  OmittableField,
  TEXT_PATTERN,
} from 'src/common/dto-fields';
import { COMBINING_MARKS_MAX_RUN, COMMENT_MAX_LENGTH } from 'src/constants';
import {
  COMMENT_COMBINING_MARKS_MESSAGE,
  COMMENT_CONTROL_CHARACTERS_MESSAGE,
  COMMENT_MAX_LENGTH_CEILING,
  CommentMaxLength,
  commentMaxLengthOf,
} from '../comment-max-length';

export class CreateCommentDto {
  @ApiProperty({
    description: `Texto do registro. O limite depende do type: ${COMMENT_MAX_LENGTH.NOTE} caracteres para NOTE e ${COMMENT_MAX_LENGTH.CLASS_COUNCIL_REPORT} para CLASS_COUNCIL_REPORT.`,
    example: 'Estudante "tal" teve um surto está manhã',
    maxLength: COMMENT_MAX_LENGTH_CEILING,
  })
  @IsNotEmpty({ message: 'O campo comment não deve estar vazio.' })
  @IsString({ message: 'O campo comment deve ser uma string.' })
  @CommentMaxLength((dto) => commentMaxLengthOf(dto.type))
  @Matches(TEXT_PATTERN, { message: COMMENT_CONTROL_CHARACTERS_MESSAGE })
  @MaxCombiningMarkRun(COMBINING_MARKS_MAX_RUN, COMMENT_COMBINING_MARKS_MESSAGE)
  comment: string;

  @ApiPropertyOptional({
    description:
      'Tipo do registro: NOTE é a anotação e CLASS_COUNCIL_REPORT é o relatório multiprofissional do conselho de classe. Ausente, vale NOTE. O tipo não muda depois da criação.',
    enum: CommentType,
    default: CommentType.NOTE,
  })
  @OmittableField()
  @IsEnum(CommentType, {
    message: `O campo type deve ser ${Object.values(CommentType).join(' ou ')}.`,
  })
  type?: CommentType;

  @ApiProperty({
    description: 'Id do usuário que vai receber a anotação.',
    example: '2',
  })
  @IsNotEmpty({ message: 'O campo id_user não deve estar vazio.' })
  @IsNumber({ allowNaN: false })
  id_user: number;

  @ApiPropertyOptional({
    description:
      'Quando verdadeiro, envia um aviso por e-mail ao estudante informando que ele recebeu uma nova anotação.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'O campo notify_by_email deve ser um booleano.' })
  notify_by_email?: boolean;
}
