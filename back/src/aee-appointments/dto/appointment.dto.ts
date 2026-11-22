import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const APPOINTMENT_NOTES_MAX = 500;

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Id do estudante atendido pelo professor' })
  @IsInt({ message: 'O campo id_student deve ser um número inteiro.' })
  @Min(1, { message: 'O campo id_student deve ser um id válido.' })
  id_student: number;

  @ApiProperty({ description: 'Início do atendimento (ISO 8601)' })
  @IsISO8601({}, { message: 'O campo starts_at deve ser uma data ISO 8601.' })
  starts_at: string;

  @ApiProperty({ description: 'Fim do atendimento (ISO 8601)' })
  @IsISO8601({}, { message: 'O campo ends_at deve ser uma data ISO 8601.' })
  ends_at: string;

  @ApiProperty({ required: false, description: 'Observação do atendimento' })
  @IsOptional()
  @IsString({ message: 'O campo notes deve ser um texto.' })
  @MaxLength(APPOINTMENT_NOTES_MAX, {
    message: `O campo notes aceita no máximo ${APPOINTMENT_NOTES_MAX} caracteres.`,
  })
  notes?: string;
}

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {}

export class ListAppointmentsQueryDto {
  @ApiProperty({ description: 'Início do período (ISO 8601)' })
  @IsISO8601({}, { message: 'O campo from deve ser uma data ISO 8601.' })
  from: string;

  @ApiProperty({ description: 'Fim do período (ISO 8601)' })
  @IsISO8601({}, { message: 'O campo to deve ser uma data ISO 8601.' })
  to: string;
}
