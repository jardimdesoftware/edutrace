import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Novo texto da anotação.',
    example: 'Estudante "tal" teve um surto esta manhã',
    maxLength: 1000,
  })
  @IsNotEmpty({ message: 'O campo comment não deve estar vazio.' })
  @IsString({ message: 'O campo comment deve ser uma string.' })
  @MaxLength(1000, {
    message: 'O campo comment deve ter no máximo 1000 caracteres.',
  })
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
