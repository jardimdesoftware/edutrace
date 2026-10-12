import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { corsOptions } from 'src/common/cors-options';

@Controller('itens')
class ItensController {
  @Get()
  list() {
    return [];
  }
}

const FRONT = 'https://edutrace.exemplo';
const OUTRO_FRONT = 'https://outro.exemplo';
const ATACANTE = 'https://atacante.exemplo';

const CORS_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
];

describe.each(['production', 'development'])(
  'corsOptions com NODE_ENV=%s',
  (nodeEnv) => {
    let app: INestApplication;
    const originalEnv = { ...process.env };

    beforeEach(async () => {
      process.env.NODE_ENV = nodeEnv;
      process.env.FRONTEND_URL = `${FRONT}, ${OUTRO_FRONT}`;

      const module = await Test.createTestingModule({
        controllers: [ItensController],
      }).compile();
      app = module.createNestApplication();
      app.enableCors(corsOptions);
      await app.init();
    });

    afterEach(async () => {
      await app.close();
      process.env = { ...originalEnv };
    });

    it.each([FRONT, OUTRO_FRONT])(
      'should allow the listed origin %s with credentials',
      async (origin) => {
        const response = await request(app.getHttpServer())
          .get('/itens')
          .set('Origin', origin);

        expect(response.headers['access-control-allow-origin']).toBe(origin);
        expect(response.headers['access-control-allow-credentials']).toBe(
          'true',
        );
      },
    );

    // A proteção contra CSRF depende de o CORS recusar as outras origens.
    it('should not send any CORS header to an origin outside the list', async () => {
      const response = await request(app.getHttpServer())
        .get('/itens')
        .set('Origin', ATACANTE);

      for (const header of CORS_HEADERS) {
        expect(response.headers).not.toHaveProperty(header);
      }
    });

    it('should answer the preflight of a listed origin', async () => {
      const response = await request(app.getHttpServer())
        .options('/itens')
        .set('Origin', FRONT)
        .set('Access-Control-Request-Method', 'PATCH')
        .set('Access-Control-Request-Headers', 'content-type,x-requested-with');

      expect(response.headers['access-control-allow-origin']).toBe(FRONT);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain(
        'PATCH',
      );
    });

    it('should not answer the preflight of an origin outside the list', async () => {
      const response = await request(app.getHttpServer())
        .options('/itens')
        .set('Origin', ATACANTE)
        .set('Access-Control-Request-Method', 'PATCH')
        .set('Access-Control-Request-Headers', 'content-type,x-requested-with');

      for (const header of CORS_HEADERS) {
        expect(response.headers).not.toHaveProperty(header);
      }
    });

    it('should serve a request without Origin without CORS headers', async () => {
      const response = await request(app.getHttpServer()).get('/itens');

      expect(response.status).toBe(200);
      for (const header of CORS_HEADERS) {
        expect(response.headers).not.toHaveProperty(header);
      }
    });
  },
);
