import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UsersController } from 'src/users/users.controller';
import { UsersService } from 'src/users/users.service';
import { APP_GUARD } from '@nestjs/core';
import { LEVELS } from 'src/constants';
import { createValidationPipe } from 'src/common/validation-pipe';

describe('POST e PATCH /users, matrícula e curso', () => {
  let app: INestApplication;
  let usersService: { create: jest.Mock; update: jest.Mock };
  let requesterLevel: number;

  const createdUser = {
    id: 1,
    full_name: 'Estudante de Teste',
    cpf: '01234567890',
    email: 'estudante@edutrace.com',
    id_level: LEVELS.ALUNO_ESTUDANTE,
  };

  const student = {
    full_name: 'Estudante de Teste',
    cpf: '01234567890',
    email: 'estudante@edutrace.com',
    enrollment_number: '20261TADS0012',
    course: 'Análise e Desenvolvimento de Sistemas',
  };

  beforeEach(async () => {
    requesterLevel = LEVELS.ADMIN;
    usersService = {
      create: jest.fn().mockResolvedValue(createdUser),
      update: jest.fn().mockResolvedValue(createdUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        {
          // Em produção quem popula request.user é o AuthGuard global
          // (src/app.module.ts). O controller lê o nível dali.
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: {
              switchToHttp: () => { getRequest: () => { user?: unknown } };
            }) => {
              context.switchToHttp().getRequest().user = {
                id_level: requesterLevel,
              };
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    // Mesmo pipe do bootstrap em src/main.ts: com forbidNonWhitelisted, um
    // campo sem validador no DTO responderia 400 a qualquer cadastro.
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (body: object) =>
    request(app.getHttpServer()).post('/users').send(body);

  const patch = (body: object) =>
    request(app.getHttpServer())
      .patch('/users/estudante@edutrace.com')
      .send(body);

  describe('POST /users', () => {
    it('should create the student with the matrícula in upper case and the course trimmed', async () => {
      const response = await post({
        ...student,
        enrollment_number: ' 2026.1-ads/01 ',
        course: '  Análise e Desenvolvimento de Sistemas  ',
      });

      expect(response.status).toBe(201);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          enrollment_number: '2026.1-ADS/01',
          course: 'Análise e Desenvolvimento de Sistemas',
          id_level: LEVELS.ALUNO_ESTUDANTE,
        }),
      );
    });

    it('should answer 400 for a student without matrícula', async () => {
      const { enrollment_number, ...body } = student;

      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(
        'O campo enrollment_number não deve estar vazio.',
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should answer 400 for a student without course', async () => {
      const { course, ...body } = student;

      const response = await post(body);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(
        'O campo course não deve estar vazio.',
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should answer 400 for a student with an explicit level 2 and no matrícula', async () => {
      const { enrollment_number, ...body } = student;

      const response = await post({
        ...body,
        id_level: LEVELS.ALUNO_ESTUDANTE,
      });

      expect(response.status).toBe(400);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should answer 400 for the Profissional NAPNE registering a student without matrícula', async () => {
      requesterLevel = LEVELS.PROFISSIONAL_NAPNE;
      const { enrollment_number, ...body } = student;

      const response = await post(body);

      expect(response.status).toBe(400);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should answer 400 for a matrícula with a character outside the allowed set', async () => {
      const response = await post({ ...student, enrollment_number: 'AB 12' });

      expect(response.status).toBe(400);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    // Os campos da fila só mudam pelos endpoints próprios. O corpo do cadastro
    // não os aceita, nem o limite de atendimentos.
    it.each([
      ['service_status', 'IN_SERVICE'],
      ['napne_responsible_id', 9],
      ['queued_at', '2026-10-16T12:00:00.000Z'],
      ['service_started_at', '2026-10-16T12:00:00.000Z'],
      ['service_closed_at', '2026-10-16T12:00:00.000Z'],
      ['service_capacity', 5],
    ])('should answer 400 for %s in the body', async (field, value) => {
      const response = await post({ ...student, [field]: value });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(
        `property ${field} should not exist`,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should still register a professional without matrícula and course', async () => {
      const { enrollment_number, course, ...body } = student;

      const response = await post({
        ...body,
        id_level: LEVELS.PROFISSIONAL_EDUCACAO,
      });

      expect(response.status).toBe(201);
      expect(usersService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /users/:email', () => {
    it('should let the administrator correct the matrícula and the course', async () => {
      const response = await patch({
        enrollment_number: ' 20261tads0013 ',
        course: ' Informática ',
      });

      expect(response.status).toBe(200);
      expect(usersService.update).toHaveBeenCalledWith(
        'estudante@edutrace.com',
        expect.objectContaining({
          enrollment_number: '20261TADS0013',
          course: 'Informática',
        }),
      );
    });

    it.each([
      { enrollment_number: '' },
      { enrollment_number: null },
      { enrollment_number: 'AB_12' },
      { course: '   ' },
      { course: null },
    ])('should answer 400 for %p', async (body) => {
      const response = await patch(body);

      expect(response.status).toBe(400);
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it.each([
      ['service_status', 'IN_SERVICE'],
      ['napne_responsible_id', 9],
      ['queued_at', '2026-10-16T12:00:00.000Z'],
      ['service_started_at', '2026-10-16T12:00:00.000Z'],
      ['service_closed_at', '2026-10-16T12:00:00.000Z'],
    ])('should answer 400 for %s in the body', async (field, value) => {
      const response = await patch({ [field]: value });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain(
        `property ${field} should not exist`,
      );
      expect(usersService.update).not.toHaveBeenCalled();
    });
  });
});
