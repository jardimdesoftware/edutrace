import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from 'src/auth/auth.controller';
import { AuthService } from 'src/auth/auth.service';
import { csrfProtection } from 'src/common/csrf-protection';
import { SessionsService } from 'src/sessions/sessions.service';

const payload = {
  sub: 1,
  email: 'user@test.com',
  name: 'Usuário',
  id_level: 2,
  jti: 'sessao-1',
};

describe('Session cookie over HTTP', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let app: INestApplication;
  let authService: { signIn: jest.Mock; logout: jest.Mock; updateProfile: jest.Mock };
  let jwtService: { verifyAsync: jest.Mock };

  beforeEach(async () => {
    authService = {
      signIn: jest.fn().mockResolvedValue({ access_token: 'token.emitido' }),
      logout: jest.fn().mockResolvedValue({ message: 'Sessão encerrada.' }),
      updateProfile: jest.fn().mockResolvedValue({ access_token: 'token.novo' }),
    };
    jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: SessionsService,
          useValue: {
            findActive: jest.fn().mockResolvedValue({
              jti: 'sessao-1',
              id_user: 1,
              user: { id_level: 2 },
            }),
            registerUse: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.use(csrfProtection);
    await app.init();
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await app.close();
  });

  function login() {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ email: 'user@test.com', password: 'plainPassword' });
  }

  it('should send the token only in an HttpOnly, SameSite=Lax cookie on login', async () => {
    process.env.NODE_ENV = 'development';

    const response = await login();

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toEqual([
      'edutrace_session=token.emitido; Path=/; HttpOnly; SameSite=Lax',
    ]);
    expect(response.body).toEqual({ message: 'Sessão iniciada.' });
    expect(response.text).not.toContain('token.emitido');
  });

  it('should add Secure and the __Host- prefix in production, without Max-Age', async () => {
    process.env.NODE_ENV = 'production';

    const response = await login();

    expect(response.headers['set-cookie']).toEqual([
      '__Host-edutrace_session=token.emitido; Path=/; HttpOnly; Secure; SameSite=Lax',
    ]);
  });

  it('should authenticate a request by the session cookie alone', async () => {
    process.env.NODE_ENV = 'development';

    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Cookie', 'edutrace_session=token.emitido');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(payload);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token.emitido', expect.any(Object));
  });

  it('should refuse a state-changing request that carries the cookie without the custom header', async () => {
    process.env.NODE_ENV = 'development';

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'edutrace_session=token.emitido');

    expect(response.status).toBe(403);
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('should refuse a state-changing request that the browser marks as cross-site', async () => {
    process.env.NODE_ENV = 'development';

    const response = await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Cookie', 'edutrace_session=token.emitido')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ currentPassword: 'senhaAtual123' });

    expect(response.status).toBe(403);
    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  it('should revoke the session and expire the cookie on logout', async () => {
    process.env.NODE_ENV = 'development';

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'edutrace_session=token.emitido')
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(response.status).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith('sessao-1');
    expect(response.headers['set-cookie']).toEqual([
      'edutrace_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
    ]);
  });

  it('should replace the cookie with the token issued by PATCH /auth/me', async () => {
    process.env.NODE_ENV = 'development';

    const response = await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Cookie', 'edutrace_session=token.emitido')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ currentPassword: 'senhaAtual123', password: 'novaSenha123' });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toEqual([
      'edutrace_session=token.novo; Path=/; HttpOnly; SameSite=Lax',
    ]);
    expect(response.body).toEqual({ message: 'Dados atualizados.' });
  });
});
