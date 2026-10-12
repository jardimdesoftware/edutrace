import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, ValidateIf } from 'class-validator';
import { LEVELS } from 'src/constants';

// UsersService.update grava só o nome e o nível. O DTO declara só esses dois
// campos, para que e-mail, CPF e os demais campos do cadastro sejam recusados
// com 400, e não aceitos com 200 sem alterar nada.
export class UpdateUserDto {
  @ApiProperty({
    description: 'Nome do usuário',
    example: 'Luizin',
  })
  @IsOptional()
  @IsString({ message: 'O campo full_name deve ser uma string.' })
  full_name?: string;

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
