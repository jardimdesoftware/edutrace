import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { AUTH_RATE_LIMIT_DEFAULT } from 'src/auth/constants/constants';

describe('AuthController rate limit', () => {
  let app: INestApplication;

  const LIMIT = AUTH_RATE_LIMIT_DEFAULT;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: LIMIT }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signIn: jest.fn().mockResolvedValue({ access_token: 'token' }),
            signInWithGoogle: jest
              .fn()
              .mockResolvedValue({ access_token: 'token' }),
            forgotPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
            verifyResetCode: jest.fn().mockResolvedValue({ message: 'ok' }),
            resetPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
            activateAccount: jest.fn().mockResolvedValue({ message: 'ok' }),
            completeRegistration: jest
              .fn()
              .mockResolvedValue({ access_token: 'token' }),
            updateProfile: jest
              .fn()
              .mockResolvedValue({ access_token: 'token' }),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            email: 'user@test.com',
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // Uma força bruta de 10 tentativas por minuto precisa receber 429, porque o
  // bloqueio por conta responde o mesmo 401 de credencial inválida.
  it('should allow at most eight requests per minute by default', () => {
    expect(AUTH_RATE_LIMIT_DEFAULT).toBe(8);
  });

  it.each([
    ['/auth/login', { email: 'user@test.com', password: 'plainPassword' }],
    ['/auth/google', { credential: 'credencial-do-google' }],
    ['/auth/forgot-password', { email: 'user@test.com' }],
    ['/auth/verify-reset-code', { email: 'user@test.com', code: '123456' }],
    [
      '/auth/reset-password',
      { email: 'user@test.com', code: '123456', password: 'novaSenha123' },
    ],
    ['/auth/activate', { token: 'token-do-link', password: 'novaSenha123' }],
    [
      '/auth/complete-registration',
      { cpf: '01234567890', password: 'senhaNovaSegura1' },
    ],
  ])(
    'should accept %s up to the limit and answer 429 after it',
    async (path, body) => {
      const post = () => request(app.getHttpServer()).post(path).send(body);

      for (let attempt = 0; attempt < LIMIT; attempt++) {
        const response = await post();
        expect(response.status).not.toBe(429);
      }

      const response = await post();

      expect(response.status).toBe(429);
    },
  );

  it('should answer 429 to PATCH /auth/me once the limit is exceeded', async () => {
    const patchMe = () =>
      request(app.getHttpServer())
        .patch('/auth/me')
        .send({ currentPassword: 'senhaErrada123' });

    for (let attempt = 0; attempt < LIMIT; attempt++) {
      const response = await patchMe();
      expect(response.status).not.toBe(429);
    }

    const response = await patchMe();

    expect(response.status).toBe(429);
  });
});
