import { IsNotEmpty, IsString } from 'class-validator';

export class LinkGoogleAccountDto {
  @IsNotEmpty({ message: 'A credencial do Google não deve estar vazia.' })
  @IsString({ message: 'A credencial do Google deve ser uma string.' })
  credential: string;

  @IsNotEmpty({ message: 'A senha atual é obrigatória.' })
  @IsString({ message: 'O campo currentPassword deve ser uma string.' })
  currentPassword: string;
}
