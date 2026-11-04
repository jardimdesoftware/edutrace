import { INestApplication, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from 'src/auth/auth.guard';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS } from 'src/constants';
import { PrismaService } from 'src/database/prisma.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { ServiceQueueService } from 'src/students/service-queue.service';
import { ServiceStatsService } from 'src/students/service-stats.service';
import { StudentsController } from 'src/students/students.controller';
import { StudentsService } from 'src/students/students.service';
import { COURSES } from 'src/users/courses';
import { userSelectFor } from 'src/users/users.select';

const SUB = 7;
const EMAIL = 'estudante@example.com';
const COURSE = 'Subsequente: Enfermagem';

const STUDENT = {
  id: 2,
  email: EMAIL,
  cpf: '12345678910',
  course: COURSE,
};

const NOT_NAPNE = [
  ['Administrador', LEVELS.ADMIN],
  ['Profissional de Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional de Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Professor do AEE', LEVELS.PROFESSOR_AEE],
  ['Estudante', LEVELS.ALUNO_ESTUDANTE],
] as const;

describe('PATCH /students/:email/course', () => {
  let app: INestApplication;
  let sessionLevel: number | readonly number[];
  let studentsService: { setCourse: jest.Mock };

  beforeEach(async () => {
    sessionLevel = LEVELS.PROFISSIONAL_NAPNE;
    studentsService = {
      setCourse: jest.fn().mockResolvedValue(STUDENT),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentsController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: StudentsService, useValue: studentsService },
        { provide: ServiceQueueService, useValue: {} },
        { provide: ServiceStatsService, useValue: {} },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockResolvedValue({ sub: SUB, jti: 'jti' }),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            findActive: jest.fn().mockImplementation(() =>
              Promise.resolve({
                id_user: SUB,
                user: { roles: [sessionLevel].flat() },
              }),
            ),
            registerUse: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const patch = (body: object, email = EMAIL) =>
    request(app.getHttpServer())
      .patch(`/students/${email}/course`)
      .set('Authorization', 'Bearer token')
      .send(body);

  it('should answer 200 with the updated student and mask the CPF', async () => {
    const response = await patch({ course: COURSE });

    expect(response.status).toBe(200);
    expect(response.body.course).toBe(COURSE);
    expect(response.body.cpf).not.toBe(STUDENT.cpf);
    expect(studentsService.setCourse).toHaveBeenCalledWith(EMAIL, COURSE, [
      LEVELS.PROFISSIONAL_NAPNE,
    ]);
  });

  it.each(COURSES)('should accept the course "%s"', async (course) => {
    const response = await patch({ course });

    expect(response.status).toBe(200);
  });

  it.each(NOT_NAPNE)('should answer 403 to the %s', async (_, level) => {
    sessionLevel = level;

    const response = await patch({ course: COURSE });

    expect(response.status).toBe(403);
    expect(studentsService.setCourse).not.toHaveBeenCalled();
  });

  it.each([
    ['a course outside the list', { course: 'Curso inventado' }],
    ['a course in lower case', { course: 'subsequente: enfermagem' }],
    ['an empty course', { course: '' }],
    ['a body without the course', {}],
    ['a field the route does not accept', { course: COURSE, roles: [1] }],
  ])('should answer 400 to %s', async (_, body) => {
    const response = await patch(body);

    expect(response.status).toBe(400);
    expect(studentsService.setCourse).not.toHaveBeenCalled();
  });

  it('should answer 404 when the account is not a student', async () => {
    studentsService.setCourse.mockRejectedValue(
      new NotFoundException('Estudante não encontrado'),
    );

    const response = await patch({ course: COURSE }, 'admin@example.com');

    expect(response.status).toBe(404);
  });
});

describe('StudentsService.setCourse', () => {
  let service: StudentsService;
  let tx: { $queryRaw: jest.Mock; user: { update: jest.Mock } };
  let studentRows: unknown[];

  beforeEach(async () => {
    studentRows = [{ id: 2 }];
    tx = {
      $queryRaw: jest.fn(() => Promise.resolve(studentRows)),
      user: { update: jest.fn().mockResolvedValue(STUDENT) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((callback: (client: unknown) => unknown) =>
              callback(tx),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(StudentsService);
  });

  it('should lock the student row and save the course by the locked id', async () => {
    const result = await service.setCourse(EMAIL, COURSE, [
      LEVELS.PROFISSIONAL_NAPNE,
    ]);

    const sql = (tx.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join(
      '?',
    );
    expect(sql).toContain('FOR UPDATE');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { course: COURSE },
      select: userSelectFor([LEVELS.PROFISSIONAL_NAPNE]),
    });
    expect(result).toEqual(STUDENT);
  });

  it('should answer 404 and save nothing when the account is not a student', async () => {
    studentRows = [];

    await expect(
      service.setCourse(EMAIL, COURSE, [LEVELS.PROFISSIONAL_NAPNE]),
    ).rejects.toThrow(NotFoundException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
