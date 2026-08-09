import { Controller, Get } from '@nestjs/common';
import { StudentsService } from './students.service';
import { Levels } from 'src/auth/decorators/levels.decorator';
import { LEVELS } from 'src/constants';
import { maskUsersCpf } from 'src/common/mask-cpf';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Levels(LEVELS.ALUNO_ESTUDANTE)
  @Get()
  async findAll() {
    return maskUsersCpf(await this.studentsService.findAll());
  }
}
