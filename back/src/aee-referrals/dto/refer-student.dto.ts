import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, Min } from 'class-validator';

export class ReferStudentDto {
  @ApiProperty({
    description: 'E-mail do estudante encaminhado',
    example: 'aluno@discente.ifpe.edu.br',
  })
  @IsNotEmpty({ message: 'O campo student_email não deve estar vazio.' })
  @IsEmail({}, { message: 'O campo student_email deve ser um e-mail válido.' })
  student_email: string;

  @ApiProperty({
    description: 'Id do Professor do AEE que recebe o estudante',
    example: 12,
  })
  @IsInt({ message: 'O campo teacher_id deve ser um número inteiro.' })
  @Min(1, { message: 'O campo teacher_id deve ser um id válido.' })
  teacher_id: number;
}
