import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { UsersController } from 'src/users/users.controller';
import { UsersService } from 'src/users/users.service';
import { APP_GUARD } from '@nestjs/core';
import { LEVELS } from 'src/constants';

describe('POST /users, validação do cpf', () => {
  let app: INestApplication;
  let usersService: UsersService;

  const usuarioCriado = {
    id: 1,
    full_name: 'Usuário de Teste',
    cpf: '01234567890',
    email: 'usuario@edutrace.com',
  };

  const payload = {
    full_name: 'Usuário de Teste',
    email: 'usuario@edutrace.com',
    password: 'senhaSegura123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: { create: jest.fn().mockResolvedValue(usuarioCriado) },
        },
        {
          // Em produção quem popula request.user é o AuthGuard global
          // (src/app.module.ts). O controller lê o nível dali para autorizar o
          // cadastro, então o teste precisa do equivalente.
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: {
              switchToHttp: () => { getRequest: () => { user?: unknown } };
            }) => {
              context.switchToHttp().getRequest().user = {
                id_level: LEVELS.ADMIN,
              };
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    // Mesma configuração do bootstrap em src/main.ts.
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(async () => {
    await app.close();
  });

  function post(cpf: unknown) {
    return request(app.getHttpServer())
      .post('/users')
      .send({ ...payload, cpf });
  }

  it('should accept a cpf with correct check digits', async () => {
    const response = await post('01234567890');

    expect(response.status).toBe(201);
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: '01234567890' }),
    );
  });

  it('should accept a masked cpf and hand only the digits to the service', async () => {
    const response = await post('012.345.678-90');

    expect(response.status).toBe(201);
    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: '01234567890' }),
    );
  });

  it('should answer 400 for a cpf with wrong check digits', async () => {
    const response = await post('01234567891');

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(
      'O campo CPF deve ser um CPF válido.',
    );
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('should answer 400 for a repeated digit sequence', async () => {
    const response = await post('00000000000');

    expect(response.status).toBe(400);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('should answer 400 for letters', async () => {
    const response = await post('abcdefghijk');

    expect(response.status).toBe(400);
    expect(usersService.create).not.toHaveBeenCalled();
  });
});
