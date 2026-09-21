import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Anotação que deseja fazer para o estudante.',
    example: 'Estudante "tal" teve um surto está manhã',
    maxLength: 1000,
  })
  @IsNotEmpty({ message: 'O campo comment não deve estar vazio.' })
  @IsString({ message: 'O campo comment deve ser uma string.' })
  @MaxLength(1000, {
    message: 'O campo comment deve ter no máximo 1000 caracteres.',
  })
  comment: string;

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
