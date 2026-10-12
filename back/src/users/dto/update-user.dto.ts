import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, ValidateIf } from 'class-validator';
import { LEVELS } from 'src/constants';

// id_level fica fora do PartialType, que marcaria o campo com @IsOptional e
// deixaria null passar sem validação.
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['id_level'] as const),
) {
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
  @ValidateIf((dto: UpdateUserDto) => dto.id_level !== undefined)
  @IsInt({ message: 'O campo id_level deve ser um inteiro.' })
  @IsIn(Object.values(LEVELS), {
    message: 'O campo id_level deve ser um nível de acesso existente.',
  })
  readonly id_level?: number;
}
