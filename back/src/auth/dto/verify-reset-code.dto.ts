import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class VerifyResetCodeDto {
  @ApiProperty({
    description: 'Email do usuário',
    example: 'exemplo@hotmail.com',
  })
  @IsNotEmpty({ message: 'O campo email não deve estar vazio.' })
  @IsEmail({}, { message: 'O campo email deve ser um e-mail válido.' })
  email: string;

  @ApiProperty({
    description: 'Código de recuperação de senha com 6 dígitos',
    example: '483920',
  })
  @IsNotEmpty({ message: 'O campo code não deve estar vazio.' })
  @Matches(/^\d{6}$/, {
    message: 'O código deve conter exatamente 6 dígitos numéricos.',
  })
  code: string;
}
