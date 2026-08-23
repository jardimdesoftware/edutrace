import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { AuthGuard } from 'src/auth/auth.guard';

describe('AuthController rate limit', () => {
  let app: INestApplication;

  const LIMIT = 20;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: LIMIT }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signIn: jest.fn().mockResolvedValue({ access_token: 'token' }),
            forgotPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function postLogin(ip: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: 'user@test.com', password: 'plainPassword' });
  }

  it('should accept requests up to the configured limit', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      const response = await postLogin('10.0.0.1');
      expect(response.status).toBe(200);
    }
  });

  it('should answer 429 once the limit is exceeded', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      await postLogin('10.0.0.2');
    }

    const response = await postLogin('10.0.0.2');

    expect(response.status).toBe(429);
  });

  it('should also protect the password recovery route', async () => {
    for (let attempt = 0; attempt < LIMIT; attempt++) {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', '10.0.0.3')
        .send({ email: 'user@test.com' });
    }

    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', '10.0.0.3')
      .send({ email: 'user@test.com' });

    expect(response.status).toBe(429);
  });
});
