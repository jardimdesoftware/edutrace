import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { VerifyResetCodeDto } from './verify-reset-code.dto';

export class ResetPasswordDto extends VerifyResetCodeDto {
  @ApiProperty({
    description: 'Nova senha do usuário com no mínimo 8 caracteres.',
    example: 'senhaSegura123',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'O campo password não deve estar vazio.' })
  @IsString({ message: 'O campo password deve ser uma string' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  password: string;
}
