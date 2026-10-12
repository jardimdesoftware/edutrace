import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';

export class CreateScreeningDto {
  @ApiProperty({
    description: 'Nome completo',
    example: 'João Silva',
  })
  @IsNotEmpty({ message: 'O campo full_name não deve estar vazio.' })
  @IsString({ message: 'O campo full_name deve ser uma string.' })
  full_name: string;

  @ApiProperty({
    description: 'Email',
    example: 'joao@example.com',
  })
  @IsNotEmpty({ message: 'O campo email não deve estar vazio.' })
  @IsEmail({}, { message: 'O campo email deve ser um e-mail válido.' })
  email: string;

  @ApiProperty({
    description: 'Laudo Médico',
    example: 'Link do Relatório Médico',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'O campo report deve ser uma string.' })
  report: string;

  @ApiProperty({
    description: 'Necessidades específicas em formato JSON',
    example: {
      deficiencia_fisica: true,
      deficiencia_auditiva: true,
      baixa_visao: true,
      cegueira: true,
      surdocegueira: true,
      transtornos_globais_de_desenvolvimento: true,
      superdotacao: true,
      disturbio_de_aprendizagem: true,
      outros: 'Algum outro tipo',
    },
  })
  @IsNotEmpty({ message: 'O campo specific_need não deve estar vazio.' })
  @IsObject({ message: 'O campo specific_need deve ser um objeto JSON.' })
  specific_need: object;

  @ApiProperty({
    description: 'Necessita de serviço especial',
    example: true,
  })
  @IsNotEmpty({ message: 'O campo special_service não deve estar vazio.' })
  @IsBoolean({ message: 'O campo special_service deve ser um booleano.' })
  special_service: boolean;

  @ApiProperty({
    description: 'Deficiência física em formato JSON',
    example: {
      necessita_de_transcritor: true,
      acesso_para_cadeirante: true,
      outros: 'Algum outro tipo',
    },
  })
  @IsNotEmpty({ message: 'O campo physical_disability não deve estar vazio.' })
  @IsObject({ message: 'O campo physical_disability deve ser um objeto JSON.' })
  physical_disability: object;

  @ApiProperty({
    description: 'Deficiência visual em formato JSON',
    example: {
      necessita_de_braille: true,
      material_com_fonte_aumentada: true,
      necessita_de_transcritor: true,
      outros: 'Algum outro tipo',
    },
  })
  @IsNotEmpty({ message: 'O campo visual_impairment não deve estar vazio.' })
  @IsObject({ message: 'O campo visual_impairment deve ser um objeto JSON.' })
  visual_impairment: object;

  @ApiProperty({
    description: 'Deficiência auditiva em formato JSON',
    example: {
      necessita_de_interprete_de_lingua_de_sinais: true,
      necessita_de_interprete_oralizador: true,
      outros: 'Algum outro tipo',
    },
  })
  @IsNotEmpty({ message: 'O campo hearing_impairment não deve estar vazio.' })
  @IsObject({ message: 'O campo hearing_impairment deve ser um objeto JSON.' })
  hearing_impairment: object;

  @ApiProperty({
    description: 'Transtorno global em formato JSON',
    example: {
      necessita_de_ledor: true,
      necessita_de_transcritor: true,
      outros: 'Algum outro tipo',
    },
  })
  @IsNotEmpty({ message: 'O campo global_disorder não deve estar vazio.' })
  @IsObject({ message: 'O campo global_disorder deve ser um objeto JSON.' })
  global_disorder: object;

  @ApiProperty({
    description: 'Outras deficiências (opcional)',
    example: 'Descrição de outras deficiências não listadas',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'O campo other_disabilities deve ser uma string.' })
  other_disabilities: string;
}
