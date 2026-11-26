import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

// Os PDFs são montados no navegador, então o front avisa o download aqui antes
// de salvar o arquivo.
export const DOWNLOADABLE_DOCUMENTS = ['StudentReport', 'AeeAgenda'] as const;

export class RegisterDownloadDto {
  @ApiProperty({ enum: DOWNLOADABLE_DOCUMENTS })
  @IsIn(DOWNLOADABLE_DOCUMENTS)
  entity: (typeof DOWNLOADABLE_DOCUMENTS)[number];

  @ApiPropertyOptional({ description: 'Id do estudante do relatório.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entity_id?: number;
}
