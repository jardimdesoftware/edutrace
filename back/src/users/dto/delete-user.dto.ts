import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteUserDto {
  @ApiPropertyOptional({
    description:
      'Senha do administrador. Dispensada enquanto a confirmação anterior, marcada com remember, estiver valendo.',
  })
  @IsOptional()
  @IsString({ message: 'O campo currentPassword deve ser uma string.' })
  @MaxLength(72, {
    message: 'O campo currentPassword deve ter no máximo 72 caracteres.',
  })
  currentPassword?: string;

  @ApiPropertyOptional({
    description:
      'Mantém a senha confirmada por 10 minutos nesta sessão, para as exclusões seguintes.',
  })
  @IsOptional()
  @IsBoolean({ message: 'O campo remember deve ser verdadeiro ou falso.' })
  remember?: boolean;
}
