import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { VerifyResetCodeDto } from './verify-reset-code.dto';

export class ResetPasswordDto extends VerifyResetCodeDto {
  @ApiProperty({
    description: 'Nova senha do usuário com no mínimo 6 caracteres.',
    example: 'senhaSegura123',
    minLength: 6,
  })
  @IsNotEmpty({ message: 'O campo password não deve estar vazio.' })
  @IsString({ message: 'O campo password deve ser uma string' })
  @MinLength(6, { message: 'A senha deve ter no minímo 6 caracteres' })
  password: string;
}
