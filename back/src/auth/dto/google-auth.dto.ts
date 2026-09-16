import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  @IsNotEmpty({ message: 'A credencial do Google não deve estar vazia.' })
  @IsString({ message: 'A credencial do Google deve ser uma string.' })
  credential: string;
}
