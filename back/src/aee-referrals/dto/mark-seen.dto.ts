import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, Min } from 'class-validator';

export const MARK_SEEN_MAX_IDS = 100;

export class MarkSeenDto {
  @ApiProperty({
    description:
      'Ids dos avisos vistos. Sem o campo, todos os avisos pendentes do professor são marcados.',
    required: false,
    type: [Number],
  })
  @IsOptional()
  @IsArray({ message: 'O campo ids deve ser uma lista.' })
  @ArrayMaxSize(MARK_SEEN_MAX_IDS, {
    message: 'O campo ids aceita no máximo ' + MARK_SEEN_MAX_IDS + ' avisos.',
  })
  @IsInt({
    each: true,
    message: 'O campo ids deve ter apenas números inteiros.',
  })
  @Min(1, { each: true, message: 'O campo ids deve ter ids válidos.' })
  ids?: number[];
}
