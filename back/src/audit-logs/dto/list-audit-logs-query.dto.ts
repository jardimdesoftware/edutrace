import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { SINGLE_LINE_PATTERN } from 'src/common/dto-fields';
import { AUDIT_LOG_SEARCH_MAX_LENGTH } from 'src/constants';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({
    description: 'Busca no nome e no e-mail de quem fez, na tabela e na rota.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(AUDIT_LOG_SEARCH_MAX_LENGTH)
  @Matches(SINGLE_LINE_PATTERN)
  search?: string;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Nome do model, como User ou Comments.' })
  @IsOptional()
  @Matches(/^[A-Za-z]{1,50}$/)
  entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  actor_id?: number;

  @ApiPropertyOptional({ description: 'Início do período (ISO 8601).' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ description: 'Fim do período (ISO 8601).' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
