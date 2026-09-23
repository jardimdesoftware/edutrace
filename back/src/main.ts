import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { validateSecretKey } from './common/validate-secret-key';
import { setupSwagger } from './common/setup-swagger';

async function bootstrap() {
  validateSecretKey();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Sem isto, o limite por IP das rotas de autenticação enxergaria apenas o
  // endereço do proxy reverso e trataria todos os usuários como um cliente só.
  app.set('trust proxy', 1);

  const port = process.env.PORT ?? 3000;

  const isProduction = process.env.NODE_ENV === 'production';
  const origins = process.env.FRONTEND_URL?.split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  app.enableCors({
    origin: isProduction ? origins : true,
    credentials: true,
  });
  // transform: true faz o controller receber a instância do DTO, e não o corpo
  // cru. Sem isso o @Transform do CPF normalizaria apenas o objeto usado na
  // validação, e o valor com máscara chegaria ao banco assim mesmo.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  setupSwagger(app, isProduction);

  await app.listen(port);
}

// Start application
bootstrap().catch(() => {
  console.error('Erro ao iniciar a aplicação');
  process.exit(1);
});
