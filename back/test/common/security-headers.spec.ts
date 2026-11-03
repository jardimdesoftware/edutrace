import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { securityHeaders } from 'src/common/security-headers';

@Controller('dados')
class DadosController {
  @Get()
  find() {
    return { estudante: 'Fulano' };
  }
}

async function createApp(isProduction: boolean): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [DadosController],
  }).compile();

  const app = module.createNestApplication();
  app.use(securityHeaders(isProduction));
  await app.init();
  return app;
}

describe('securityHeaders', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app.close();
  });

  describe('em produção', () => {
    beforeEach(async () => {
      app = await createApp(true);
    });

    it('should not reveal the server technology in X-Powered-By', async () => {
      const response = await request(app.getHttpServer()).get('/dados');

      expect(response.status).toBe(200);
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should send the headers of the OWASP REST Security Cheat Sheet', async () => {
      const response = await request(app.getHttpServer()).get('/dados');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['strict-transport-security']).toBe(
        'max-age=63072000; includeSubDomains',
      );
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    it('should forbid any resource and any framing in the CSP', async () => {
      const response = await request(app.getHttpServer()).get('/dados');

      expect(response.headers['content-security-policy']).toBe(
        "default-src 'none';frame-ancestors 'none'",
      );
    });

    it('should not let browsers or proxies store the response', async () => {
      const response = await request(app.getHttpServer()).get('/dados');

      expect(response.headers['cache-control']).toBe(
        'private, no-cache, no-store, max-age=0, must-revalidate',
      );
    });

    it('should send the headers on error responses too', async () => {
      const response = await request(app.getHttpServer()).get('/inexistente');

      expect(response.status).toBe(404);
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['cache-control']).toBe(
        'private, no-cache, no-store, max-age=0, must-revalidate',
      );
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('fora de produção', () => {
    beforeEach(async () => {
      app = await createApp(false);
    });

    it('should leave out only the CSP, which would block the Swagger UI', async () => {
      const response = await request(app.getHttpServer()).get('/dados');

      expect(response.headers['content-security-policy']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['cache-control']).toBe(
        'private, no-cache, no-store, max-age=0, must-revalidate',
      );
    });
  });
});
