import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsCpf, onlyDigits } from 'src/common/validators/is-cpf.validator';
import { LEVELS } from 'src/constants';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome do usuário',
    example: 'Luizin',
  })
  @IsNotEmpty({ message: 'O campo full_name não deve estar vazio.' })
  @IsString({ message: 'O campo full_name deve ser uma string.' })
  full_name: string;

  @ApiProperty({
    description: 'CPF, com ou sem máscara. É gravado sempre com os 11 dígitos.',
    example: '01234567890',
  })
  @IsNotEmpty({ message: 'O campo CPF não deve estar vazio.' })
  @IsString({ message: 'O campo CPF deve ser uma string.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? onlyDigits(value) : value,
  )
  @IsCpf({ message: 'O campo CPF deve ser um CPF válido.' })
  cpf: string;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'luizin@hotmail.com',
  })
  @IsNotEmpty({ message: 'O campo email não deve estar vazio.' })
  @IsEmail({}, { message: 'O campo email deve ser um e-mail válido.' })
  email: string;

  @ApiProperty({
    description: 'Filiação do usuário',
    example: 'Filiação',
    required: false,
  })
  @IsOptional({ message: 'O campo affliation é opcional.' })
  @IsString({ message: 'O campo affliation deve ser uma string.' })
  affliation?: string;

  @ApiProperty({
    description: 'Responsável pedagógico',
    example: 'Luizin',
    required: false,
  })
  @IsOptional({ message: 'O campo pedagogical_manager é opcional.' })
  @IsString({ message: 'O campo pedagogical_manager deve ser uma string.' })
  pedagogical_manager?: string;

  @ApiProperty({
    description: 'Nível de acesso do usuário criado pelo administrador.',
    default: 2,
    required: false,
  })
  @IsOptional({ message: 'O campo id_level é opcional.' })
  @IsNumber({}, { message: 'O campo id_level deve ser um número.' })
  @IsInt({ message: 'O campo id_level deve ser um inteiro.' })
  @IsIn(Object.values(LEVELS), {
    message: 'O campo id_level deve ser um nível de acesso existente.',
  })
  id_level?: number;
}
