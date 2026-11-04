import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { COURSE_NOT_IN_LIST_MESSAGE, COURSES } from 'src/users/courses';

export class SetCourseDto {
  @ApiProperty({
    description: 'Curso do estudante, um dos cursos da lista.',
    enum: COURSES,
  })
  @IsIn(COURSES, { message: COURSE_NOT_IN_LIST_MESSAGE })
  course: (typeof COURSES)[number];
}
