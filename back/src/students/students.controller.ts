import { Controller, Get, Param } from '@nestjs/common';
import { StudentsService } from './students.service';
import { AllowLevels } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { maskUserCpf, maskUsersCpf } from 'src/common/mask-cpf';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @Get()
  async findAll() {
    return maskUsersCpf(await this.studentsService.findAll());
  }

  @AllowLevels(
    LEVELS.ADMIN,
    LEVELS.PROFISSIONAL_EDUCACAO,
    LEVELS.PROFISSIONAL_SAUDE,
  )
  @Get(':email')
  async findOne(@Param('email') email: string) {
    const student = await this.studentsService.findOne(email);
    return student ? maskUserCpf(student) : student;
  }
}
