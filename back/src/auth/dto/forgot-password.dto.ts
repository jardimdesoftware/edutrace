import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email do usuário',
    example: 'exemplo@hotmail.com',
  })
  @IsNotEmpty({ message: 'O campo email não deve estar vazio.' })
  @IsEmail({}, { message: 'O campo email deve ser um e-mail válido.' })
  email: string;
}
