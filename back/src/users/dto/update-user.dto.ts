import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'Nome do usuário',
    example: 'Luizin',
  })
  @IsOptional()
  @IsString({ message: 'O campo full_name deve ser uma string.' })
  full_name: string;

  @ApiProperty({
    description: 'Apenas quem pode fazer essa atualização é o ADMIN.',
  })
  @IsOptional()
  @IsNumber()
  readonly id_level: number;
}
