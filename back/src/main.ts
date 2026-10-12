import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { validateSecretKey } from './common/validate-secret-key';
import { setupSwagger } from './common/setup-swagger';
import { createValidationPipe } from './common/validation-pipe';
import { csrfProtection } from './common/csrf-protection';
import { corsOptions } from './common/cors-options';
import { securityHeaders } from './common/security-headers';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  validateSecretKey();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Sem isto, o limite por IP das rotas de autenticação enxergaria apenas o
  // endereço do proxy reverso e trataria todos os usuários como um cliente só.
  app.set('trust proxy', 1);

  const port = process.env.PORT ?? 3000;

  const isProduction = process.env.NODE_ENV === 'production';

  app.use(securityHeaders(isProduction));
  app.enableCors(corsOptions);
  app.use(cookieParser());
  app.use(csrfProtection);
  app.useGlobalPipes(createValidationPipe());

  setupSwagger(app, isProduction);

  await app.listen(port);
}

// Start application
bootstrap().catch(() => {
  console.error('Erro ao iniciar a aplicação');
  process.exit(1);
});
