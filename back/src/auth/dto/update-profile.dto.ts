import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Novo e-mail do usuário.',
    example: 'novo-email@exemplo.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'O campo email deve ser um e-mail válido.' })
  email?: string;

  @ApiProperty({
    description: 'Nova senha do usuário com no mínimo 8 caracteres.',
    example: 'novaSenha123',
    minLength: 8,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'O campo password deve ser uma string.' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  password?: string;

  @ApiProperty({
    description: 'Senha atual, obrigatória para confirmar a alteração.',
    example: 'senhaAtual123',
  })
  @IsNotEmpty({ message: 'A senha atual é obrigatória.' })
  @IsString({ message: 'O campo currentPassword deve ser uma string.' })
  currentPassword: string;
}
