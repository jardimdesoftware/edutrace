import {
  ConflictException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from 'src/auth/auth.guard';
import { createValidationPipe } from 'src/common/validation-pipe';
import { LEVELS } from 'src/constants';
import { SessionsService } from 'src/sessions/sessions.service';
import { UsersController } from 'src/users/users.controller';
import { UsersService } from 'src/users/users.service';

const SUB = 9;
const JTI = 'sessao-admin';

const MARKED = {
  id: 7,
  full_name: 'Aluno',
  cpf: '12345678900',
  email: 'aluno@test.com',
  roles: [LEVELS.ALUNO_ESTUDANTE],
  deleted_at: '2026-11-03T12:00:00.000Z',
};

const NOT_ADMIN = [
  ['Estudante', LEVELS.ALUNO_ESTUDANTE],
  ['Profissional da Educação', LEVELS.PROFISSIONAL_EDUCACAO],
  ['Profissional da Saúde', LEVELS.PROFISSIONAL_SAUDE],
  ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
  ['Professor do AEE', LEVELS.PROFESSOR_AEE],
] as const;

// Monta o controller de verdade, com o AuthGuard real e o ValidationPipe
// global, para provar o que o teste do controller sozinho não alcança: o nível
// que a rota aceita e o que o corpo e o id precisam ter.
describe('exclusão de usuário, rotas de /users', () => {
  let app: INestApplication;
  let sessionLevel: number;
  let usersService: {
    create: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    confirmDeletionCredentials: jest.Mock;
    markForDeletion: jest.Mock;
    restore: jest.Mock;
  };

  beforeEach(async () => {
    sessionLevel = LEVELS.ADMIN;
    usersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      confirmDeletionCredentials: jest.fn().mockResolvedValue(null),
      markForDeletion: jest.fn().mockResolvedValue(MARKED),
      restore: jest.fn().mockResolvedValue({ ...MARKED, deleted_at: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest
              .fn()
              .mockResolvedValue({ sub: SUB, jti: JTI, name: 'Admin' }),
          },
        },
        {
          provide: SessionsService,
          useValue: {
            findActive: jest.fn().mockImplementation(() =>
              Promise.resolve({
                id_user: SUB,
                user: { roles: [sessionLevel], deleted_at: null },
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

  const del = (id: string | number, body?: object) =>
    request(app.getHttpServer())
      .delete(`/users/${id}`)
      .set('Authorization', 'Bearer token')
      .send(body);

  const restore = (id: string | number) =>
    request(app.getHttpServer())
      .post(`/users/${id}/restore`)
      .set('Authorization', 'Bearer token');

  describe('DELETE /users/:id', () => {
    it('should confirm the password of the session and mark the user, masking the cpf', async () => {
      const until = '2026-11-03T12:10:00.000Z';
      usersService.confirmDeletionCredentials.mockResolvedValue(
        new Date(until),
      );

      const response = await del(7, { currentPassword: 'senha', remember: true });

      expect(response.status).toBe(200);
      expect(response.body.reauth_until).toBe(until);
      expect(response.body.user.cpf).toBe('***.456.789-**');
      expect(usersService.confirmDeletionCredentials).toHaveBeenCalledWith(
        expect.objectContaining({ sub: SUB, jti: JTI }),
        { currentPassword: 'senha', remember: true },
      );
      expect(usersService.markForDeletion).toHaveBeenCalledWith(7, SUB);
    });

    it('should accept a request without body while the confirmation window is open', async () => {
      const response = await del(7);

      expect(response.status).toBe(200);
      expect(response.body.reauth_until).toBeNull();
    });

    it.each(NOT_ADMIN)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await del(7, { currentPassword: 'senha' });

      expect(response.status).toBe(403);
      expect(usersService.confirmDeletionCredentials).not.toHaveBeenCalled();
      expect(usersService.markForDeletion).not.toHaveBeenCalled();
    });

    it('should answer 401 and mark nobody when the password is wrong', async () => {
      usersService.confirmDeletionCredentials.mockRejectedValue(
        new UnauthorizedException('Senha incorreta.'),
      );

      const response = await del(7, { currentPassword: 'errada' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Senha incorreta.');
      expect(usersService.markForDeletion).not.toHaveBeenCalled();
    });

    it('should answer 409 with the message of the lock', async () => {
      usersService.markForDeletion.mockRejectedValue(
        new ConflictException('Você não pode excluir a própria conta.'),
      );

      const response = await del(SUB, { currentPassword: 'senha' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe(
        'Você não pode excluir a própria conta.',
      );
    });

    it.each([
      ['a password that is not a string', { currentPassword: 123 }],
      ['a remember that is not a boolean', { remember: 'sim' }],
      ['a field outside the contract', { currentPassword: 'a', role: 1 }],
    ])('should answer 400 for %s, before any confirmation', async (_, body) => {
      const response = await del(7, body);

      expect(response.status).toBe(400);
      expect(usersService.confirmDeletionCredentials).not.toHaveBeenCalled();
    });

    it.each(['abc', '1.5', '-'])(
      'should answer 400 for the id %s',
      async (id) => {
        const response = await del(id, { currentPassword: 'senha' });

        expect(response.status).toBe(400);
        expect(usersService.markForDeletion).not.toHaveBeenCalled();
      },
    );
  });

  describe('POST /users/:id/restore', () => {
    it('should restore the user without asking for the password', async () => {
      const response = await restore(7);

      expect(response.status).toBe(200);
      expect(response.body.deleted_at).toBeNull();
      expect(usersService.restore).toHaveBeenCalledWith(7);
    });

    it.each(NOT_ADMIN)('should answer 403 to the %s', async (_, level) => {
      sessionLevel = level;

      const response = await restore(7);

      expect(response.status).toBe(403);
      expect(usersService.restore).not.toHaveBeenCalled();
    });

    it('should answer 400 for an id that is not an integer', async () => {
      const response = await restore('abc');

      expect(response.status).toBe(400);
      expect(usersService.restore).not.toHaveBeenCalled();
    });
  });

  describe('GET /users/:email', () => {
    it('should not exist anymore, not even for the administrator', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/aluno@test.com')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(404);
    });
  });
});
